# Covenant MAGIC-Routed Endpoints

## Overview

Covenant now supports MAGIC-routed versions of all POST, PUT, and DELETE operations. These spells route through Fount (the resolver) for centralized authentication. Covenant handles magical contract management with advanced cryptographic security, automatic SVG visualization generation, and distributed BDO storage integration for the Planet Nine ecosystem.

## Converted Routes

### 1. Create User
**Direct Route**: `PUT /user/create`
**MAGIC Spell**: `covenantUserCreate`
**Cost**: 50 MP

**Components**:
```javascript
{
  pubKey: "user-public-key"
}
```

**Returns**:
```javascript
{
  success: true,
  user: {
    uuid: "user-uuid",
    pubKey: "user-public-key",
    createdAt: "timestamp",
    updatedAt: "timestamp"
  }
}
```

**Validation**:
- Requires pubKey

---

### 2. Create Contract
**Direct Route**: `POST /contract`
**MAGIC Spell**: `covenantContract`
**Cost**: 50 MP

**Components**:
```javascript
{
  title: "Contract Title",
  description: "Contract description", // Optional
  participants: ["pubKey1", "pubKey2"], // Array of participant public keys
  steps: [
    {
      description: "Step description"
    }
  ],
  userUUID: "creator-uuid",
  pubKey: "creator-public-key",
  product_uuid: "product-uuid", // Optional
  bdo_location: "bdo-location" // Optional
}
```

**Returns**:
```javascript
{
  success: true,
  contractUuid: "contract-uuid",
  bdoPubKey: "contract-bdo-public-key",
  data: {
    uuid: "contract-uuid",
    title: "Contract Title",
    description: "Contract description",
    participants: ["pubKey1", "pubKey2"],
    steps: [
      {
        id: "step-uuid",
        description: "Step description",
        magicSpell: null,
        order: 0,
        signatures: {
          "pubKey1": null,
          "pubKey2": null
        },
        completed: false,
        createdAt: "timestamp"
      }
    ],
    productUuid: "product-uuid",
    bdoLocation: "bdo-location",
    createdAt: "timestamp",
    updatedAt: "timestamp",
    status: "active",
    creator: "creator-public-key",
    pubKey: "contract-bdo-public-key",
    bdoUuid: "bdo-uuid"
  }
}
```

**Validation**:
- Requires title, participants, steps, userUUID, and pubKey
- Contract must have at least 2 participants
- Contract must have at least one step
- Each step must have a description

---

### 3. Update Contract
**Direct Route**: `PUT /contract/:uuid`
**MAGIC Spell**: `covenantContractUpdate`
**Cost**: 50 MP

**Components**:
```javascript
{
  uuid: "contract-uuid",
  userUUID: "updater-uuid",
  pubKey: "updater-public-key",
  title: "New Title", // Optional
  description: "New description", // Optional
  steps: [], // Optional - new steps array
  status: "active" // Optional - new status
}
```

**Returns**:
```javascript
{
  success: true,
  data: {
    // Full updated contract object
  }
}
```

**Validation**:
- Requires uuid, userUUID, and pubKey
- User must be contract creator or participant
- Updated contract must still pass validation (2+ participants, 1+ steps, etc.)

---

### 4. Sign Contract Step
**Direct Route**: `PUT /contract/:uuid/sign`
**MAGIC Spell**: `covenantContractSign`
**Cost**: 50 MP

**Components**:
```javascript
{
  uuid: "contract-uuid",
  stepId: "step-uuid",
  stepSignature: "step-signature", // Pre-signed signature for the step
  userUUID: "signer-uuid",
  pubKey: "signer-public-key"
}
```

**Returns**:
```javascript
{
  success: true,
  contractUuid: "contract-uuid",
  bdoPubKey: "contract-bdo-public-key",
  data: {
    contractUuid: "contract-uuid",
    stepId: "step-uuid",
    stepCompleted: false, // true if all participants have signed
    magicTriggered: false // true if step completed and has magic spell
  }
}
```

**Validation**:
- Requires uuid, stepId, stepSignature, userUUID, and pubKey
- User must be a contract participant
- Step must exist in contract
- Step signature must be valid

**Implementation Notes**:
- This spell requires **dual signatures**:
  1. **Endpoint Authentication Signature** (`casterSignature`): Authenticates the request to Covenant
  2. **Step Signing Signature** (`stepSignature`): Cryptographically signs the specific contract step
- Spell casters must pre-sign BOTH signatures before casting the spell
- Step signature message format: `timestamp + userUUID + contractUUID + stepId`
- Step is marked as completed when all participants have signed
- If step has a MAGIC spell, it would be triggered upon completion (TODO: implementation pending)

---

### 5. Delete Contract
**Direct Route**: `DELETE /contract/:uuid`
**MAGIC Spell**: `covenantContractDelete`
**Cost**: 50 MP

**Components**:
```javascript
{
  uuid: "contract-uuid",
  userUUID: "deleter-uuid",
  pubKey: "deleter-public-key"
}
```

**Returns**:
```javascript
{
  success: true,
  data: {
    uuid: "contract-uuid"
  }
}
```

**Validation**:
- Requires uuid, userUUID, and pubKey
- Only the contract creator can delete the contract

---

## Implementation Details

### File Changes

1. **`/src/server/node/src/magic/magic.js`** - Added five new spell handlers:
   - `covenantUserCreate(spell)`
   - `covenantContract(spell)`
   - `covenantContractUpdate(spell)`
   - `covenantContractSign(spell)`
   - `covenantContractDelete(spell)`

2. **`/fount/src/server/node/spellbooks/spellbook.js`** - Added spell definitions with destinations and costs

3. **`/test/mocha/magic-spells.js`** - New test file with comprehensive spell tests

4. **`/test/mocha/package.json`** - Added `fount-js` dependency

### Authentication Flow

```
Client → Fount (resolver) → Covenant MAGIC handler → Business logic
           ↓
    Verifies signature
    Deducts MP
    Grants experience
    Grants nineum
```

**Before (Direct REST)**:
- Client signs request
- Covenant verifies signature directly
- Covenant executes business logic

**After (MAGIC Spell)**:
- Client signs spell
- Fount verifies signature & deducts MP
- Fount grants experience & nineum to caster
- Fount forwards to Covenant
- Covenant executes business logic (no auth needed)

### Naming Convention

Route path → Spell name transformation:
```
/user/create                 → covenantUserCreate
/contract                    → covenantContract
/contract/:uuid              → covenantContractUpdate
/contract/:uuid/sign         → covenantContractSign
/contract/:uuid (DELETE)     → covenantContractDelete
```

Pattern: `[service][PathWithoutSlashesAndParams]`

### Contract Management

Covenant provides comprehensive contract management for Planet Nine:

**Contract Features**:
- **Per-Contract Keys**: Each contract gets unique secp256k1 keypair
- **BDO Integration**: Contracts stored in distributed Big Dumb Object service
- **SVG Visualization**: Automatic generation of beautiful contract representations
- **Multi-Participant**: Support for multiple participants per contract
- **Step-Based Workflow**: Contracts broken into signable steps
- **Signature Tracking**: Records all participant signatures per step
- **Progress Monitoring**: Visual progress bars and completion tracking

**Contract Lifecycle**:
1. **Creation**: Contract created with participants and steps
2. **Signing**: Participants sign individual steps
3. **Completion**: Steps marked complete when all participants sign
4. **Magic Triggers**: Optional MAGIC spell execution on step completion
5. **Deletion**: Creator can delete contract (removes from BDO and local storage)

### Per-Contract Key Management

Covenant implements unique cryptographic isolation:

**Key Features**:
- Each contract generates its own secp256k1 keypair
- Keys stored in `/data/keys/{pubKey}.json`
- Contract-to-pubKey mapping in `contract-pubkey-mapping.json`
- Keys cached in memory for performance
- BDO authentication uses contract-specific keys

**Benefits**:
- No shared keys between contracts
- Maximum security through cryptographic isolation
- Contract data access requires contract-specific authentication
- Enables fine-grained access control

### BDO Integration

Covenant leverages distributed storage:

**BDO Features**:
- All contracts saved to BDO with local backup
- Each contract uses its own keys for BDO access
- Contract data includes JSON + SVG representations
- Public BDO entries allow cross-service access
- Contract updates propagate to BDO automatically

**Data Structure**:
```javascript
{
  // Contract data
  uuid: "contract-uuid",
  title: "Contract Title",
  // ... other contract fields

  // BDO metadata
  pubKey: "contract-bdo-public-key",
  bdoUuid: "bdo-uuid",

  // SVG visualization
  svgContent: "<svg>...</svg>"
}
```

### SVG Visualization

Covenant automatically generates beautiful contract visualizations:

**SVG Features**:
- Parchment-style magical contract appearance
- Light and dark theme variants
- Progress bars showing completion percentage
- Participant list with status indicators
- Step-by-step workflow display
- Signature status for each step
- MAGIC spell indicators
- Responsive sizing (customizable width/height)

**Generated Elements**:
- Contract title with decorative styling
- Participant badges with pubKey abbreviations
- Step circles (numbered or checkmarks)
- Signature counts (e.g., "2/3 signatures")
- Progress visualization
- Creation date and UUID footer
- Emojicode for AdvanceKey integration

**Use Cases**:
- Display contracts on web pages
- Share contract status visually
- Embed in other services
- Generate printable contract representations

### Error Handling

All spell handlers return consistent error format:
```javascript
{
  success: false,
  error: "Error description"
}
```

**Common Errors**:
- Missing required fields
- User not found
- Contract not found
- Unauthorized access (not creator/participant)
- Invalid contract structure
- Invalid signatures
- Step not found

## Testing

Run MAGIC spell tests:
```bash
cd covenant/test/mocha
npm install
npm test magic-spells.js
```

Test coverage:
- ✅ User creation via spell
- ✅ Contract creation via spell
- ✅ Contract update via spell
- ✅ Contract step signing via spell
- ✅ Contract deletion via spell
- ✅ Missing pubKey validation
- ✅ Missing contract fields validation
- ✅ Missing update fields validation
- ✅ Missing stepSignature validation
- ✅ Missing deletion fields validation

## Benefits

1. **No Direct Authentication**: Covenant handlers don't need to verify signatures
2. **Centralized Auth**: All signature verification in one place (Fount)
3. **Automatic Rewards**: Every spell grants experience + nineum
4. **Gateway Rewards**: Gateway participants get 10% of rewards automatically distributed
5. **Reduced Code**: Covenant handlers simplified without auth logic
6. **Consistent Pattern**: Same flow across all services

## Covenant's Role in Planet Nine

Covenant is the **contract management service** that provides:

### Contract Management
- Multi-participant magical contracts
- Step-based workflow management
- Cryptographic signature verification
- Progress tracking and completion monitoring

### Cryptographic Security
- Per-contract key generation and management
- Unique cryptographic identity per contract
- No shared keys between contracts
- Contract-specific BDO authentication

### Visual Representations
- Automatic SVG generation for contracts
- Light and dark theme support
- Responsive sizing for web display
- Cross-service visualization access

### Distributed Storage
- BDO integration for contract persistence
- Local backup for reliability
- Public contract access via BDO
- Contract updates synced to BDO

### Integration Points
- **Fount**: MP deduction and authentication
- **BDO**: Distributed contract storage
- **Addie**: Payment-based contracts via signInMoney spell
- **Other Services**: Contract visualization and verification

## Special Spell: purchaseLesson

In addition to the standard MAGIC-routed endpoints, Covenant also provides the `purchaseLesson` spell for creating lesson purchase contracts:

**Purpose**: Create a SODOTO (See One, Do One, Teach One) contract for lesson purchases

**Components**:
- `teacherPubKey`: Teacher's public key (participant 1)
- `studentPubKey`: Student's public key (participant 2)
- `lessonBdoPubKey`: BDO UUID of the lesson
- `lessonTitle`: Title of the lesson (optional)
- `price`: Price in cents (optional)
- `studentUUID`: Student's UUID for authentication
- `contractSignature`: Pre-signed signature for contract creation

**Contract Steps Created**:
1. Lesson Acquired
2. See One
3. Do One
4. Teach One
5. Grant Nineum Permission

**Flow**:
1. Addie processes payment via `signInMoney` spell
2. Addie forwards to Covenant's `purchaseLesson` spell
3. Covenant creates SODOTO contract
4. Contract stored in BDO with SVG visualization
5. Returns contract UUID and BDO pubKey

This spell enables atomic lesson purchase + contract creation operations, crucial for the Planet Nine education ecosystem.

## Next Steps

Progress on MAGIC route conversion:
- ✅ Joan (3 routes complete)
- ✅ Pref (4 routes complete)
- ✅ Aretha (4 routes complete)
- ✅ Continuebee (3 routes complete)
- ✅ BDO (4 routes complete)
- ✅ Julia (8 routes complete)
- ✅ Dolores (8 routes complete)
- ✅ Sanora (6 routes complete)
- ✅ Addie (9 routes complete)
- ✅ Covenant (5 routes complete)
- ⏳ Prof
- ⏳ Fount (internal routes)
- ⏳ Minnie (SMTP only, no HTTP routes)

## Last Updated
January 14, 2025
