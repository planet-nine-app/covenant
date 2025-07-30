/**
 * Covenant - Magical Contract Management Service
 * Part of the Planet Nine ecosystem
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3011;
const isDev = process.env.DEV === 'true' || process.env.NODE_ENV === 'development';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 1000 : 100, // requests per window
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Storage setup
const dataDir = path.join(__dirname, '../../../data');
const contractsDir = path.join(dataDir, 'contracts');

async function ensureDirectories() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(contractsDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create directories:', error);
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
  
  if (!signature.step_id || typeof signature.step_id !== 'string') {
    return 'Signature must include step_id';
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
            created_at: contract.created_at,
            updated_at: contract.updated_at,
            step_count: contract.steps.length,
            completed_steps: contract.steps.filter(s => s.completed).length
          });
        }
      }
    }
    
    return contracts.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  } catch (error) {
    console.error('Failed to list contracts:', error);
    return [];
  }
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: 'covenant',
    version: '0.0.1',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Create new magical contract
app.post('/contract', async (req, res) => {
  try {
    const { title, description, participants, steps, product_uuid, bdo_location } = req.body;
    
    // Build contract object
    const contract = {
      uuid: uuidv4(),
      title,
      description: description || '',
      participants: participants || [],
      steps: (steps || []).map((step, index) => ({
        id: step.id || `step-${index + 1}`,
        description: step.description,
        magic_spell: step.magic_spell || null,
        order: index,
        signatures: {},
        completed: false,
        created_at: new Date().toISOString()
      })),
      product_uuid: product_uuid || null,
      bdo_location: bdo_location || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active'
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
    
    // Save contract
    await saveContract(contract);
    
    console.log(`Created contract: ${contract.uuid} - "${contract.title}"`);
    
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
    const contract = await loadContract(uuid);
    
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
    const updates = req.body;
    
    const contract = await loadContract(uuid);
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    // Update allowed fields
    const allowedFields = ['title', 'description', 'steps', 'status'];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        contract[field] = updates[field];
      }
    });
    
    contract.updated_at = new Date().toISOString();
    
    // Validate updated contract
    const validationError = validateContract(contract);
    if (validationError) {
      return res.status(400).json({ 
        success: false, 
        error: validationError 
      });
    }
    
    await saveContract(contract);
    
    console.log(`Updated contract: ${contract.uuid}`);
    
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
    const signatureData = req.body;
    
    // Validate signature data
    const validationError = validateSignature(signatureData);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }
    
    const contract = await loadContract(uuid);
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    // Find the step
    const step = contract.steps.find(s => s.id === signatureData.step_id);
    if (!step) {
      return res.status(404).json({
        success: false,
        error: 'Step not found'
      });
    }
    
    // Verify participant is part of contract
    if (!contract.participants.includes(signatureData.participant_uuid)) {
      return res.status(403).json({
        success: false,
        error: 'Participant not authorized for this contract'
      });
    }
    
    // Add signature
    step.signatures[signatureData.participant_uuid] = {
      signature: signatureData.signature,
      timestamp: signatureData.timestamp,
      message: signatureData.message || `Signed step: ${step.description}`
    };
    
    // Check if step is now completed (all participants have signed)
    const allSigned = contract.participants.every(participant => 
      step.signatures[participant] !== null
    );
    
    if (allSigned && !step.completed) {
      step.completed = true;
      step.completed_at = new Date().toISOString();
      
      // TODO: Trigger MAGIC spell if present
      if (step.magic_spell) {
        console.log(`🪄 Step completed! Would trigger MAGIC spell:`, step.magic_spell);
        // Integration with MAGIC service would go here
      }
    }
    
    contract.updated_at = new Date().toISOString();
    await saveContract(contract);
    
    console.log(`Signature added to contract ${uuid}, step ${signatureData.step_id} by ${signatureData.participant_uuid}`);
    
    res.json({
      success: true,
      data: {
        contract_uuid: uuid,
        step_id: signatureData.step_id,
        step_completed: step.completed,
        magic_triggered: step.completed && !!step.magic_spell
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
    
    const contract = await loadContract(uuid);
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
  
  let svgContent = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
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
  
  svgContent += '</svg>';
  return svgContent;
}

// Delete contract
app.delete('/contract/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    
    const contract = await loadContract(uuid);
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    const filePath = path.join(contractsDir, `${uuid}.json`);
    await fs.unlink(filePath);
    
    console.log(`Deleted contract: ${uuid}`);
    
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
  
  app.listen(PORT, () => {
    console.log(`🪄 Covenant service running on port ${PORT}`);
    console.log(`Environment: ${isDev ? 'development' : 'production'}`);
    console.log(`Data directory: ${dataDir}`);
  });
};

startServer().catch(error => {
  console.error('Failed to start Covenant service:', error);
  process.exit(1);
});

module.exports = app;