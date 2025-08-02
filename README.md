# Covenant - Magical Contract Management Service

A Planet Nine ecosystem service for managing magical contracts with multi-party signatures and MAGIC spell execution.

## Overview

Covenant enables the creation and management of multi-step contracts that require signatures from multiple participants. Each contract step can have an attached MAGIC spell that triggers when all participants have signed the step completion.

## Features

- **Multi-Party Contracts**: Support for contracts with multiple participants
- **Step-by-Step Execution**: Contracts broken into discrete, signable steps
- **MAGIC Integration**: Automatic spell execution on step completion
- **Beautiful Visualizations**: SVG rendering of contract status and progress
- **BDO Storage**: Persistent contract storage via BDO service
- **Sessionless Authentication**: Cryptographic signatures without shared secrets
- **Dual Signature System**: Enhanced security with step-specific signatures
- **Authorization Controls**: Creator and participant-based permissions

## Architecture

Covenant acts as a stateless contract state manager:
- Validates signatures from participants
- Immediately persists all updates to BDO
- Serves current contract state regardless of completion status
- Triggers MAGIC spells when steps are fully signed

## Authentication

Covenant uses the Planet Nine sessionless authentication protocol for all contract operations. This provides cryptographic security without requiring traditional login systems.

### Authentication Requirements

All authenticated endpoints require these fields:
- `signature`: Cryptographic signature of the constructed message
- `timestamp`: String timestamp (`new Date().getTime() + ''`)
- `userUUID`: User's unique identifier (`sessionless.generateUUID()`)
- `pubKey`: User's public key from sessionless key pair

### Message Construction

- **Contract Creation**: `timestamp + userUUID`
- **Contract Operations**: `timestamp + userUUID + contractUUID`
- **Step Signing**: Dual signatures required:
  - Main auth: `timestamp + userUUID + contractUUID`
  - Step auth: `timestamp + userUUID + contractUUID + stepId`

### Authorization Model

- **Contract Creation**: Any authenticated user
- **Contract Updates**: Creator or participants only
- **Step Signing**: Participants only
- **Contract Deletion**: Creator only
- **Contract Reading**: No authentication required

## API Endpoints

### Core Contract Management

#### Create Contract
```http
POST /contract
Content-Type: application/json

{
  "signature": "sessionless-signature",
  "timestamp": "1644123456789",
  "userUUID": "uuid-creator",
  "pubKey": "creator-public-key",
  "title": "Freelance Web Development",
  "description": "Contract for building a website",
  "participants": ["uuid-alice", "uuid-bob"],
  "steps": [
    {
      "description": "Complete project proposal",
      "magic_spell": { "type": "payment", "amount": 100 }
    },
    {
      "description": "Deliver first milestone",
      "magic_spell": { "type": "payment", "amount": 500 }
    }
  ],
  "product_uuid": "optional-product-reference"
}
```

**Authentication**: All contract endpoints require sessionless authentication with message format: `timestamp + userUUID` (for creation) or `timestamp + userUUID + contractUUID` (for updates).

#### Get Contract
```http
GET /contract/{uuid}
```

#### Update Contract
```http
PUT /contract/{uuid}
Content-Type: application/json

{
  "signature": "sessionless-signature",
  "timestamp": "1644123456789",
  "userUUID": "uuid-participant",
  "pubKey": "participant-public-key",
  "title": "Updated Contract Title",
  "status": "active"
}
```

**Authorization**: Only the contract creator or participants can update contracts.

#### Sign Contract Step
```http
PUT /contract/{uuid}/sign
Content-Type: application/json

{
  "signature": "sessionless-signature",
  "timestamp": "1644123456789",
  "userUUID": "uuid-participant",
  "pubKey": "participant-public-key",
  "step_id": "step-1",
  "step_signature": "step-specific-signature"
}
```

**Dual Signatures**: 
- Main signature: `timestamp + userUUID + contractUUID`
- Step signature: `timestamp + userUUID + contractUUID + stepId`

**Authorization**: Only contract participants can sign steps.

#### List Contracts
```http
GET /contracts
GET /contracts?participant=uuid-alice
```

#### Delete Contract
```http
DELETE /contract/{uuid}
Content-Type: application/json

{
  "signature": "sessionless-signature",
  "timestamp": "1644123456789",
  "userUUID": "uuid-creator",
  "pubKey": "creator-public-key"
}
```

**Authorization**: Only the contract creator can delete contracts.

### Visualization

#### Get Contract SVG
```http
GET /contract/{uuid}/svg
GET /contract/{uuid}/svg?theme=dark&width=1000&height=800
```

Returns a beautiful SVG visualization showing:
- Contract title and metadata
- Participant information
- Step progression with completion status
- Signature indicators with magical effects
- MAGIC spell indicators
- Progress tracking

### Utility

#### Health Check
```http
GET /health
```

## Contract Structure

```javascript
{
  "uuid": "contract-uuid",
  "title": "Contract Title",
  "description": "Optional description",
  "participants": ["uuid-1", "uuid-2"],
  "steps": [
    {
      "id": "step-1",
      "description": "Step description",
      "magic_spell": { /* MAGIC spell configuration */ },
      "order": 0,
      "signatures": {
        "uuid-1": {
          "signature": "step-signature",
          "timestamp": "1644123456789",
          "pubKey": "participant-public-key",
          "message": "timestamp+userUUID+contractUUID+stepId",
          "signed_at": "1644123456789"
        },
        "uuid-2": null // Not yet signed
      },
      "completed": false,
      "created_at": "2024-01-01T00:00:00Z",
      "completed_at": null
    }
  ],
  "product_uuid": "optional-product-uuid",
  "bdo_location": "bdo-storage-uuid",
  "created_at": "1644123456789",
  "updated_at": "1644123456789",
  "creator": "uuid-creator",
  "status": "active"
}
```

## Client SDKs

### JavaScript Client

```javascript
const CovenantClient = require('./src/client/javascript/covenant');
const sessionless = require('sessionless-node');

// Initialize client with sessionless instance
const client = new CovenantClient('http://localhost:3011', sessionless);

// Set user UUID for authentication
client.setUserUUID('your-user-uuid');

// Create contract (automatically authenticated)
const contract = await client.createContract({
  title: 'My Contract',
  participants: ['uuid-1', 'uuid-2', 'your-user-uuid'],
  steps: [
    { description: 'First step' },
    { description: 'Second step' }
  ]
});

// Sign a step (dual signatures automatically handled)
await client.signStep(contract.data.uuid, 'step-1');

// Update contract (authenticated)
await client.updateContract(contract.data.uuid, { 
  title: 'Updated Contract Title' 
});

// Delete contract (creator only)
await client.deleteContract(contract.data.uuid);

// Get contract as SVG (no auth required)
const svg = await client.getContractSVG(contract.data.uuid, { theme: 'dark' });
```

**Authentication Setup**:
```javascript
// The client automatically:
// 1. Gets keys from sessionless instance
// 2. Creates signed payloads for all authenticated endpoints
// 3. Handles dual signatures for step signing
// 4. Validates you're authorized for each operation
```

### Rust Client

```rust
use covenant_rs::{CovenantClient, ContractBuilder};

let client = CovenantClient::new("http://localhost:3011".to_string(), Some(sessionless))?;

// Create contract using builder
let contract = ContractBuilder::new()
    .title("My Contract")
    .participant("uuid-1")
    .participant("uuid-2")
    .step("First step")
    .step("Second step")
    .build()?;

let result = client.create_contract(&contract).await?;

// Sign a step
let sign_result = client.sign_step(&result.uuid, "step-1", Some("Step completed!")).await?;
```

## Installation & Setup

### Prerequisites
- Node.js 16+
- Planet Nine ecosystem services (BDO, MAGIC)

### Install Dependencies
```bash
npm install
```

### Run Server
```bash
# Development
npm run dev

# Production  
npm start
```

### Run Tests
```bash
npm test
```

## Development

### Directory Structure
```
covenant/
├── src/
│   ├── server/node/
│   │   └── covenant.js          # Main server
│   └── client/
│       ├── javascript/
│       │   └── covenant.js      # JS SDK
│       └── rust/covenant-rs/
│           └── src/lib.rs       # Rust SDK
├── test/mocha/
│   └── covenant.test.js         # Test suite
├── data/                        # Local storage (dev)
└── README.md
```

### Configuration

Environment variables:
- `PORT`: Server port (default: 3011)
- `DEV`: Enable development mode
- `NODE_ENV`: Environment (development/production)

### Integration with Planet Nine

Covenant integrates with:
- **BDO**: Contract storage and persistence
- **MAGIC**: Spell execution on step completion
- **Sessionless**: Cryptographic authentication
- **Sanora**: Product association (via product_uuid)

## MAGIC Spell Integration

When all participants sign a step, Covenant automatically triggers the associated MAGIC spell:

```javascript
// Step with MAGIC spell
{
  "description": "Payment due on completion",
  "magic_spell": {
    "type": "payment",
    "amount": 500,
    "currency": "USD",
    "recipient": "uuid-freelancer",
    "memo": "Milestone payment"
  }
}
```

## SVG Themes

Contract visualizations support multiple themes:

- **Light Theme**: Parchment-style with warm colors
- **Dark Theme**: Modern dark UI with neon accents
- **Custom Dimensions**: Configurable width/height

## Error Handling

All endpoints return consistent error responses:

```javascript
{
  "success": false,
  "error": "Descriptive error message"
}
```

Common error cases:
- Invalid contract structure
- Unauthorized signature attempts
- Non-existent contracts or steps
- Missing required fields

## Testing

Comprehensive test suite covering:
- Contract CRUD operations with sessionless authentication
- Multi-party signature workflows with dual signatures
- Authorization and permission checks
- SVG generation and themes
- Error conditions and edge cases
- Sessionless authentication integration

Run tests:
```bash
npm test
```

**Testing Authentication**: The test suite automatically generates sessionless keys and handles authentication for all endpoints, providing examples of proper sessionless integration.

## License

MIT - Part of the Planet Nine ecosystem

## Contributing

Covenant follows Planet Nine development patterns:
- Minimal dependencies
- Comprehensive error handling
- Sessionless authentication
- BDO integration for persistence
- SVG-first visualization approach