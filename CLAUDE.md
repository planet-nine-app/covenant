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
- `PUT /contract/:uuid/sign` - Sign a contract step
- `GET /contract/:uuid/svg` - Get beautiful SVG representation

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

## Future Enhancements

### MAGIC Integration
- **Spell Execution**: Automatic MAGIC spell triggers on step completion
- **Payment Processing**: Integration with addie for contract-based payments
- **Cross-Chain**: Support for multi-blockchain operations

### Advanced Features
- **Contract Templates**: Pre-built contract types
- **Workflow Automation**: Advanced step dependencies
- **Notification System**: Real-time updates via julia messaging
- **Audit Trail**: Complete history of all contract modifications

## Last Updated
January 15, 2025 - Complete implementation with per-contract key management, automatic SVG generation, and full BDO integration.