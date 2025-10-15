# Covenant - Magical Contract Management Service

## Overview

Covenant is a Planet Nine allyabase microservice that provides magical contract management with advanced cryptographic security, automatic SVG visualization generation, and distributed BDO storage integration.

**Location**: `/covenant/`
**Port**: 3011 (default)

## Core Features

### 🔐 **Per-Contract Key Management**
- **Unique Cryptographic Identity**: Each contract generates its own secp256k1 keypair
- **Key Isolation**: No shared keys between contracts for maximum security
- **Persistent Storage**: Keys stored in `/data/keys/{pubKey}.json`
- **Memory Caching**: Fast key lookups with Map-based caching
- **Contract Mapping**: UUID-to-pubKey mapping in `contract-pubkey-mapping.json`

### 🎨 **Automatic SVG Generation**
- **Beautiful Visualizations**: Parchment-style contract representations
- **Dual Themes**: Light and dark theme variants automatically generated
- **Progress Tracking**: Visual progress bars showing completion status
- **Signature Status**: Visual indicators for signed/unsigned steps
- **MAGIC Integration**: Special indicators for steps with MAGIC spells
- **Cross-Service Access**: SVGs stored in BDO for other services to use

### 💾 **BDO Integration**
- **Distributed Storage**: All contracts stored in Big Dumb Object (BDO) service
- **Per-Contract Authentication**: Each contract uses its own keys for BDO access
- **Complete Data**: Contract JSON + SVG representations stored together
- **Cross-Service Retrieval**: Other services can access via bdoUuid and pubKey
- **Local Backup**: Contracts also saved locally for reliability

### ⚡ **Sessionless Authentication**
- **No Passwords**: Uses cryptographic signatures for all operations
- **Multi-Participant**: Supports multiple participants per contract
- **Step Signing**: Individual step completion requires participant signatures
- **Secure Updates**: All contract modifications require proper authentication

## API Endpoints

### Contract Management
- `POST /contract` - Create new magical contract
- `GET /contract/:uuid` - Retrieve specific contract
- `PUT /contract/:uuid` - Update contract details
- `DELETE /contract/:uuid` - Delete contract (creator only)
- `GET /contracts` - List all contracts (with optional participant filter)

### Contract Interaction
- `PUT /contract/:uuid/sign` - Sign a contract step (requires dual signatures)
- `GET /contract/:uuid/svg` - Get beautiful SVG representation

### MAGIC Protocol
- `POST /magic/spell/:spellName` - Execute MAGIC spells for contract operations

### Public Assets
- `GET /signCovenant.js` - Interactive contract signing script for web pages

### Health & Status
- `GET /health` - Service health check

## Implementation Details

### Contract Structure
```javascript
{
  uuid: "contract-uuid",
  title: "Contract Title",
  description: "Contract description",
  participants: ["participant-uuid-1", "participant-uuid-2"],
  steps: [
    {
      id: "step-uuid",
      description: "Step description",
      magicSpell: null, // Optional MAGIC integration
      signatures: {
        "participant-uuid": {
          signature: "cryptographic-signature",
          timestamp: 1234567890,
          pubKey: "participant-public-key"
        }
      },
      completed: false
    }
  ],
  pubKey: "contract-specific-public-key",
  bdoUuid: "bdo-storage-uuid",
  svg: {
    light: "light-theme-svg-content",
    dark: "dark-theme-svg-content", 
    generated_at: "2025-01-15T18:09:50.422Z"
  },
  createdAt: "timestamp",
  updatedAt: "timestamp",
  status: "active"
}
```

### Key Management Architecture

#### Per-Contract Keys
```javascript
// Each contract gets unique keys
const contractKeys = await sessionless.generateKeys(saveKeys, getKeys);

// Keys stored with pubKey as filename
const keyPath = `/data/keys/${contractKeys.pubKey}.json`;

// Contract-to-pubKey mapping for lookups
const mapping = {
  "contract-uuid": "contract-public-key"
};
```

#### BDO Authentication
```javascript
// Contract-specific BDO operations
const bdoSaveKeys = async (keys) => contractKeys;
const bdoGetKeys = async () => contractKeys;

// Create BDO user with contract's keys
bdoUuid = await bdo.createUser(contractUuid, contract, bdoSaveKeys, bdoGetKeys);
```

### SVG Generation Pipeline

#### Automatic Generation
1. **Contract Creation/Update** → Generate SVGs
2. **Light & Dark Themes** → Both variants created
3. **BDO Storage** → SVGs included in contract data
4. **Cross-Service Access** → Other services can retrieve visual representations

#### SVG Features
- **Parchment Theme**: Medieval magical contract appearance
- **Progress Visualization**: Completion bars and step indicators
- **Signature Tracking**: Visual status of participant signatures
- **Responsive Design**: Configurable width/height
- **Rich Typography**: Beautiful fonts and magical elements

## Production Configuration

### Environment Variables
```bash
PORT=3011                    # Service port
BDO_URL=http://localhost:3003/  # BDO service URL
NODE_ENV=production          # Environment mode
DEV=false                    # Development flags
```

### Dependencies
- **sessionless-node**: Cryptographic authentication
- **bdo-js**: BDO storage integration  
- **express**: Web framework
- **express-rate-limit**: Rate limiting
- **cors**: Cross-origin support

### Infrastructure Requirements
- **BDO Service**: Must be running for distributed storage
- **Continuebee Service**: Required for BDO authentication
- **Fount Service**: Required for continuebee bootstrap

## Development Workflow

### Local Development
```bash
# Start service
npm start

# Or with environment
NODE_ENV=development npm start

# Run tests (when available)
npm test
```

### File Structure
```
covenant/
├── src/server/node/
│   └── covenant.js          # Main service implementation
├── public/
│   └── signCovenant.js      # Public contract signing script
├── data/
│   ├── contracts/           # Local contract storage
│   └── keys/               # Per-contract key storage
│       ├── {pubKey}.json   # Individual key files
│       └── contract-pubkey-mapping.json
├── the-nullary/covenant/    # Tauri client application
└── README.md               # API documentation
```

### Testing
```bash
# Create test contract
curl -X POST http://localhost:3011/contract \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Contract",
    "participants": ["user1", "user2"],
    "steps": [{"description": "Test step"}],
    "signature": "...", 
    "timestamp": 1234567890,
    "userUUID": "user1",
    "pubKey": "..."
  }'

# Get contract SVG
curl http://localhost:3011/contract/{uuid}/svg?theme=dark
```

## Integration Patterns

### Cross-Service Access
```javascript
// Other services can access contract data
const contractData = await bdo.getBDO(bdoUuid, contractHash);
const svg = contractData.bdo.svg.light; // Get visual representation
```

### Public Script Integration
```html
<!-- Include covenant signing on any web page -->
<script src="http://your-covenant-server:3011/signCovenant.js"></script>

<!-- Add covenant spell to any element -->
<button spell="covenant" 
        spell-components='{"contractUuid": "contract-uuid", "stepId": "step-uuid"}'>
  Sign Contract Step
</button>

<!-- Contract SVG with embedded participant data -->
<svg data-contract-participants='["pubKey1", "pubKey2"]'>
  <!-- Contract visualization -->
</svg>
```

### Covenant Bridge Interface
```javascript
// Provide bridge for cryptographic operations
window.covenantBridge = {
  getUserPublicKey: async () => {
    // Get current user's public key
    // Return: { success: true, publicKey: "..." } or { success: false, error: "..." }
  },
  signContractStep: async (contractUuid, stepId) => {
    // Sign contract step with user's keys  
    // Return: { success: true, data: signResult } or { success: false, error: "..." }
  }
};
```

### Client Integration
```rust
// Tauri client structure
pub struct CovenantConnection {
    pub uuid: String,
    pub title: String,
    pub bdo_uuid: Option<String>,
    pub pub_key: Option<String>,
    // ... other fields
}
```

## Security Model

### Cryptographic Isolation
- **Per-Contract Keys**: Each contract operates with unique cryptographic identity
- **No Key Sharing**: Contracts cannot access each other's data
- **BDO Authentication**: Contract-specific keys required for all BDO operations
- **Signature Verification**: All operations require valid sessionless signatures

### Access Control
- **Creator Privileges**: Only creator can delete contracts
- **Participant Access**: Only participants can sign steps
- **Public Reading**: Contract data readable by anyone with UUID
- **BDO Privacy**: Distributed storage uses contract-specific authentication

## MAGIC Protocol Integration

### Available Spells

#### `purchaseLesson`
Creates a SODOTO contract for a lesson purchase transaction.

**Spell Components**:
- `teacherPubKey` - Teacher's public key (participant 1)
- `studentPubKey` - Student's public key (participant 2)
- `lessonBdoPubKey` - BDO UUID of the lesson being purchased
- `lessonTitle` - Title of the lesson (optional)
- `price` - Price in cents (optional)
- `studentUUID` - Student's UUID for authentication
- `contractSignature` - Pre-signed signature for contract creation

**Contract Steps Created**:
1. Payment Completed
2. Grant Lesson Access
3. Complete Lesson
4. Verify Completion
5. Grant Nineum Permission

**Returns**:
```javascript
{
  success: true,
  contractUuid: "contract-uuid",
  contract: { /* full contract object */ }
}
```

**Important Notes**:
- The spell caster must pre-sign the contract creation signature using: `timestamp + studentUUID`
- The contract is created with the student as the creator (using studentPubKey)
- Contract is automatically saved to BDO with per-contract authentication
- SVG visualizations are generated automatically

### Implementation Details

The MAGIC endpoint (`/magic/spell/:spellName`) allows other services to trigger contract creation through the spell protocol. Since spell resolvers don't have access to private keys, all required signatures must be pre-signed by the spell caster and included in the spell components.

**Location**: `/src/server/node/src/magic/magic.js`

## Future Enhancements

### Advanced MAGIC Features
- **Automated Step Triggers**: Spell execution when steps are signed
- **Cross-Service Workflows**: Coordinate between multiple services
- **Template-Based Contracts**: Pre-configured contract types via spells

### Advanced Features
- **Contract Templates**: Pre-built contract types
- **Workflow Automation**: Advanced step dependencies
- **Notification System**: Real-time updates via julia messaging
- **Audit Trail**: Complete history of all contract modifications

## Public Script Features

### 📜 **signCovenant.js Public Script**
- **Universal Web Integration**: Include on any web page for contract signing functionality
- **Authorization Management**: Automatically hides buttons for unauthorized users
- **Participant Validation**: Checks user pubKey against SVG embedded participant data
- **Cryptographic Bridge**: Supports custom bridge implementations for signing operations
- **Extension Fallback**: Works with The Advancement browser extension APIs
- **Event System**: Dispatches `covenantStepSigned` events for application integration
- **Custom Dialogs**: Covenant-themed dialog system compatible with Tauri environments

### Usage Examples
```html
<!-- Basic integration -->
<script src="http://localhost:3011/signCovenant.js"></script>

<!-- Contract with signing button -->
<svg data-contract-participants='["pubKey1", "pubKey2"]'>
  <!-- Contract visualization -->
  <rect spell="covenant" 
        spell-components='{"contractUuid": "...", "stepId": "..."}' />
</svg>
```

### Bridge Implementation
```javascript
// Custom cryptographic bridge
window.covenantBridge = {
  getUserPublicKey: async () => ({ success: true, publicKey: userPubKey }),
  signContractStep: async (contractUuid, stepId) => {
    // Perform actual signing with user's private keys
    const result = await covenantAPI.signStep(contractUuid, stepId);
    return { success: true, data: result };
  }
};
```

### Event Handling
```javascript
// Listen for successful signatures
document.addEventListener('covenantStepSigned', (event) => {
  const { contractUuid, stepId, stepCompleted } = event.detail;
  // Update UI, refresh contract display, etc.
});
```

## Contract Signing Authentication

### 🔐 **Dual Signature Requirement**

The `/contract/:uuid/sign` endpoint requires **two separate signatures** for enhanced security:

1. **Endpoint Authentication Signature** (`signature`)
   - Message format: `timestamp + userUUID + contractUUID`
   - Purpose: Authenticates the request to the Covenant endpoint
   - Verified by Covenant's sessionless authentication middleware

2. **Step Signing Signature** (`stepSignature`)
   - Message format: `timestamp + userUUID + contractUUID + stepId`
   - Purpose: Cryptographically signs the specific contract step
   - Verified against the step being signed

**CRITICAL for MAGIC Protocol Integration**:
- Spell resolvers (like Addie's signInMoney spell) don't have access to private keys
- Spell casters must pre-sign BOTH signatures before casting the spell
- Both signatures must be included in the spell components
- Example: Addie's signInMoney spell expects `contractSignature` and `stepSignature` components

**Request Body Format**:
```javascript
{
  stepId: "step-uuid",
  stepSignature: "signature-for-step",
  signature: "signature-for-auth",
  timestamp: 1234567890,
  userUUID: "user-uuid",
  pubKey: "user-public-key"
}
```

## Recent Updates

### 🔑 **Public Key Migration (January 2025)**
- **Complete UUID → pubKey Migration**: All participant identification now uses secp256k1 public keys instead of UUIDs
- **Enhanced Security**: Participants identified by cryptographic public keys for stronger authentication
- **Backward Compatibility**: Tests and documentation updated to reflect pubKey-based architecture
- **Consistent Authentication**: Aligns participant identification with sessionless authentication model

### 🔄 **Contract BDO Persistence Fix (January 2025)**
- **Key Reuse**: `saveContractToBDO` now checks `contractPubKeyMap` for existing keys before generating new ones
- **Proper Updates**: Uses `bdo.updateBDO()` for existing contracts instead of creating new BDO users
- **SVG Generation**: Generates SVG content before BDO save/update so it's included in the BDO data
- **Consistent PubKey**: Contracts maintain the same pubKey throughout their lifecycle
- **Observer Access**: Allows observers to fetch the latest contract state using the same pubKey

### 🌐 **Web Integration & Responsive Display**
- **Responsive SVG Contracts**: Contract SVGs can be embedded on any website with responsive sizing
- **Viewport Fitting**: CSS patterns for contracts that adapt to browser window size
- **Dynamic Sizing**: API supports width/height parameters for custom contract dimensions
- **Cross-Site Integration**: signCovenant.js enables contract signing on any web page

### 📱 **Web Display Examples**
```css
/* Responsive container */
#contract-display {
  width: 90vw;
  height: 80vh;
  margin: 5vh auto;
  overflow: auto;
}

#contract-display svg {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
```

```javascript
// Dynamic sizing
const viewportWidth = window.innerWidth * 0.9;
const viewportHeight = window.innerHeight * 0.8;
fetch(`/contract/${uuid}/svg?width=${viewportWidth}&height=${viewportHeight}`)
```

## Testing & Integration

### Lesson Purchase Flow Test
**Location**: `/sharon/tests/lesson-purchase/lesson-purchase-flow.test.js`

The lesson purchase integration test demonstrates the complete flow of creating and managing lesson contracts using Covenant + Addie + MAGIC protocol:

**Test Flow**:
1. Creates teacher and student users
2. Teacher creates lesson BDO with SVG visualization and unique keys
3. Student purchases lesson via Addie's `signInMoney` spell
4. Addie forwards to Covenant's `purchaseLesson` MAGIC spell
5. Covenant creates SODOTO contract with 5 steps
6. **Each step requires dual signatures** - both teacher and student must sign
7. Observer BDOs created after each completed step (5 total observers)
8. Each observer captures contract state snapshot for public audit trail

**Observer Pattern for Contract Audit Trail**:
- Each contract step creates a unique observer user
- Observer fetches contract BDO and saves with their own keys
- Creates public audit trail of contract progression
- Observer BDO pubKeys are emojicoded for easy sharing
- Test results HTML displays all observer BDOs with emojicodes

**Response Format**:
Covenant endpoints now return `{contractUuid, bdoPubKey, data}` tuple format:
- `contractUuid`: The contract's UUID
- `bdoPubKey`: Public key for contract's BDO (contains SVG)
- `data`: Full contract object with steps and signatures

**Test Results Visualization**:
- `/sharon/tests/lesson-purchase/test-results.html` displays interactive results
- Shows lesson BDO with emojicode
- Shows contract with BDO pubKey emojicode and SVG visualization
- Shows contract steps with completion status
- Shows observer BDOs for each signed step with emojicodes
- All emojicodes are click-to-copy for use with AdvanceKey/AdvanceShare

## MAGIC Route Conversion (October 2025)

All Covenant REST endpoints have been converted to MAGIC protocol spells:

### Converted Spells (5 total)
1. **covenantUserCreate** - Create covenant user
2. **covenantContract** - Create new magical contract
3. **covenantContractUpdate** - Update existing contract
4. **covenantContractSign** - Sign contract step (dual signature requirement)
5. **covenantContractDelete** - Delete contract

**Testing**: Comprehensive MAGIC spell tests available in `/test/mocha/magic-spells.js` (10 tests covering success and error cases)

**Documentation**: See `/MAGIC-ROUTES.md` for complete spell specifications and migration guide

**Special Notes**:
- Contract signing spell requires dual signatures (endpoint auth + step signature)
- All contracts maintain per-contract cryptographic keys
- BDO integration ensures distributed contract storage

## Last Updated
October 14, 2025 - Completed full MAGIC protocol conversion. All 5 routes now accessible via MAGIC spells with centralized Fount authentication and dual signature support.