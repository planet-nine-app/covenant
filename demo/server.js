/**
 * Covenant Demo Server
 * Serves the demo interface and provides API endpoints using the real Covenant client SDK
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import sessionless from 'sessionless-node';
import CovenantClient from '../src/client/javascript/covenant.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.DEMO_PORT || 3012;
const COVENANT_URL = process.env.COVENANT_URL || 'http://127.0.0.1:3011';

app.use(express.json());
app.use(express.static(__dirname));

// Store demo state (in production, this would be in a database)
let demoState = {
  users: {},
  contract: null,
  contractUuid: null,
  clients: {}
};

// Initialize user keys and clients
async function initializeUser(userId, userName) {
  try {
    // Generate keys for this user
    let keysToReturn = {};
    const keys = await sessionless.generateKeys((k) => { keysToReturn = k; }, () => keysToReturn);
    const userUUID = sessionless.generateUUID();
    
    console.log(`Generated keys for ${userName}:`, { uuid: userUUID, pubKey: keys.pubKey });
    
    // Create a custom sessionless-like object for this user that uses their specific keys
    const userSessionlessContext = {
      sign: async (message) => {
        // Temporarily set the keys for this user and sign
        let tempKeysToReturn = {};
        await sessionless.generateKeys((k) => { tempKeysToReturn = k; }, () => keys);
        return await sessionless.sign(message);
      }
    };
    
    // Create client with user-specific context
    const client = new CovenantClient(COVENANT_URL, userSessionlessContext, keys);
    client.setUserUUID(userUUID);
    
    demoState.users[userId] = {
      id: userId,
      name: userName,
      uuid: userUUID,
      keys: keys,
      sessionless: userSessionlessContext
    };
    
    demoState.clients[userId] = client;
    
    return {
      success: true,
      user: {
        id: userId,
        name: userName,
        uuid: userUUID,
        pubKey: keys.pubKey
      }
    };
  } catch (error) {
    console.error(`Failed to initialize user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

// API Routes

// Initialize the demo
app.post('/api/init', async (req, res) => {
  try {
    console.log('Initializing demo...');
    
    // Reset state
    demoState = { users: {}, contract: null, contractUuid: null, clients: {} };
    
    // Initialize both users
    const user1Result = await initializeUser('user1', 'Alice');
    if (!user1Result.success) {
      return res.status(500).json({ success: false, error: 'Failed to initialize Alice: ' + user1Result.error });
    }
    
    const user2Result = await initializeUser('user2', 'Bob');
    if (!user2Result.success) {
      return res.status(500).json({ success: false, error: 'Failed to initialize Bob: ' + user2Result.error });
    }
    
    // Create the demo contract
    const contractData = {
      title: 'Demo Magical Contract',
      description: 'A three-step workflow demonstration showcasing dual-signature authentication',
      participants: [demoState.users.user1.uuid, demoState.users.user2.uuid],
      steps: [
        {
          id: 'step-1',
          description: 'Initial project setup and requirements gathering',
          magicSpell: { type: 'payment', amount: 100, currency: 'MP' }
        },
        {
          id: 'step-2',
          description: 'Development phase with milestone delivery',
          magicSpell: { type: 'payment', amount: 500, currency: 'MP' }
        },
        {
          id: 'step-3',
          description: 'Final review, testing, and project completion',
          magicSpell: { type: 'reward', amount: 250, currency: 'MP' }
        }
      ]
    };
    
    console.log('Creating contract with participants:', contractData.participants);
    console.log('User1 client details:', {
      userUUID: demoState.clients.user1.userUUID,
      pubKey: demoState.clients.user1.pubKey,
      hasSessionless: !!demoState.clients.user1.sessionless
    });
    
    const contractResult = await demoState.clients.user1.createContract(contractData);
    
    if (!contractResult.success) {
      return res.status(500).json({ success: false, error: 'Failed to create contract: ' + contractResult.error });
    }
    
    demoState.contract = contractResult.data;
    demoState.contractUuid = contractResult.data.uuid;
    
    console.log('Demo initialized successfully. Contract UUID:', demoState.contractUuid);
    
    res.json({
      success: true,
      users: {
        user1: user1Result.user,
        user2: user2Result.user
      },
      contract: demoState.contract
    });
    
  } catch (error) {
    console.error('Demo initialization failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current contract state
app.get('/api/contract', async (req, res) => {
  try {
    if (!demoState.contractUuid) {
      return res.status(404).json({ success: false, error: 'No contract found. Initialize demo first.' });
    }
    
    const contractResult = await demoState.clients.user1.getContract(demoState.contractUuid);
    
    if (!contractResult.success) {
      return res.status(500).json({ success: false, error: contractResult.error });
    }
    
    demoState.contract = contractResult.data;
    
    res.json({
      success: true,
      contract: contractResult.data
    });
    
  } catch (error) {
    console.error('Failed to get contract:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sign a step
app.post('/api/sign/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { stepId } = req.body;
    
    if (!demoState.clients[userId]) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }
    
    if (!demoState.contractUuid) {
      return res.status(400).json({ success: false, error: 'No contract found' });
    }
    
    console.log(`User ${userId} (${demoState.users[userId].name}) signing step ${stepId}`);
    
    const signResult = await demoState.clients[userId].signStep(demoState.contractUuid, stepId);
    
    if (!signResult.success) {
      return res.status(500).json({ success: false, error: signResult.error });
    }
    
    console.log('Step signed successfully:', signResult.data);
    
    // Refresh contract state
    const contractResult = await demoState.clients.user1.getContract(demoState.contractUuid);
    if (contractResult.success) {
      demoState.contract = contractResult.data;
    }
    
    res.json({
      success: true,
      signResult: signResult.data,
      contract: demoState.contract
    });
    
  } catch (error) {
    console.error('Failed to sign step:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get demo state
app.get('/api/state', (req, res) => {
  res.json({
    success: true,
    state: {
      users: Object.fromEntries(
        Object.entries(demoState.users).map(([id, user]) => [
          id, 
          { 
            id: user.id, 
            name: user.name, 
            uuid: user.uuid, 
            pubKey: user.keys.pubKey 
          }
        ])
      ),
      contract: demoState.contract,
      contractUuid: demoState.contractUuid
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    service: 'covenant-demo', 
    version: '1.0.0',
    covenantUrl: COVENANT_URL
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎭 Covenant Demo Server running on http://localhost:${PORT}`);
  console.log(`📡 Connected to Covenant service at ${COVENANT_URL}`);
  console.log(`🌐 Open http://localhost:${PORT} to view the demo`);
});

export default app;