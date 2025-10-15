import { should } from 'chai';
should();
import sessionless from 'sessionless-node';
import fount from 'fount-js';

const baseURL = process.env.SUB_DOMAIN ? `https://${process.env.SUB_DOMAIN}.fount.allyabase.com/` : 'http://127.0.0.1:3006/';
fount.baseURL = baseURL;

let keys = {};
let fountUser = {};
let covenantUser = {};
let testContract = {};

describe('Covenant MAGIC Spell Tests', () => {

  before(async () => {
    // Generate keys for testing
    keys = await sessionless.generateKeys(() => { return keys; }, () => { return keys; });

    // Create fount user for spell casting
    fountUser = await fount.createUser(() => keys, () => keys);
    console.log('Created fount user:', fountUser.uuid);
  });

  it('should create user via covenantUserCreate spell', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'covenantUserCreate',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 0,
      components: {
        pubKey: keys.pubKey
      }
    };

    // Sign the spell
    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    // Cast the spell
    const result = await fount.castSpell('covenantUserCreate', spell);

    console.log('covenantUserCreate result:', result);

    result.should.have.property('success', true);
    result.should.have.property('user');
    result.user.should.have.property('uuid');
    result.user.should.have.property('pubKey', keys.pubKey);

    covenantUser = result.user;
  });

  it('should create contract via covenantContract spell', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'covenantContract',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 1,
      components: {
        title: 'Test Magical Contract',
        description: 'A test contract for MAGIC spell system',
        participants: [keys.pubKey, keys.pubKey], // Same participant twice for testing
        steps: [
          { description: 'Step 1: Review terms' },
          { description: 'Step 2: Sign contract' },
          { description: 'Step 3: Complete transaction' }
        ],
        userUUID: fountUser.uuid,
        pubKey: keys.pubKey
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('covenantContract', spell);

    console.log('covenantContract result:', result);

    result.should.have.property('success', true);
    result.should.have.property('contractUuid');
    result.should.have.property('bdoPubKey');
    result.should.have.property('data');
    result.data.should.have.property('title', 'Test Magical Contract');

    testContract = result.data;
  });

  it('should update contract via covenantContractUpdate spell', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'covenantContractUpdate',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 2,
      components: {
        uuid: testContract.uuid,
        userUUID: fountUser.uuid,
        pubKey: keys.pubKey,
        title: 'Updated Test Contract',
        description: 'Updated description for testing'
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('covenantContractUpdate', spell);

    console.log('covenantContractUpdate result:', result);

    result.should.have.property('success', true);
    result.should.have.property('data');
    result.data.should.have.property('title', 'Updated Test Contract');
  });

  it('should sign contract step via covenantContractSign spell', async () => {
    const timestamp = Date.now().toString();
    const stepId = testContract.steps[0].id;

    // Create step signature
    const stepMessage = timestamp + fountUser.uuid + testContract.uuid + stepId;
    const stepSignature = await sessionless.sign(stepMessage);

    const spell = {
      spell: 'covenantContractSign',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 3,
      components: {
        uuid: testContract.uuid,
        stepId: stepId,
        stepSignature: stepSignature,
        userUUID: fountUser.uuid,
        pubKey: keys.pubKey
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('covenantContractSign', spell);

    console.log('covenantContractSign result:', result);

    result.should.have.property('success', true);
    result.should.have.property('contractUuid', testContract.uuid);
    result.should.have.property('data');
  });

  it('should delete contract via covenantContractDelete spell', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'covenantContractDelete',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 4,
      components: {
        uuid: testContract.uuid,
        userUUID: fountUser.uuid,
        pubKey: keys.pubKey
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('covenantContractDelete', spell);

    console.log('covenantContractDelete result:', result);

    result.should.have.property('success', true);
    result.should.have.property('data');
  });

  it('should fail to create user with missing pubKey', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'covenantUserCreate',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 5,
      components: {
        // Missing pubKey
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('covenantUserCreate', spell);

    result.should.have.property('success', false);
    result.should.have.property('error');
  });

  it('should fail to create contract with missing fields', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'covenantContract',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 6,
      components: {
        title: 'Test Contract'
        // Missing participants, steps, userUUID, pubKey
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('covenantContract', spell);

    result.should.have.property('success', false);
    result.should.have.property('error');
  });

  it('should fail to update contract with missing uuid', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'covenantContractUpdate',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 7,
      components: {
        userUUID: fountUser.uuid,
        pubKey: keys.pubKey
        // Missing uuid
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('covenantContractUpdate', spell);

    result.should.have.property('success', false);
    result.should.have.property('error');
  });

  it('should fail to sign contract with missing stepSignature', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'covenantContractSign',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 8,
      components: {
        uuid: 'some-uuid',
        stepId: 'some-step-id',
        userUUID: fountUser.uuid,
        pubKey: keys.pubKey
        // Missing stepSignature
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('covenantContractSign', spell);

    result.should.have.property('success', false);
    result.should.have.property('error');
  });

  it('should fail to delete contract with missing uuid', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'covenantContractDelete',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 9,
      components: {
        userUUID: fountUser.uuid,
        pubKey: keys.pubKey
        // Missing uuid
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('covenantContractDelete', spell);

    result.should.have.property('success', false);
    result.should.have.property('error');
  });

});
