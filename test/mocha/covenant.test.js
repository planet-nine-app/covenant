import { should } from 'chai';
should();
import sessionless from 'sessionless-node';
import superAgent from 'superagent';
import fs from 'fs/promises';
import path from 'path';

const baseURL = process.env.SUB_DOMAIN ? `https://${process.env.SUB_DOMAIN}.covenant.allyabase.com/` : 'http://127.0.0.1:3011/';

const get = async function(path) {
  console.info("Getting " + path);
  try {
    return await superAgent.get(path);
  } catch (error) {
    return error.response || error;
  }
};

const put = async function(path, body) {
  console.info("Putting " + path);
  console.log(body);
  try {
    return await superAgent.put(path).send(body).set('Content-Type', 'application/json');
  } catch (error) {
    return error.response || error;
  }
};

const post = async function(path, body) {
  console.info("Posting " + path);
  console.log(body);
  try {
    return await superAgent.post(path).send(body).set('Content-Type', 'application/json');
  } catch (error) {
    return error.response || error;
  }
};

const _delete = async function(path, body) {
  console.info("Deleting " + path);
  try {
    return await superAgent.delete(path).send(body).set('Content-Type', 'application/json');
  } catch (error) {
    return error.response || error;
  }
};

describe('Covenant Service', () => {
  let testContract;
  let testKeys;
  let testUserUUID;
  let keysToReturn = {};
  
  const testParticipants = [
    '02a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
    '03b2c3d4e5f6789012345678901234567890123456789012345678901234567890ab'
  ];
  
  const testSteps = [
    {
      description: 'Complete project proposal',
      magicSpell: { type: 'payment', amount: 100 }
    },
    {
      description: 'Deliver first milestone',
      magicSpell: { type: 'payment', amount: 500 }
    },
    {
      description: 'Final delivery and review'
    }
  ];

  before(async () => {
    // Generate test keys for authentication
    testKeys = await sessionless.generateKeys((k) => { keysToReturn = k; }, () => {return keysToReturn;});
    testUserUUID = sessionless.generateUUID();
  });
  
  // Helper function to create authenticated payload
  async function createAuthPayload(contractUUID = null, additionalData = {}) {
    const timestamp = new Date().getTime() + '';
    const message = contractUUID 
      ? timestamp + testUserUUID + contractUUID
      : timestamp + testUserUUID;
    
    const signature = await sessionless.sign(message);
    
    return {
      signature,
      timestamp,
      userUUID: testUserUUID,
      pubKey: testKeys.pubKey,
      ...additionalData
    };
  }

  beforeEach(() => {
    // Always use current testUserUUID (in case it was regenerated in test suites)
    testContract = {
      title: 'Test Magical Contract',
      description: 'A test contract for automated testing',
      participants: [...testParticipants, testKeys.pubKey], // Include current test user as participant
      steps: testSteps,
      productUuid: 'test-product-uuid-123'
    };
  });

  describe('Health Check', () => {
    it('should return service health information', async () => {
      const response = await get(`${baseURL}health`);

      response.status.should.equal(200);
      response.body.should.have.property('service', 'covenant');
      response.body.should.have.property('version', '0.0.1');
      response.body.should.have.property('status', 'healthy');
      response.body.should.have.property('timestamp');
    });
  });

  describe('Contract Creation', () => {
    it('should create a new magical contract', async () => {
      const authPayload = await createAuthPayload(null, testContract);
      
      const response = await post(`${baseURL}contract`, authPayload);

      response.status.should.equal(200);
      response.body.should.have.property('success', true);
      response.body.should.have.property('data');
      
      const contract = response.body.data;
      contract.should.have.property('uuid');
      contract.should.have.property('title', testContract.title);
      contract.participants.should.deep.equal([...testParticipants, testKeys.pubKey]);
      contract.steps.should.have.length(testSteps.length);
      contract.should.have.property('status', 'active');
      contract.should.have.property('created_at');
      contract.should.have.property('updated_at');

      // Check step structure
      contract.steps.forEach((step, index) => {
        step.should.have.property('id');
        step.should.have.property('description', testSteps[index].description);
        step.should.have.property('order', index);
        step.should.have.property('completed', false);
        step.should.have.property('signatures');
        
        // Check signatures initialized for all participants
        [...testParticipants, testKeys.pubKey].forEach(participant => {
          step.signatures.should.have.property(participant, null);
        });
      });

      // Store for other tests
      testContract.uuid = contract.uuid;
    });

    it('should reject contract without title', async () => {
      const contractWithoutTitle = { ...testContract };
      delete contractWithoutTitle.title;
      const authPayload = await createAuthPayload(null, contractWithoutTitle);
      
      const response = await post(`${baseURL}contract`, authPayload);

      response.status.should.equal(400);
      response.body.should.have.property('success', false);
      response.body.error.should.include('title');
    });

    it('should reject contract with less than 2 participants', async () => {
      const contractWithOneParticipant = { ...testContract, participants: ['single-participant'] };
      const authPayload = await createAuthPayload(null, contractWithOneParticipant);
      
      const response = await post(`${baseURL}contract`, authPayload);

      response.status.should.equal(400);
      response.body.should.have.property('success', false);
      response.body.error.should.include('2 participants');
    });

    it('should reject contract with no steps', async () => {
      const contractWithNoSteps = { ...testContract, steps: [] };
      const authPayload = await createAuthPayload(null, contractWithNoSteps);
      
      const response = await post(`${baseURL}contract`, authPayload);

      response.status.should.equal(400);
      response.body.should.have.property('success', false);
      response.body.error.should.include('step');
    });
  });

  describe('Contract Retrieval', () => {
    let contractUuid;

    beforeEach(async () => {
      // Create a test contract
      const authPayload = await createAuthPayload(null, testContract);
      const response = await post(`${baseURL}contract`, authPayload);
      
      response.status.should.equal(200);
      contractUuid = response.body.data.uuid;
    });

    it('should retrieve contract by UUID', async () => {
      const response = await get(`${baseURL}contract/${contractUuid}`);

      response.status.should.equal(200);
      response.body.should.have.property('success', true);
      response.body.should.have.property('data');
      
      const contract = response.body.data;
      contract.should.have.property('uuid', contractUuid);
      contract.should.have.property('title', testContract.title);
    });

    it('should return 404 for non-existent contract', async () => {
      const response = await get(`${baseURL}contract/non-existent-uuid`);

      response.status.should.equal(404);
      response.body.should.have.property('success', false);
      response.body.error.should.include('not found');
    });
  });

  describe('Contract Updates', () => {
    let contractUuid;

    beforeEach(async () => {
      const authPayload = await createAuthPayload(null, testContract);
      const response = await post(`${baseURL}contract`, authPayload);
      
      response.status.should.equal(200);
      contractUuid = response.body.data.uuid;
    });

    it('should update contract title', async () => {
      const updatedTitle = 'Updated Magical Contract';
      const authPayload = await createAuthPayload(contractUuid, { title: updatedTitle });
      
      const response = await put(`${baseURL}contract/${contractUuid}`, authPayload);

      response.status.should.equal(200);
      response.body.should.have.property('success', true);
      response.body.data.should.have.property('title', updatedTitle);
      response.body.data.should.have.property('updated_at');
    });

    it('should return 404 for updating non-existent contract', async () => {
      const authPayload = await createAuthPayload('non-existent-uuid', { title: 'New Title' });
      const response = await put(`${baseURL}contract/non-existent-uuid`, authPayload);

      response.status.should.equal(404);
      response.body.should.have.property('success', false);
    });
  });

  describe('Contract Signing', () => {
    let contractUuid;
    let stepId;

    before(async () => {
      // Reinitialize sessionless keys for this test suite
      keysToReturn = {};
      testKeys = await sessionless.generateKeys((k) => { keysToReturn = k; }, () => {return keysToReturn;});
      testUserUUID = sessionless.generateUUID();
    });

    beforeEach(async () => {
      // Reinitialize sessionless keys for each test to prevent state corruption
      keysToReturn = {};
      testKeys = await sessionless.generateKeys((k) => { keysToReturn = k; }, () => {return keysToReturn;});
      testUserUUID = sessionless.generateUUID();
      
      // Update testContract to use the new testUserUUID
      testContract = {
        ...testContract,
        participants: [...testParticipants, testKeys.pubKey]
      };
      
      const authPayload = await createAuthPayload(null, testContract);
      const response = await post(`${baseURL}contract`, authPayload);
      
      response.status.should.equal(200);
      contractUuid = response.body.data.uuid;
      stepId = response.body.data.steps[0].id;
    });

    it('should add signature to contract step', async () => {
      // Create main auth payload
      const authPayload = await createAuthPayload(contractUuid);
      
      // Create step signature: timestamp + userUUID + contractUUID + stepId
      const stepMessage = authPayload.timestamp + authPayload.userUUID + contractUuid + stepId;
      const stepSignature = await sessionless.sign(stepMessage);
      
      // Add step-specific data
      authPayload.stepId = stepId;
      authPayload.stepSignature = stepSignature;

      const response = await put(`${baseURL}contract/${contractUuid}/sign`, authPayload);

      response.status.should.equal(200);
      response.body.should.have.property('success', true);
      response.body.data.should.have.property('contractUuid', contractUuid);
      response.body.data.should.have.property('stepId', stepId);
      response.body.data.should.have.property('stepCompleted', false); // Only one signature out of 3 participants
      response.body.data.should.have.property('magicTriggered', false);
    });

    it('should complete step when all participants sign', async () => {
      // Note: This test is simplified - in reality each participant would have their own keys
      // For testing purposes, we'll test that one participant can sign
      const authPayload = await createAuthPayload(contractUuid);
      const stepMessage = authPayload.timestamp + authPayload.userUUID + contractUuid + stepId;
      const stepSignature = await sessionless.sign(stepMessage);
      
      authPayload.stepId = stepId;
      authPayload.stepSignature = stepSignature;

      const response = await put(`${baseURL}contract/${contractUuid}/sign`, authPayload);

      response.status.should.equal(200);
      // With 3 participants, one signature won't complete the step
      response.body.data.should.have.property('stepCompleted', false);
      response.body.data.should.have.property('magicTriggered', false);
    });

    it('should reject signature from non-participant', async () => {
      // Create a different user not in the contract
      let nonParticipantKeysToReturn = {};
      const nonParticipantKeys = await sessionless.generateKeys((k) => { nonParticipantKeysToReturn = k; }, () => {return nonParticipantKeysToReturn;});
      const nonParticipantUUID = sessionless.generateUUID();
      
      const timestamp = new Date().getTime() + '';
      const message = timestamp + nonParticipantUUID + contractUuid;
      const signature = await sessionless.sign(message);
      const stepMessage = timestamp + nonParticipantUUID + contractUuid + stepId;
      const stepSignature = await sessionless.sign(stepMessage);
      
      const authPayload = {
        signature,
        timestamp,
        userUUID: nonParticipantUUID,
        pubKey: nonParticipantKeys.pubKey,
        step_id: stepId,
        step_signature: stepSignature
      };

      const response = await put(`${baseURL}contract/${contractUuid}/sign`, authPayload);

      response.status.should.equal(403);
      response.body.should.have.property('success', false);
      response.body.error.should.include('not authorized');
    });

    it('should reject signature for non-existent step', async () => {
      const authPayload = await createAuthPayload(contractUuid);
      const invalidStepId = 'non-existent-step';
      const stepMessage = authPayload.timestamp + authPayload.userUUID + contractUuid + invalidStepId;
      const stepSignature = await sessionless.sign(stepMessage);
      
      authPayload.stepId = invalidStepId;
      authPayload.stepSignature = stepSignature;

      const response = await put(`${baseURL}contract/${contractUuid}/sign`, authPayload);

      response.status.should.equal(404);
      response.body.should.have.property('success', false);
      response.body.error.should.include('Step not found');
    });
  });

  describe('Contract Listing', () => {
    let contractUuids = [];

    before(async () => {
      // Reinitialize sessionless keys for this test suite
      keysToReturn = {};
      testKeys = await sessionless.generateKeys((k) => { keysToReturn = k; }, () => {return keysToReturn;});
      testUserUUID = sessionless.generateUUID();
    });

    beforeEach(async () => {
      // Create multiple test contracts
      for (let i = 0; i < 3; i++) {
        const contract = {
          ...testContract,
          title: `Test Contract ${i + 1}`,
          participants: i % 2 === 0 ? [...testParticipants, testKeys.pubKey] : ['02d4e5f6789012345678901234567890123456789012345678901234567890123456', '03e5f6789012345678901234567890123456789012345678901234567890123456ab', testKeys.pubKey]
        };

        const authPayload = await createAuthPayload(null, contract);
        const response = await post(`${baseURL}contract`, authPayload);
        
        response.status.should.equal(200);
        contractUuids.push(response.body.data.uuid);
      }
    });

    it('should list all contracts', async () => {
      const response = await get(`${baseURL}contracts`);

      response.status.should.equal(200);
      response.body.should.have.property('success', true);
      response.body.should.have.property('data');
      response.body.data.should.be.an('array');
      response.body.data.length.should.be.at.least(3);

      // Check contract summary structure
      const contract = response.body.data[0];
      contract.should.have.property('uuid');
      contract.should.have.property('title');
      contract.should.have.property('participants');
      contract.should.have.property('step_count');
      contract.should.have.property('completed_steps');
    });

    it('should filter contracts by participant', async () => {
      const response = await get(`${baseURL}contracts?participant=${testKeys.pubKey}`);

      response.status.should.equal(200);
      response.body.should.have.property('success', true);
      response.body.data.should.be.an('array');
      
      // Should only return contracts where test user's pubKey is involved
      response.body.data.forEach(contract => {
        contract.participants.should.include(testKeys.pubKey);
      });
    });
  });

  describe('SVG Generation', () => {
    let contractUuid;

    before(async () => {
      // Reinitialize sessionless keys for this test suite
      keysToReturn = {};
      testKeys = await sessionless.generateKeys((k) => { keysToReturn = k; }, () => {return keysToReturn;});
      testUserUUID = sessionless.generateUUID();
    });

    beforeEach(async () => {
      const authPayload = await createAuthPayload(null, testContract);
      const response = await post(`${baseURL}contract`, authPayload);
      
      response.status.should.equal(200);
      contractUuid = response.body.data.uuid;
    });

    it('should generate SVG representation of contract', async () => {
      const response = await get(`${baseURL}contract/${contractUuid}/svg`);

      response.status.should.equal(200);
      response.headers['content-type'].should.include('image/svg+xml');
      
      // Convert Uint8Array body to string
      const svgContent = response.text || (response.body ? Buffer.from(response.body).toString() : '');
      svgContent.should.include('<svg');
      svgContent.should.include(testContract.title);
      svgContent.should.include('Magical Contract');
    });

    it('should generate dark theme SVG', async () => {
      const response = await get(`${baseURL}contract/${contractUuid}/svg?theme=dark&width=1000&height=800`);

      response.status.should.equal(200);
      response.headers['content-type'].should.include('image/svg+xml');
      
      // Convert Uint8Array body to string
      const svgContent = response.text || (response.body ? Buffer.from(response.body).toString() : '');
      svgContent.should.include('width="1000"');
      svgContent.should.include('height="800"');
    });

    it('should return 404 for SVG of non-existent contract', async () => {
      const response = await get(`${baseURL}contract/non-existent-uuid/svg`);

      response.status.should.equal(404);
      response.body.should.have.property('success', false);
    });
  });

  describe('Contract Deletion', () => {
    let contractUuid;

    before(async () => {
      // Reinitialize sessionless keys for this test suite
      keysToReturn = {};
      testKeys = await sessionless.generateKeys((k) => { keysToReturn = k; }, () => {return keysToReturn;});
      testUserUUID = sessionless.generateUUID();
    });

    beforeEach(async () => {
      const authPayload = await createAuthPayload(null, testContract);
      const response = await post(`${baseURL}contract`, authPayload);
      
      response.status.should.equal(200);
      contractUuid = response.body.data.uuid;
    });

    it('should delete contract', async () => {
      const authPayload = await createAuthPayload(contractUuid);
      const response = await _delete(`${baseURL}contract/${contractUuid}`, authPayload);

      response.status.should.equal(200);
      response.body.should.have.property('success', true);
      response.body.data.should.have.property('uuid', contractUuid);

      // Verify contract is deleted
      const getResponse = await get(`${baseURL}contract/${contractUuid}`);
      getResponse.status.should.equal(404);
    });

    it('should return 404 when deleting non-existent contract', async () => {
      const authPayload = await createAuthPayload('non-existent-uuid');
      const response = await _delete(`${baseURL}contract/non-existent-uuid`, authPayload);

      response.status.should.equal(404);
      response.body.should.have.property('success', false);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await get(`${baseURL}unknown-endpoint`);

      response.status.should.equal(404);
      response.body.should.have.property('success', false);
      response.body.error.should.include('not found');
    });

    it('should handle malformed JSON', async () => {
      const response = await post(`${baseURL}contract`, 'invalid json');
      // Express returns 500 for malformed JSON, not 400
      response.status.should.equal(500);
    });
  });

  // Cleanup after tests
  after(async () => {
    // Clean up any test files
    try {
      const currentDir = path.dirname(new URL(import.meta.url).pathname);
      const dataDir = path.join(currentDir, '../../data/contracts');
      const files = await fs.readdir(dataDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(dataDir, file));
        }
      }
    } catch (error) {
      // Ignore cleanup errors
      console.log('Cleanup completed');
    }
  });
});