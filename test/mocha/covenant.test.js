const { expect } = require('chai');
const supertest = require('supertest');
const app = require('../../src/server/node/covenant');
const fs = require('fs').promises;
const path = require('path');

describe('Covenant Service', () => {
  let request;
  let testContract;
  
  const testParticipants = [
    'uuid-alice-123456789',
    'uuid-bob-987654321'
  ];
  
  const testSteps = [
    {
      description: 'Complete project proposal',
      magic_spell: { type: 'payment', amount: 100 }
    },
    {
      description: 'Deliver first milestone',
      magic_spell: { type: 'payment', amount: 500 }
    },
    {
      description: 'Final delivery and review'
    }
  ];

  before(() => {
    request = supertest(app);
  });

  beforeEach(() => {
    testContract = {
      title: 'Test Magical Contract',
      description: 'A test contract for automated testing',
      participants: testParticipants,
      steps: testSteps,
      product_uuid: 'test-product-uuid-123'
    };
  });

  describe('Health Check', () => {
    it('should return service health information', async () => {
      const response = await request
        .get('/health')
        .expect(200);

      expect(response.body).to.have.property('service', 'covenant');
      expect(response.body).to.have.property('version', '0.0.1');
      expect(response.body).to.have.property('status', 'healthy');
      expect(response.body).to.have.property('timestamp');
    });
  });

  describe('Contract Creation', () => {
    it('should create a new magical contract', async () => {
      const response = await request
        .post('/contract')
        .send(testContract)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('data');
      
      const contract = response.body.data;
      expect(contract).to.have.property('uuid');
      expect(contract).to.have.property('title', testContract.title);
      expect(contract).to.have.property('participants').that.deep.equals(testParticipants);
      expect(contract).to.have.property('steps').that.has.length(testSteps.length);
      expect(contract).to.have.property('status', 'active');
      expect(contract).to.have.property('created_at');
      expect(contract).to.have.property('updated_at');

      // Check step structure
      contract.steps.forEach((step, index) => {
        expect(step).to.have.property('id');
        expect(step).to.have.property('description', testSteps[index].description);
        expect(step).to.have.property('order', index);
        expect(step).to.have.property('completed', false);
        expect(step).to.have.property('signatures');
        
        // Check signatures initialized for all participants
        testParticipants.forEach(participant => {
          expect(step.signatures).to.have.property(participant, null);
        });
      });

      // Store for other tests
      testContract.uuid = contract.uuid;
    });

    it('should reject contract without title', async () => {
      delete testContract.title;
      
      const response = await request
        .post('/contract')
        .send(testContract)
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error').that.includes('title');
    });

    it('should reject contract with less than 2 participants', async () => {
      testContract.participants = ['single-participant'];
      
      const response = await request
        .post('/contract')
        .send(testContract)
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error').that.includes('2 participants');
    });

    it('should reject contract with no steps', async () => {
      testContract.steps = [];
      
      const response = await request
        .post('/contract')
        .send(testContract)
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error').that.includes('step');
    });
  });

  describe('Contract Retrieval', () => {
    let contractUuid;

    beforeEach(async () => {
      // Create a test contract
      const response = await request
        .post('/contract')
        .send(testContract)
        .expect(200);
      
      contractUuid = response.body.data.uuid;
    });

    it('should retrieve contract by UUID', async () => {
      const response = await request
        .get(`/contract/${contractUuid}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('data');
      
      const contract = response.body.data;
      expect(contract).to.have.property('uuid', contractUuid);
      expect(contract).to.have.property('title', testContract.title);
    });

    it('should return 404 for non-existent contract', async () => {
      const response = await request
        .get('/contract/non-existent-uuid')
        .expect(404);

      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error').that.includes('not found');
    });
  });

  describe('Contract Updates', () => {
    let contractUuid;

    beforeEach(async () => {
      const response = await request
        .post('/contract')
        .send(testContract)
        .expect(200);
      
      contractUuid = response.body.data.uuid;
    });

    it('should update contract title', async () => {
      const updatedTitle = 'Updated Magical Contract';
      
      const response = await request
        .put(`/contract/${contractUuid}`)
        .send({ title: updatedTitle })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('title', updatedTitle);
      expect(response.body.data).to.have.property('updated_at');
    });

    it('should return 404 for updating non-existent contract', async () => {
      const response = await request
        .put('/contract/non-existent-uuid')
        .send({ title: 'New Title' })
        .expect(404);

      expect(response.body).to.have.property('success', false);
    });
  });

  describe('Contract Signing', () => {
    let contractUuid;
    let stepId;

    beforeEach(async () => {
      const response = await request
        .post('/contract')
        .send(testContract)
        .expect(200);
      
      contractUuid = response.body.data.uuid;
      stepId = response.body.data.steps[0].id;
    });

    it('should add signature to contract step', async () => {
      const signatureData = {
        participant_uuid: testParticipants[0],
        step_id: stepId,
        signature: 'test-signature-data',
        timestamp: Date.now(),
        message: 'Signing step completion'
      };

      const response = await request
        .put(`/contract/${contractUuid}/sign`)
        .send(signatureData)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('contract_uuid', contractUuid);
      expect(response.body.data).to.have.property('step_id', stepId);
      expect(response.body.data).to.have.property('step_completed', false); // Only one signature
      expect(response.body.data).to.have.property('magic_triggered', false);
    });

    it('should complete step when all participants sign', async () => {
      // First participant signs
      await request
        .put(`/contract/${contractUuid}/sign`)
        .send({
          participant_uuid: testParticipants[0],
          step_id: stepId,
          signature: 'signature-alice',
          timestamp: Date.now(),
          message: 'Alice signing'
        })
        .expect(200);

      // Second participant signs
      const response = await request
        .put(`/contract/${contractUuid}/sign`)
        .send({
          participant_uuid: testParticipants[1],
          step_id: stepId,
          signature: 'signature-bob',
          timestamp: Date.now(),
          message: 'Bob signing'
        })
        .expect(200);

      expect(response.body.data).to.have.property('step_completed', true);
      expect(response.body.data).to.have.property('magic_triggered', true); // Step has magic spell
    });

    it('should reject signature from non-participant', async () => {
      const response = await request
        .put(`/contract/${contractUuid}/sign`)
        .send({
          participant_uuid: 'unknown-participant',
          step_id: stepId,
          signature: 'invalid-signature',
          timestamp: Date.now()
        })
        .expect(403);

      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error').that.includes('not authorized');
    });

    it('should reject signature for non-existent step', async () => {
      const response = await request
        .put(`/contract/${contractUuid}/sign`)
        .send({
          participant_uuid: testParticipants[0],
          step_id: 'non-existent-step',
          signature: 'test-signature',
          timestamp: Date.now()
        })
        .expect(404);

      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error').that.includes('Step not found');
    });
  });

  describe('Contract Listing', () => {
    let contractUuids = [];

    beforeEach(async () => {
      // Create multiple test contracts
      for (let i = 0; i < 3; i++) {
        const contract = {
          ...testContract,
          title: `Test Contract ${i + 1}`,
          participants: i % 2 === 0 ? testParticipants : ['other-participant-1', 'other-participant-2']
        };

        const response = await request
          .post('/contract')
          .send(contract)
          .expect(200);
        
        contractUuids.push(response.body.data.uuid);
      }
    });

    it('should list all contracts', async () => {
      const response = await request
        .get('/contracts')
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('data').that.is.an('array');
      expect(response.body.data.length).to.be.at.least(3);

      // Check contract summary structure
      const contract = response.body.data[0];
      expect(contract).to.have.property('uuid');
      expect(contract).to.have.property('title');
      expect(contract).to.have.property('participants');
      expect(contract).to.have.property('step_count');
      expect(contract).to.have.property('completed_steps');
    });

    it('should filter contracts by participant', async () => {
      const response = await request
        .get(`/contracts?participant=${testParticipants[0]}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.be.an('array');
      
      // Should only return contracts where testParticipants[0] is involved
      response.body.data.forEach(contract => {
        expect(contract.participants).to.include(testParticipants[0]);
      });
    });
  });

  describe('SVG Generation', () => {
    let contractUuid;

    beforeEach(async () => {
      const response = await request
        .post('/contract')
        .send(testContract)
        .expect(200);
      
      contractUuid = response.body.data.uuid;
    });

    it('should generate SVG representation of contract', async () => {
      const response = await request
        .get(`/contract/${contractUuid}/svg`)
        .expect(200);

      expect(response.headers['content-type']).to.include('image/svg+xml');
      expect(response.text).to.include('<svg');
      expect(response.text).to.include(testContract.title);
      expect(response.text).to.include('Magical Contract');
    });

    it('should generate dark theme SVG', async () => {
      const response = await request
        .get(`/contract/${contractUuid}/svg?theme=dark&width=1000&height=800`)
        .expect(200);

      expect(response.headers['content-type']).to.include('image/svg+xml');
      expect(response.text).to.include('width="1000"');
      expect(response.text).to.include('height="800"');
    });

    it('should return 404 for SVG of non-existent contract', async () => {
      const response = await request
        .get('/contract/non-existent-uuid/svg')
        .expect(404);

      expect(response.body).to.have.property('success', false);
    });
  });

  describe('Contract Deletion', () => {
    let contractUuid;

    beforeEach(async () => {
      const response = await request
        .post('/contract')
        .send(testContract)
        .expect(200);
      
      contractUuid = response.body.data.uuid;
    });

    it('should delete contract', async () => {
      const response = await request
        .delete(`/contract/${contractUuid}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('uuid', contractUuid);

      // Verify contract is deleted
      await request
        .get(`/contract/${contractUuid}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent contract', async () => {
      const response = await request
        .delete('/contract/non-existent-uuid')
        .expect(404);

      expect(response.body).to.have.property('success', false);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await request
        .get('/unknown-endpoint')
        .expect(404);

      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error').that.includes('not found');
    });

    it('should handle malformed JSON', async () => {
      const response = await request
        .post('/contract')
        .send('invalid json')
        .expect(400);
    });
  });

  // Cleanup after tests
  after(async () => {
    // Clean up any test files
    try {
      const dataDir = path.join(__dirname, '../../data/contracts');
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