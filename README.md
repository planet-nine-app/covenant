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

## Architecture

Covenant acts as a stateless contract state manager:
- Validates signatures from participants
- Immediately persists all updates to BDO
- Serves current contract state regardless of completion status
- Triggers MAGIC spells when steps are fully signed

## API Endpoints

### Core Contract Management

#### Create Contract
```http
POST /contract
Content-Type: application/json

{
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

#### Get Contract
```http
GET /contract/{uuid}
```

#### Update Contract
```http
PUT /contract/{uuid}
Content-Type: application/json

{
  "title": "Updated Contract Title",
  "status": "active"
}
```

#### Sign Contract Step
```http
PUT /contract/{uuid}/sign
Content-Type: application/json

{
  "participant_uuid": "uuid-alice",
  "step_id": "step-1",
  "signature": "cryptographic-signature",
  "timestamp": 1644123456789,
  "message": "Step completed successfully"
}
```

#### List Contracts
```http
GET /contracts
GET /contracts?participant=uuid-alice
```

#### Delete Contract
```http
DELETE /contract/{uuid}
```

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
          "signature": "crypto-signature",
          "timestamp": 1644123456789,
          "message": "Completion message"
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
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "status": "active"
}
```

## Client SDKs

### JavaScript Client

```javascript
const CovenantClient = require('./src/client/javascript/covenant');

const client = new CovenantClient('http://localhost:3011', sessionless);

// Create contract
const contract = await client.createContract({
  title: 'My Contract',
  participants: ['uuid-1', 'uuid-2'],
  steps: [
    { description: 'First step' },
    { description: 'Second step' }
  ]
});

// Sign a step
await client.signStep(contract.data.uuid, 'step-1', 'Step completed!');

// Get contract as SVG
const svg = await client.getContractSVG(contract.data.uuid, { theme: 'dark' });
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
- Contract CRUD operations
- Multi-party signature workflows
- SVG generation
- Error conditions
- Edge cases

Run tests:
```bash
npm test
```

## License

MIT - Part of the Planet Nine ecosystem

## Contributing

Covenant follows Planet Nine development patterns:
- Minimal dependencies
- Comprehensive error handling
- Sessionless authentication
- BDO integration for persistence
- SVG-first visualization approach