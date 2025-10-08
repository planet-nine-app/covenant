/**
 * Covenant - Magical Contract Management Service
 * Part of the Planet Nine ecosystem
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import sessionless from 'sessionless-node';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bdo from 'bdo-js';
import MAGIC from './src/magic/magic.js';

// =============================================================================
// EMOJICODING FUNCTIONS
// Extracted from The Advancement AdvanceKey emojicoding.js
// =============================================================================

// Base64 to emoji mapping (64 chars + padding)
const BASE64_TO_EMOJI = {
    'A': '😀', 'B': '😃', 'C': '😄', 'D': '😁', 'E': '😆', 'F': '😅', 'G': '😂', 'H': '😊',
    'I': '😉', 'J': '😍', 'K': '😘', 'L': '😋', 'M': '😎', 'N': '😐', 'O': '😑', 'P': '😔',
    'Q': '❤️', 'R': '💛', 'S': '💚', 'T': '💙', 'U': '💜', 'V': '💔', 'W': '💕', 'X': '💖',
    'Y': '👍', 'Z': '👎', 'a': '👌', 'b': '✌️', 'c': '👈', 'd': '👉', 'e': '👆', 'f': '👇',
    'g': '☀️', 'h': '🌙', 'i': '⭐', 'j': '⚡', 'k': '☁️', 'l': '❄️', 'm': '🔥', 'n': '💧',
    'o': '🐶', 'p': '🐱', 'q': '🐭', 'r': '🐰', 's': '🐻', 't': '🐯', 'u': '🐸', 'v': '🐧',
    'w': '💎', 'x': '🔑', 'y': '🎁', 'z': '🎉', '0': '🏠', '1': '🚗', '2': '📱', '3': '⚽',
    '4': '🍎', '5': '🍊', '6': '🍌', '7': '🍕', '8': '🍔', '9': '🍰', '+': '☕', '/': '🍺',
    '=': '🌿' // Padding character
};

/**
 * Simple hex to emoji encoding using built-in base64
 * @param {string} hexString - Hex string to encode
 * @returns {string} Emoji-encoded string with magic delimiters
 */
function simpleEncodeHex(hexString) {
    try {
        // Convert hex to binary string for btoa
        const binaryString = hexString.match(/.{2}/g).map(hex =>
            String.fromCharCode(parseInt(hex, 16))
        ).join('');

        // Encode to base64
        const base64 = btoa(binaryString);

        // Convert base64 to emoji
        const emoji = base64.split('').map(char => BASE64_TO_EMOJI[char] || char).join('');

        // Add magic delimiters
        const result = '✨' + emoji + '✨';

        return result;
    } catch (error) {
        console.error('❌ SIMPLE: Encode error:', error);
        throw new Error('Simple encode failed: ' + error.message);
    }
}

// =============================================================================
// END EMOJICODING FUNCTIONS
// =============================================================================

const app = express();
const PORT = process.env.PORT || 3011;
const isDev = process.env.DEV === 'true' || process.env.NODE_ENV === 'development';

// BDO Configuration
const BDO_URL = process.env.BDO_URL || 'http://127.0.0.1:3003/';
bdo.baseURL = BDO_URL;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 1000 : 100, // requests per window
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Setup paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../../../public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Storage setup
const dataDir = path.join(__dirname, '../../../data');
const contractsDir = path.join(dataDir, 'contracts');
const keysDir = path.join(dataDir, 'keys');

async function ensureDirectories() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(contractsDir, { recursive: true });
    await fs.mkdir(keysDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create directories:', error);
  }
}

// BDO Key Management - Per Contract
const keyCache = new Map(); // Cache keys in memory for performance
const contractPubKeyMap = new Map(); // Cache contract UUID -> pubKey mapping

async function saveKeys(keys) {
  const pubKey = keys.pubKey;
  const keyPath = path.join(keysDir, `${pubKey}.json`);
  await fs.writeFile(keyPath, JSON.stringify(keys, null, 2));
  keyCache.set(pubKey, keys);
  console.log(`💾 Saved keys for pubKey: ${pubKey.substring(0, 16)}...`);
}

async function getKeys(pubKey) {
  if (!pubKey) {
    throw new Error('pubKey is required for key lookup');
  }
  
  console.log(`🔍 getKeys called with pubKey: ${pubKey.substring(0, 16)}...`);
  
  // Check cache first
  if (keyCache.has(pubKey)) {
    const cachedKeys = keyCache.get(pubKey);
    console.log(`📋 Retrieved from cache - pubKey: ${cachedKeys.pubKey?.substring(0, 16)}..., hasPrivateKey: ${!!cachedKeys.privateKey}`);
    return cachedKeys;
  }
  
  try {
    const keyPath = path.join(keysDir, `${pubKey}.json`);
    const keyData = await fs.readFile(keyPath, 'utf8');
    const keys = JSON.parse(keyData);
    keyCache.set(pubKey, keys);
    console.log(`💾 Loaded from disk - pubKey: ${keys.pubKey?.substring(0, 16)}..., hasPrivateKey: ${!!keys.privateKey}, keyStructure:`, Object.keys(keys));
    return keys;
  } catch (error) {
    console.error(`❌ Failed to load keys for pubKey ${pubKey.substring(0, 16)}...:`, error.message);
    if (error.code === 'ENOENT') {
      throw new Error(`Keys not found for pubKey: ${pubKey}`);
    }
    throw error;
  }
}

// Contract UUID to pubKey mapping
async function saveContractPubKeyMapping(contractUuid, pubKey) {
  const mappingPath = path.join(keysDir, 'contract-pubkey-mapping.json');
  let mappings = {};
  
  try {
    const data = await fs.readFile(mappingPath, 'utf8');
    mappings = JSON.parse(data);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  
  mappings[contractUuid] = pubKey;
  contractPubKeyMap.set(contractUuid, pubKey);
  
  await fs.writeFile(mappingPath, JSON.stringify(mappings, null, 2));
  console.log(`🔗 Mapped contract ${contractUuid} to pubKey ${pubKey.substring(0, 16)}...`);
}

async function getContractPubKey(contractUuid) {
  // Check cache first
  if (contractPubKeyMap.has(contractUuid)) {
    return contractPubKeyMap.get(contractUuid);
  }
  
  try {
    const mappingPath = path.join(keysDir, 'contract-pubkey-mapping.json');
    const data = await fs.readFile(mappingPath, 'utf8');
    const mappings = JSON.parse(data);
    
    const pubKey = mappings[contractUuid];
    if (pubKey) {
      contractPubKeyMap.set(contractUuid, pubKey);
      return pubKey;
    }
    
    throw new Error(`No pubKey mapping found for contract: ${contractUuid}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Contract pubKey mapping file not found`);
    }
    throw error;
  }
}

// Load all mappings on startup
async function loadContractPubKeyMappings() {
  try {
    const mappingPath = path.join(keysDir, 'contract-pubkey-mapping.json');
    const data = await fs.readFile(mappingPath, 'utf8');
    const mappings = JSON.parse(data);
    
    for (const [contractUuid, pubKey] of Object.entries(mappings)) {
      contractPubKeyMap.set(contractUuid, pubKey);
    }
    
    console.log(`📋 Loaded ${Object.keys(mappings).length} contract->pubKey mappings`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to load contract pubKey mappings:', error);
    }
  }
}

// Contract validation
function validateContract(contract) {
  if (!contract.title || typeof contract.title !== 'string') {
    return 'Contract must have a title';
  }
  
  if (!contract.participants || !Array.isArray(contract.participants) || contract.participants.length < 2) {
    return 'Contract must have at least 2 participants';
  }
  
  if (!contract.steps || !Array.isArray(contract.steps) || contract.steps.length === 0) {
    return 'Contract must have at least one step';
  }
  
  // Validate each step
  for (let i = 0; i < contract.steps.length; i++) {
    const step = contract.steps[i];
    if (!step.description || typeof step.description !== 'string') {
      return `Step ${i + 1} must have a description`;
    }
  }
  
  return null;
}

function validateSignature(signature) {
  if (!signature.participant_uuid || typeof signature.participant_uuid !== 'string') {
    return 'Signature must include participant_uuid';
  }
  
  if (!signature.stepId || typeof signature.stepId !== 'string') {
    return 'Signature must include stepId';
  }
  
  if (!signature.signature || typeof signature.signature !== 'string') {
    return 'Signature must include valid signature';
  }
  
  if (!signature.timestamp || typeof signature.timestamp !== 'number') {
    return 'Signature must include timestamp';
  }
  
  return null;
}

// Contract storage functions
async function saveContract(contract) {
  const filePath = path.join(contractsDir, `${contract.uuid}.json`);
  await fs.writeFile(filePath, JSON.stringify(contract, null, 2));
  return contract;
}

async function loadContract(uuid) {
  try {
    const filePath = path.join(contractsDir, `${uuid}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function listContracts() {
  try {
    const files = await fs.readdir(contractsDir);
    const contracts = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const uuid = file.replace('.json', '');
        const contract = await loadContract(uuid);
        if (contract) {
          contracts.push({
            uuid: contract.uuid,
            title: contract.title,
            participants: contract.participants,
            createdAt: contract.created_at,
            updatedAt: contract.updated_at,
            stepCount: contract.steps.length,
            completedSteps: contract.steps.filter(s => s.completed).length,
            bdoUuid: contract.bdoUuid, // Include BDO UUID for client access
            pubKey: contract.pubKey // Include pubKey for BDO authentication
          });
        }
      }
    }
    
    return contracts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } catch (error) {
    console.error('Failed to list contracts:', error);
    return [];
  }
}

// BDO Storage Functions
async function saveContractToBDO(contract) {
  try {
    const hash = contract.uuid; // Use contract UUID as BDO hash
    
    // Generate unique keys for this contract
    const contractKeys = await sessionless.generateKeys(saveKeys, async (pubKey) => getKeys(pubKey));
    
    // Save the contract UUID -> pubKey mapping
    await saveContractPubKeyMapping(contract.uuid, contractKeys.pubKey);
    
    // Store pubKey in contract for easy access
    contract.pubKey = contractKeys.pubKey;
    
    // Create BDO user for this contract using the contract's keys
    let bdoUuid;
    try {
      // Set up sessionless to use our contract keys globally for this BDO operation
      const originalGetKeys = sessionless.getKeys;
      sessionless.getKeys = async () => contractKeys;
      
      // BDO's createUser will call sessionless.generateKeys() but we want it to use our keys
      const bdoSaveKeys = async (keys) => {
        console.log(`🔑 bdoSaveKeys called - BDO wants to save keys, returning our contract keys instead`);
        // BDO expects to save the generated keys, but we return our contract keys
        return contractKeys;
      };
      
      const bdoGetKeys = async () => {
        console.log(`🔑 bdoGetKeys called - returning our contract keys`);
        return contractKeys;
      };
      
      console.log(`🚀 Calling bdo.createUser with hash: ${hash}, using contractKeys.pubKey: ${contractKeys.pubKey.substring(0, 16)}... for authentication`);
      bdoUuid = await bdo.createUser(hash, contract, bdoSaveKeys, bdoGetKeys);
      console.log(`✅ Created BDO user ${bdoUuid} for contract ${contract.uuid} using contract pubKey ${contractKeys.pubKey.substring(0, 16)}...`);
      
      // Restore original sessionless getKeys
      sessionless.getKeys = originalGetKeys;
    } catch (error) {
      // Restore sessionless getKeys in error case too
      sessionless.getKeys = originalGetKeys;
      
      console.log('Failed to create BDO user, attempting update:', error.message);
      // If creation fails, try to update existing
      try {
        const bdoResult = await bdo.getBDO(contract.bdoUuid || bdoUuid, hash);
        if (bdoResult && bdoResult.uuid) {
          bdoUuid = bdoResult.uuid;
        } else {
          throw new Error('Failed to create or find BDO user for contract');
        }
      } catch (getBdoError) {
        throw new Error(`Failed to create or find BDO user for contract: ${getBdoError.message}`);
      }
    }
    
    // Update contract with BDO UUID and make it public
    contract.bdoUuid = bdoUuid;
    
    // Generate beautiful SVG representation for cross-service access
    console.log(`🎨 Generating SVG representation for contract ${contract.uuid}...`);
    try {
      const svg = generateContractSVG(contract, { theme: 'dark', width: 800, height: 600 });
      contract.svgContent = svg;
      // Continue without SVG if generation fails
      console.log(`✅ Generated SVG for contract ${contract.uuid}`);
    } catch (svgError) {
      console.log(`⚠️ Failed to generate SVG: ${svgError.message}`);
      // Continue without SVG if generation fails
    }

    // Create a separate BDO entry with scgContent for AdvanceKey signing
    try {
      console.log(`🪄 Creating BDO entry with scgContent for AdvanceKey signing...`);

      // Generate scgContent containing the covenant signing spell
      const scgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
  <defs>
    <linearGradient id="covenantGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6b46c1"/>
      <stop offset="100%" stop-color="#9333ea"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#covenantGrad)" rx="15"/>

  <!-- Title -->
  <text x="150" y="40" text-anchor="middle" fill="white" font-family="Georgia, serif" font-size="18" font-weight="bold">
    🔮 Covenant Signing
  </text>

  <!-- Description -->
  <text x="150" y="70" text-anchor="middle" fill="#e0e7ff" font-family="Arial" font-size="12">
    Sign contract step
  </text>

  <!-- Main signing button -->
  <rect x="50" y="90" width="200" height="40" rx="20" fill="rgba(255,255,255,0.2)"
        stroke="white" stroke-width="2"
        spell="covenant"
        spell-components='{"contractUuid": "${contract.uuid}", "stepId": "next"}' />

  <text x="150" y="115" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold"
        spell="covenant"
        spell-components='{"contractUuid": "${contract.uuid}", "stepId": "next"}'>
    🪄 Sign Next Step
  </text>

  <!-- Contract info -->
  <text x="150" y="150" text-anchor="middle" fill="#c7d2fe" font-family="Arial" font-size="10">
    ${contract.title}
  </text>

  <text x="150" y="170" text-anchor="middle" fill="#c7d2fe" font-family="Arial" font-size="10">
    ${contract.participants.length} participants • ${contract.steps.length} steps
  </text>
</svg>
      `.trim();

      // Create the scgContent BDO entry with the contract's pubKey
      const scgHash = `scg-${contract.uuid}`;
      const scgBdoData = {
        type: 'scgContent',
        contractUuid: contract.uuid,
        scgContent: scgContent,
        createdAt: new Date().toISOString(),
        description: `Covenant signing spell for contract: ${contract.title}`
      };

      // Create a separate BDO user for the scgContent using contract keys
      const contractSpecificGetKeys = async () => contractKeys;
      const originalGetKeys = sessionless.getKeys;
      sessionless.getKeys = contractSpecificGetKeys;

      const scgBdoUuid = await bdo.createUser(scgHash, scgBdoData,
        async (keys) => contractKeys,
        async () => contractKeys
      );

      // Restore original getKeys
      sessionless.getKeys = originalGetKeys;

      console.log(`✅ Created scgContent BDO entry ${scgBdoUuid} for contract ${contract.uuid}`);
      console.log(`🔮 Emojicode will point to this BDO for AdvanceKey signing`);

      // Store the scgContent BDO UUID in the contract for reference
      contract.scgBdoUuid = scgBdoUuid;

    } catch (scgError) {
      console.warn(`⚠️ Failed to create scgContent BDO entry: ${scgError.message}`);
      // Continue without scgContent if creation fails
    }

    // Update BDO with the contract data (including SVGs) using contract keys
    try {
      // Set up sessionless to use our contract keys for this operation
      const contractSpecificGetKeys = async () => contractKeys;
      
      // Temporarily replace the global getKeys function
      const originalGetKeys = sessionless.getKeys;
      sessionless.getKeys = contractSpecificGetKeys;
      
      console.log(`🔄 Updating BDO ${bdoUuid} with contract data (including SVGs) using pubKey ${contractKeys.pubKey.substring(0, 16)}...`);
      await bdo.updateBDO(bdoUuid, hash, contract);
      console.log(`✅ Updated BDO ${bdoUuid} with contract ${contract.uuid} data and SVG representations`);
      
      // Restore original getKeys function
      sessionless.getKeys = originalGetKeys;
    } catch (updateError) {
      console.log(`⚠️ Failed to update BDO with contract data: ${updateError.message}`);
      // Continue anyway - the BDO user exists even if update failed
    }
    
    console.log(`Saved contract ${contract.uuid} to BDO as ${bdoUuid} (public) with pubKey ${contractKeys.pubKey.substring(0, 16)}...`);
    
    // Also save locally as backup
    await saveContract(contract);
    
    return contract;
  } catch (error) {
    console.error('Failed to save contract to BDO:', error);
    // Fallback to local storage only
    return await saveContract(contract);
  }
}

async function loadContractFromBDO(uuid) {
  try {
    // First try to load from local storage to get BDO info
    const localContract = await loadContract(uuid);
    if (!localContract || !localContract.bdoUuid) {
      return localContract; // Return local copy if no BDO info
    }
    
    // Try to get the contract's specific pubKey
    let contractPubKey;
    try {
      contractPubKey = await getContractPubKey(uuid);
    } catch (error) {
      console.log(`No pubKey mapping found for contract ${uuid}, using local copy:`, error.message);
      return localContract;
    }
    
    // Load from BDO using the stored BDO UUID and contract-specific pubKey
    const hash = uuid;
    try {
      // Get the contract's keys for BDO authentication
      const contractKeys = await getKeys(contractPubKey);
      
      // Set up sessionless to use the contract's keys for this operation
      const contractSpecificGetKeys = async () => contractKeys;
      const originalGetKeys = sessionless.getKeys;
      sessionless.getKeys = contractSpecificGetKeys;
      
      console.log(`🔄 Loading contract ${uuid} from BDO ${localContract.bdoUuid} using pubKey ${contractPubKey.substring(0, 16)}...`);
      const bdoResult = await bdo.getBDO(localContract.bdoUuid, hash);
      
      // Restore original getKeys function
      sessionless.getKeys = originalGetKeys;
      
      if (bdoResult && bdoResult.bdo) {
        console.log(`✅ Loaded contract ${uuid} from BDO using pubKey ${contractPubKey.substring(0, 16)}...`);
        return bdoResult.bdo;
      } else {
        console.log(`⚠️ BDO returned no data for contract ${uuid}, using local copy`);
        return localContract;
      }
    } catch (bdoError) {
      console.log(`⚠️ Failed to load contract ${uuid} from BDO: ${bdoError.message}, using local copy`);
      return localContract;
    }
  } catch (error) {
    console.error('Failed to load contract from BDO:', error);
    // Fallback to local storage
    return await loadContract(uuid);
  }
}

// Routes

// Create Covenant user
app.put('/user/create', async (req, res) => {
  try {
    const { pubKey, timestamp, signature } = req.body;
    const message = timestamp + pubKey;

    // Verify sessionless authentication
    if (!signature || !sessionless.verifySignature(signature, message, pubKey)) {
      return res.status(403).json({
        success: false,
        error: 'Authentication failed'
      });
    }

    // Generate UUID for this user
    const userUUID = sessionless.generateUUID();

    // Create user object
    const user = {
      uuid: userUUID,
      pubKey: pubKey,
      createdAt: new Date().getTime().toString(),
      updatedAt: new Date().getTime().toString()
    };

    // Save user to local storage
    const usersDir = path.join(dataDir, 'users');
    await fs.mkdir(usersDir, { recursive: true });
    const userPath = path.join(usersDir, `${userUUID}.json`);
    await fs.writeFile(userPath, JSON.stringify(user, null, 2));

    console.log(`✅ Created Covenant user: ${userUUID} with pubKey ${pubKey.substring(0, 16)}...`);

    res.json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Failed to create user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

// Get user by UUID
app.get('/user/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const { timestamp, signature } = req.query;

    // Load user
    const usersDir = path.join(dataDir, 'users');
    const userPath = path.join(usersDir, `${uuid}.json`);

    try {
      const userData = await fs.readFile(userPath, 'utf-8');
      const user = JSON.parse(userData);

      // Verify authentication
      const message = timestamp + uuid;
      if (!signature || !sessionless.verifySignature(signature, message, user.pubKey)) {
        return res.status(403).json({
          success: false,
          error: 'Authentication failed'
        });
      }

      res.json({
        success: true,
        user: user
      });
    } catch (readError) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
  } catch (error) {
    console.error('Failed to get user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user'
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: 'covenant',
    version: '0.0.1',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Sessionless authentication middleware for contract endpoints
async function verifySessionlessAuth(req, res, contractUUID = null) {
  const { signature, timestamp, userUUID, pubKey } = req.body;
  
  if (!signature || !timestamp || !userUUID || !pubKey) {
    res.status(401).json({
      success: false,
      error: 'Missing authentication fields: signature, timestamp, userUUID, and pubKey required'
    });
    return null;  
  }
  
  // Construct message: timestamp + userUUID + contractUUID (if provided)
  const message = contractUUID 
    ? timestamp + userUUID + contractUUID
    : timestamp + userUUID;
  
  const verified = await sessionless.verifySignature(signature, message, pubKey);
  if (!verified) {
    res.status(401).json({
      success: false,
      error: 'Invalid signature'
    });
    return null;
  }
  
  return { message, signature, pubKey, userUUID, timestamp };
}

// Create new magical contract
app.post('/contract', async (req, res) => {
  try {
    // Verify sessionless authentication
    const auth = await verifySessionlessAuth(req, res);
    if (!auth) return; // Response already sent by verifySessionlessAuth
    
    const { title, description, participants, steps, product_uuid, bdo_location } = req.body;
    
    // Build contract object
    const contract = {
      uuid: sessionless.generateUUID(),
      title,
      description: description || '',
      participants: participants || [],
      steps: (steps || []).map((step, index) => ({
        id: step.id || sessionless.generateUUID(),
        description: step.description,
        magicSpell: step.magicSpell || step.magic_spell || null,
        order: index,
        signatures: {},
        completed: false,
        createdAt: new Date().getTime() + ''
      })),
      productUuid: product_uuid || null,
      bdoLocation: bdo_location || null,
      createdAt: new Date().getTime() + '',
      updatedAt: new Date().getTime() + '',
      status: 'active',
      creator: auth.pubKey
    };
    
    // Validate contract
    const validationError = validateContract(contract);
    if (validationError) {
      return res.status(400).json({ 
        success: false, 
        error: validationError 
      });
    }
    
    // Initialize signatures object for each step
    contract.steps.forEach(step => {
      contract.participants.forEach(participant => {
        step.signatures[participant] = null;
      });
    });
    
    // Save contract to BDO (with local backup)
    await saveContractToBDO(contract);
    
    console.log(`Created contract: ${contract.uuid} - "${contract.title}" (saved to BDO)`);
    
    res.json({
      success: true,
      data: contract
    });
    
  } catch (error) {
    console.error('Failed to create contract:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create contract'
    });
  }
});

// Get contract by UUID
app.get('/contract/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const contract = await loadContractFromBDO(uuid);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    res.json({
      success: true,
      data: contract
    });
    
  } catch (error) {
    console.error('Failed to get contract:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve contract'
    });
  }
});

// Update contract
app.put('/contract/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    
    // Verify sessionless authentication with contract UUID
    const auth = await verifySessionlessAuth(req, res, uuid);
    if (!auth) return; // Response already sent by verifySessionlessAuth
    
    const contract = await loadContractFromBDO(uuid);
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    // Verify user is authorized to update this contract (creator or participant)
    const isAuthorized = contract.creator === auth.pubKey || 
                         contract.participants.includes(auth.pubKey);
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this contract'
      });
    }
    
    const updates = req.body;
    
    // Update allowed fields
    const allowedFields = ['title', 'description', 'steps', 'status'];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        contract[field] = updates[field];
      }
    });
    
    contract.updatedAt = new Date().getTime() + '';
    
    // Validate updated contract
    const validationError = validateContract(contract);
    if (validationError) {
      return res.status(400).json({ 
        success: false, 
        error: validationError 
      });
    }
    
    await saveContractToBDO(contract);
    
    console.log(`Updated contract: ${contract.uuid} (saved to BDO)`);
    
    res.json({
      success: true,
      data: contract
    });
    
  } catch (error) {
    console.error('Failed to update contract:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contract'
    });
  }
});

// Add signature to contract step
app.put('/contract/:uuid/sign', async (req, res) => {
  try {
    const { uuid } = req.params;
    
    // Verify sessionless authentication with contract UUID
    const auth = await verifySessionlessAuth(req, res, uuid);
    if (!auth) return; // Response already sent by verifySessionlessAuth
    
    const contract = await loadContractFromBDO(uuid);
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    // Verify participant is part of contract
    if (!contract.participants.includes(auth.pubKey)) {
      return res.status(403).json({
        success: false,
        error: 'User not authorized for this contract'
      });
    }
    
    const { stepId, stepSignature } = req.body;
    
    if (!stepId || !stepSignature) {
      return res.status(400).json({
        success: false,
        error: 'stepId and stepSignature are required'
      });
    }
    
    // Find the step
    const step = contract.steps.find(s => s.id === stepId);
    if (!step) {
      return res.status(404).json({
        success: false,
        error: 'Step not found'
      });
    }
    
    // Verify the step signature
    const stepMessage = auth.timestamp + auth.userUUID + uuid + stepId;
    const stepVerified = await sessionless.verifySignature(stepSignature, stepMessage, auth.pubKey);
    if (!stepVerified) {
      return res.status(401).json({
        success: false,
        error: 'Invalid step signature'
      });
    }
    
    // Add signature
    step.signatures[auth.pubKey] = {
      signature: stepSignature,
      timestamp: auth.timestamp,
      pubKey: auth.pubKey,
      message: stepMessage,
      signed_at: new Date().getTime() + ''
    };
    
    // Check if step is now completed (all participants have signed)
    const allSigned = contract.participants.every(participant => 
      step.signatures[participant] !== null
    );
    
    if (allSigned && !step.completed) {
      step.completed = true;
      step.completedAt = new Date().getTime() + '';
      
      // TODO: Trigger MAGIC spell if present
      if (step.magicSpell) {
        console.log(`🪄 Step completed! Would trigger MAGIC spell:`, step.magicSpell);
        // Integration with MAGIC service would go here
      }
    }
    
    contract.updatedAt = new Date().getTime() + '';
    await saveContractToBDO(contract);
    
    console.log(`Signature added to contract ${uuid}, step ${stepId} by ${auth.userUUID} (saved to BDO)`);
    
    res.json({
      success: true,
      data: {
        contractUuid: uuid,
        stepId: stepId,
        stepCompleted: step.completed,
        magicTriggered: step.completed && !!step.magicSpell
      }
    });
    
  } catch (error) {
    console.error('Failed to add signature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add signature'
    });
  }
});

// List contracts (with optional participant filter)
app.get('/contracts', async (req, res) => {
  try {
    const { participant } = req.query;
    let contracts = await listContracts();
    
    // Filter by participant if provided
    if (participant) {
      contracts = contracts.filter(contract => 
        contract.participants.includes(participant)
      );
    }
    
    res.json({
      success: true,
      data: contracts
    });
    
  } catch (error) {
    console.error('Failed to list contracts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list contracts'
    });
  }
});

// Get contract as beautiful SVG
app.get('/contract/:uuid/svg', async (req, res) => {
  try {
    const { uuid } = req.params;
    const { theme = 'light', width = 800, height = 600 } = req.query;
    
    const contract = await loadContractFromBDO(uuid);
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    const svg = generateContractSVG(contract, { theme, width: parseInt(width), height: parseInt(height) });
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minute cache
    res.send(svg);
    
  } catch (error) {
    console.error('Failed to generate contract SVG:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate contract visualization'
    });
  }
});

// Generate beautiful SVG representation of contract
function generateContractSVG(contract, options = {}) {
  const { theme = 'light', width = 800, height = 600 } = options;
  
  // Theme colors
  const colors = theme === 'dark' ? {
    background: '#1a1a2e',
    parchment: '#16213e',
    text: '#eee',
    accent: '#0f3460',
    gold: '#ffd700',
    signature: '#4ade80',
    pending: '#64748b',
    border: '#e65100'
  } : {
    background: '#f8f4e6',
    parchment: '#faf7f0',
    text: '#2d3748',
    accent: '#8b4513',
    gold: '#b8860b',
    signature: '#22c55e',
    pending: '#94a3b8',
    border: '#d2691e'
  };
  
  const completedSteps = contract.steps.filter(s => s.completed).length;
  const totalSteps = contract.steps.length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  
  // Extract participant pubKeys from signatures
  const participantPubKeys = [];
  contract.steps.forEach(step => {
    contract.participants.forEach(participantPubKey => {
      const signature = step.signatures[participantPubKey];
      if (signature && signature.pubKey) {
        if (!participantPubKeys.includes(signature.pubKey)) {
          participantPubKeys.push(signature.pubKey);
        }
      }
    });
  });
  
  let svgContent = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"
         data-contract-participants='${JSON.stringify(participantPubKeys)}'>
      <defs>
        <!-- Parchment texture gradient -->
        <radialGradient id="parchmentGrad" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stop-color="${colors.parchment}"/>
          <stop offset="100%" stop-color="${colors.background}"/>
        </radialGradient>
        
        <!-- Gold gradient for accents -->
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colors.gold}"/>
          <stop offset="50%" stop-color="#ffed4a"/>
          <stop offset="100%" stop-color="${colors.gold}"/>
        </linearGradient>
        
        <!-- Signature glow effect -->
        <filter id="signatureGlow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        <!-- Magical sparkle -->
        <filter id="sparkle">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Background -->
      <rect width="100%" height="100%" fill="${colors.background}"/>
      
      <!-- Parchment scroll -->
      <rect x="40" y="40" width="${width - 80}" height="${height - 80}" 
            rx="20" ry="20" fill="url(#parchmentGrad)" 
            stroke="${colors.border}" stroke-width="3"/>
      
      <!-- Decorative corners -->
      <g stroke="${colors.gold}" stroke-width="2" fill="none">
        <path d="M60,60 L80,60 L80,80" />
        <path d="M${width-60},60 L${width-80},60 L${width-80},80" />
        <path d="M60,${height-60} L80,${height-60} L80,${height-80}" />
        <path d="M${width-60},${height-60} L${width-80},${height-60} L${width-80},${height-80}" />
      </g>
      
      <!-- Title -->
      <text x="${width/2}" y="100" text-anchor="middle" 
            font-family="Georgia, serif" font-size="28" font-weight="bold" 
            fill="url(#goldGrad)" filter="url(#sparkle)">
        ✨ ${contract.title} ✨
      </text>
      
      <!-- Subtitle with contract info -->
      <text x="${width/2}" y="130" text-anchor="middle" 
            font-family="Georgia, serif" font-size="14" fill="${colors.text}">
        Magical Contract • ${contract.participants.length} Participants • ${totalSteps} Steps
      </text>
      
      <!-- Progress bar -->
      <g transform="translate(100, 160)">
        <rect x="0" y="0" width="${width-200}" height="8" rx="4" fill="${colors.pending}"/>
        <rect x="0" y="0" width="${(width-200) * progressPercent / 100}" height="8" rx="4" 
              fill="url(#goldGrad)" filter="url(#sparkle)"/>
        <text x="${width-200}" y="20" text-anchor="end" font-family="Arial" font-size="12" fill="${colors.text}">
          ${completedSteps}/${totalSteps} Complete (${Math.round(progressPercent)}%)
        </text>
      </g>
  `;
  
  // Participants section
  let participantY = 200;
  svgContent += `
    <text x="80" y="${participantY}" font-family="Georgia, serif" font-size="18" font-weight="bold" fill="${colors.text}">
      🤝 Participants
    </text>
  `;
  
  contract.participants.forEach((participant, index) => {
    participantY += 30;
    const shortUuid = participant.substring(0, 8) + '...';
    svgContent += `
      <g transform="translate(100, ${participantY})">
        <circle cx="0" cy="-5" r="8" fill="${colors.signature}" opacity="0.8"/>
        <text x="20" y="0" font-family="Arial" font-size="14" fill="${colors.text}">
          ${shortUuid}
        </text>
      </g>
    `;
  });
  
  // Steps section
  let stepY = participantY + 60;
  svgContent += `
    <text x="80" y="${stepY}" font-family="Georgia, serif" font-size="18" font-weight="bold" fill="${colors.text}">
      📋 Contract Steps
    </text>
  `;
  
  contract.steps.forEach((step, index) => {
    stepY += 40;
    const stepNumber = index + 1;
    const isCompleted = step.completed;
    const signatureCount = Object.values(step.signatures).filter(sig => sig !== null).length;
    const requiredSignatures = contract.participants.length;
    
    svgContent += `
      <g transform="translate(80, ${stepY})">
        <!-- Step circle -->
        <circle cx="15" cy="-5" r="12" 
                fill="${isCompleted ? colors.signature : colors.pending}" 
                stroke="${colors.border}" stroke-width="2"
                ${isCompleted ? 'filter="url(#signatureGlow)"' : ''}/>
        <text x="15" y="0" text-anchor="middle" font-family="Arial" font-size="12" 
              font-weight="bold" fill="white">
          ${isCompleted ? '✓' : stepNumber}
        </text>
        
        <!-- Step description -->
        <text x="40" y="0" font-family="Arial" font-size="14" fill="${colors.text}">
          ${step.description}
        </text>
        
        <!-- Signature status -->
        <text x="40" y="15" font-family="Arial" font-size="12" fill="${colors.pending}">
          ${signatureCount}/${requiredSignatures} signatures
        </text>
        
        <!-- Magic spell indicator -->
        ${step.magic_spell ? `
          <g transform="translate(${width-200}, -10)">
            <circle cx="0" cy="0" r="8" fill="${colors.gold}" filter="url(#sparkle)"/>
            <text x="0" y="3" text-anchor="middle" font-size="10" fill="white">🪄</text>
            <text x="15" y="3" font-family="Arial" font-size="10" fill="${colors.text}">MAGIC</text>
          </g>
        ` : ''}
      </g>
    `;
  });
  
  // Footer with creation date and UUID
  const createdDate = new Date(contract.created_at).toLocaleDateString();

  // Generate emojicode for covenant (brand + encoded contract pubKey)
  let emojicodeText = '';
  if (contract.pubKey) {
    try {
      const encodedPubKey = simpleEncodeHex(contract.pubKey);
      emojicodeText = `🔮${encodedPubKey}`;
    } catch (error) {
      console.warn('⚠️ Failed to encode contract pubKey for emojicode:', error.message);
      emojicodeText = `🔮${contract.pubKey.substring(0, 8)}...`;
    }
  }

  svgContent += `
    <g transform="translate(80, ${height-80})">
      <text x="0" y="0" font-family="Arial" font-size="10" fill="${colors.pending}">
        Created: ${createdDate} • UUID: ${contract.uuid.substring(0, 8)}...
      </text>
      <text x="${width-160}" y="0" text-anchor="end" font-family="Arial" font-size="10" fill="${colors.pending}">
        Generated by Covenant ⚡
      </text>
    </g>
  `;

  // Add emojicode at the bottom for AdvanceKey signing
  if (emojicodeText) {
    svgContent += `
      <g transform="translate(${width/2}, ${height-40})">
        <rect x="-80" y="-15" width="160" height="25" rx="12" ry="12"
              fill="${colors.gold}" opacity="0.8" filter="url(#sparkle)"/>
        <text x="0" y="0" text-anchor="middle" font-family="monospace" font-size="12"
              fill="white" font-weight="bold">
          🪄 ${emojicodeText}
        </text>
      </g>
    `;
  }
  
  svgContent += '</svg>';
  return svgContent;
}

// Delete contract
app.delete('/contract/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    
    // Verify sessionless authentication with contract UUID
    const auth = await verifySessionlessAuth(req, res, uuid);
    if (!auth) return; // Response already sent by verifySessionlessAuth
    
    const contract = await loadContractFromBDO(uuid);
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    // Verify user is authorized to delete this contract (creator only)
    if (contract.creator !== auth.pubKey) {
      return res.status(403).json({
        success: false,
        error: 'Only the contract creator can delete this contract'
      });
    }
    
    // Delete from BDO if possible
    if (contract.bdoUuid) {
      try {
        const hash = uuid;
        await bdo.deleteUser(contract.bdoUuid, hash);
        console.log(`Deleted contract ${uuid} from BDO`);
      } catch (error) {
        console.error('Failed to delete from BDO:', error);
      }
    }
    
    // Delete local file
    const filePath = path.join(contractsDir, `${uuid}.json`);
    await fs.unlink(filePath);
    
    console.log(`Deleted contract: ${uuid} by ${auth.userUUID}`);
    
    res.json({
      success: true,
      data: { uuid }
    });
    
  } catch (error) {
    console.error('Failed to delete contract:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contract'
    });
  }
});

// MAGIC spell endpoint
app.post('/magic/spell/:spellName', async (req, res) => {
  try {
    const spellName = req.params.spellName;
    const spell = req.body;

    if (!MAGIC[spellName]) {
      res.status(404);
      return res.send({ error: 'spell not found' });
    }

    const spellResp = await MAGIC[spellName](spell);
    res.status(spellResp.success ? 200 : 900);
    return res.send(spellResp);
  } catch (err) {
    console.error('MAGIC spell error:', err);
    res.status(500);
    res.send({ error: 'spell execution failed' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
const startServer = async () => {
  await ensureDirectories();
  
  // Load existing contract->pubKey mappings
  await loadContractPubKeyMappings();
  
  app.listen(PORT, () => {
    console.log(`🪄 Covenant service running on port ${PORT}`);
    console.log(`Environment: ${isDev ? 'development' : 'production'}`);
    console.log(`Data directory: ${dataDir}`);
    console.log(`BDO URL: ${BDO_URL}`);
    console.log(`✅ Per-contract key management initialized`);
  });
};

startServer().catch(error => {
  console.error('Failed to start Covenant service:', error);
  process.exit(1);
});

// ES modules - no need for module.exports
