import { should } from 'chai';
should();
import sessionless from 'sessionless-node';
import CovenantClient from '../../src/client/javascript/covenant.js';

const baseURL = process.env.SUB_DOMAIN ? `https://${process.env.SUB_DOMAIN}.covenant.allyabase.com/` : 'http://127.0.0.1:3011/';

describe('Covenant JavaScript Client SDK', () => {
  let client;
  let testKeys;
  let testUserUUID;
  let keysToReturn = {};
  let createdContractUuid;

  before(async () => {
    // Generate test keys for sessionless authentication
    testKeys = await sessionless.generateKeys((k) => { keysToReturn = k; }, () => {return keysToReturn;});
    testUserUUID = sessionless.generateUUID();
    
    // Create client instance with keys
    client = new CovenantClient(baseURL, sessionless, testKeys);
    client.setUserUUID(testUserUUID);
  });

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      const health = await client.healthCheck();
      
      health.should.have.property('service', 'covenant');
      health.should.have.property('version', '0.0.1');
      health.should.have.property('status', 'healthy');
      health.should.have.property('timestamp');
    });
  });

  describe('Contract Creation', () => {
    it('should create a new contract successfully', async () => {
      const contractData = {
        title: 'SDK Test Contract',
        description: 'A test contract created via the JavaScript SDK',
        participants: ['02a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890', '03b2c3d4e5f6789012345678901234567890123456789012345678901234567890ab', testKeys.pubKey],
        steps: [
          {
            id: 'step-1',
            description: 'Complete initial setup',
            magicSpell: { type: 'payment', amount: 100 }
          },
          {
            id: 'step-2', 
            description: 'Deliver milestone',
            magicSpell: { type: 'payment', amount: 500 }
          }
        ],
        productUuid: 'test-product-123'
      };

      const result = await client.createContract(contractData);
      
      result.should.have.property('success', true);
      result.should.have.property('data');
      
      const contract = result.data;
      contract.should.have.property('uuid');
      contract.should.have.property('title', contractData.title);
      contract.should.have.property('description', contractData.description);
      contract.participants.should.deep.equal(contractData.participants);
      contract.steps.should.have.length(2);
      contract.should.have.property('status', 'active');
      
      // Store for later tests
      createdContractUuid = contract.uuid;
    });

    it('should use helper method to create contract with steps', async () => {
      const contractParams = {
        title: 'Helper Method Contract',
        description: 'Created using the helper method',
        participants: ['02c4d5e6f7890123456789012345678901234567890123456789012345678901234', '03d5e6f7890123456789012345678901234567890123456789012345678901234ab', testKeys.pubKey],
        stepDescriptions: [
          'Step one description',
          'Step two description',
          'Final step description'
        ]
      };

      const result = await client.createContractWithSteps(contractParams);
      
      result.should.have.property('success', true);
      result.data.should.have.property('title', contractParams.title);
      result.data.steps.should.have.length(3);
      result.data.steps[0].should.have.property('description', 'Step one description');
    });

    it('should reject contract creation without required fields', async () => {
      try {
        await client.createContract({
          // Missing title
          participants: ['02e6f7890123456789012345678901234567890123456789012345678901234567', '03f7890123456789012345678901234567890123456789012345678901234567ab'],
          steps: [{ description: 'Test step' }]
        });
        // Should not reach here
        true.should.equal(false, 'Expected error was not thrown');
      } catch (error) {
        error.message.should.include('title');
      }
    });
  });

  describe('Contract Retrieval', () => {
    it('should retrieve contract by UUID', async () => {
      const result = await client.getContract(createdContractUuid);
      
      result.should.have.property('success', true);
      result.should.have.property('data');
      
      const contract = result.data;
      contract.should.have.property('uuid', createdContractUuid);
      contract.should.have.property('title', 'SDK Test Contract');
    });

    it('should handle non-existent contract gracefully', async () => {
      try {
        await client.getContract('non-existent-uuid');
        // Should not reach here
        true.should.equal(false, 'Expected error was not thrown');
      } catch (error) {
        error.message.should.include('not found');
      }
    });
  });

  describe('Contract Updates', () => {
    it('should update contract title', async () => {
      const newTitle = 'Updated SDK Test Contract';
      const result = await client.updateContract(createdContractUuid, {
        title: newTitle
      });
      
      result.should.have.property('success', true);
      result.data.should.have.property('title', newTitle);
      result.data.should.have.property('updatedAt');
    });
  });

  describe('Contract Listing', () => {
    it('should list all contracts', async () => {
      const result = await client.listContracts();
      
      result.should.have.property('success', true);
      result.should.have.property('data');
      result.data.should.be.an('array');
      result.data.length.should.be.at.least(1);
      
      // Check contract summary structure
      const contractSummary = result.data[0];
      contractSummary.should.have.property('uuid');
      contractSummary.should.have.property('title');
      contractSummary.should.have.property('participants');
      contractSummary.should.have.property('stepCount');
      contractSummary.should.have.property('completedSteps');
    });

    it('should filter contracts by participant', async () => {
      const result = await client.listContracts(testKeys.pubKey);
      
      result.should.have.property('success', true);
      result.data.should.be.an('array');
      
      // All contracts should include our test user's public key
      result.data.forEach(contract => {
        contract.participants.should.include(testKeys.pubKey);
      });
    });
  });

  describe('Contract Signing', () => {
    let contractForSigning;
    let stepId;

    beforeEach(async () => {
      // Create a fresh contract for signing tests
      const contractData = {
        title: 'Signing Test Contract',
        description: 'Contract for testing signature functionality',
        participants: ['02c1d2e3f4567890123456789012345678901234567890123456789012345678901', '03d2e3f4567890123456789012345678901234567890123456789012345678901ab', testKeys.pubKey],
        steps: [
          {
            id: 'signing-step-1',
            description: 'First step to sign'
          }
        ]
      };

      const result = await client.createContract(contractData);
      contractForSigning = result.data;
      stepId = contractForSigning.steps[0].id;
    });

    it('should add signature to contract step', async () => {
      const result = await client.signStep(contractForSigning.uuid, stepId);
      
      result.should.have.property('success', true);
      result.should.have.property('data');
      
      const signResult = result.data;
      signResult.should.have.property('contractUuid', contractForSigning.uuid);
      signResult.should.have.property('stepId', stepId);
      signResult.should.have.property('stepCompleted'); // May be true or false depending on required signatures
      signResult.should.have.property('magicTriggered');
    });

    it('should handle signing non-existent step', async () => {
      try {
        await client.signStep(contractForSigning.uuid, 'non-existent-step');
        // Should not reach here
        true.should.equal(false, 'Expected error was not thrown');
      } catch (error) {
        error.message.should.include('Step not found');
      }
    });
  });

  describe('SVG Generation', () => {
    it('should generate SVG representation of contract', async () => {
      const svg = await client.getContractSVG(createdContractUuid);
      
      svg.should.be.a('string');
      svg.should.include('<svg');
      svg.should.include('SDK Test Contract');
      svg.should.include('Magical Contract');
    });

    it('should generate SVG with custom options', async () => {
      const svg = await client.getContractSVG(createdContractUuid, {
        theme: 'dark',
        width: 1000,
        height: 800
      });
      
      svg.should.be.a('string');
      svg.should.include('<svg');
      svg.should.include('width="1000"');
      svg.should.include('height="800"');
    });

    it('should handle SVG generation for non-existent contract', async () => {
      try {
        await client.getContractSVG('non-existent-uuid');
        // Should not reach here
        true.should.equal(false, 'Expected error was not thrown');
      } catch (error) {
        error.message.should.include('not found');
      }
    });
  });

  describe('Helper Methods', () => {
    it('should calculate contract progress correctly', async () => {
      const contractResult = await client.getContract(createdContractUuid);
      const contract = contractResult.data;
      
      const progress = client.getContractProgress(contract);
      
      progress.should.have.property('totalSteps');
      progress.should.have.property('completedSteps');
      progress.should.have.property('progressPercent');
      progress.should.have.property('participantCount');
      progress.should.have.property('isComplete');
      
      progress.totalSteps.should.equal(contract.steps.length);
      progress.participantCount.should.equal(contract.participants.length);
      progress.progressPercent.should.be.at.least(0);
      progress.progressPercent.should.be.at.most(100);
    });

    it('should get user signature status', async () => {
      const contractResult = await client.getContract(createdContractUuid);
      const contract = contractResult.data;
      
      const signatureStatus = client.getUserSignatureStatus(contract, testKeys.pubKey);
      
      signatureStatus.should.be.an('array');
      signatureStatus.should.have.length(contract.steps.length);
      
      signatureStatus.forEach(status => {
        status.should.have.property('stepId');
        status.should.have.property('description');
        status.should.have.property('hasSigned');
        status.should.have.property('signatureTimestamp');
        status.should.have.property('isCompleted');
      });
    });

    it('should add magic spell to step', async () => {
      const contractResult = await client.getContract(createdContractUuid);
      const contract = contractResult.data;
      const stepId = contract.steps[0].id;
      
      const magicSpell = {
        type: 'reward',
        amount: 250,
        currency: 'MP'
      };

      const result = await client.addMagicSpell(createdContractUuid, stepId, magicSpell);
      
      result.should.have.property('success', true);
      
      // Verify the magic spell was added
      const updatedContractResult = await client.getContract(createdContractUuid);
      const updatedStep = updatedContractResult.data.steps.find(s => s.id === stepId);
      updatedStep.should.have.property('magicSpell');
      updatedStep.magicSpell.should.deep.equal(magicSpell);
    });
  });

  describe('Contract Deletion', () => {
    let contractToDelete;

    beforeEach(async () => {
      // Create a contract specifically for deletion testing
      const contractData = {
        title: 'Contract to Delete',
        description: 'This contract will be deleted in the test',
        participants: ['02f78901234567890123456789012345678901234567890123456789012345678', testKeys.pubKey],
        steps: [
          { 
            id: 'delete-step-1',
            description: 'Step in contract to be deleted' 
          }
        ]
      };

      const result = await client.createContract(contractData);
      contractToDelete = result.data;
    });

    it('should delete contract successfully', async () => {
      const result = await client.deleteContract(contractToDelete.uuid);
      
      result.should.have.property('success', true);
      result.data.should.have.property('uuid', contractToDelete.uuid);
      
      // Verify contract is deleted
      try {
        await client.getContract(contractToDelete.uuid);
        // Should not reach here
        true.should.equal(false, 'Contract should have been deleted');
      } catch (error) {
        error.message.should.include('not found');
      }
    });

    it('should handle deletion of non-existent contract', async () => {
      try {
        await client.deleteContract('non-existent-uuid');
        // Should not reach here
        true.should.equal(false, 'Expected error was not thrown');
      } catch (error) {
        error.message.should.include('not found');
      }
    });
  });

  describe('Authentication Requirements', () => {
    it('should require sessionless authentication for authenticated endpoints', async () => {
      const unauthenticatedClient = new CovenantClient(baseURL, null);
      
      try {
        await unauthenticatedClient.createContract({
          title: 'Test',
          participants: ['02890123456789012345678901234567890123456789012345678901234567890', '03901234567890123456789012345678901234567890123456789012345678901ab'],
          steps: [{ description: 'Test step' }]
        });
        // Should not reach here
        true.should.equal(false, 'Expected authentication error');
      } catch (error) {
        error.message.should.include('Sessionless authentication not properly initialized');
      }
    });

    it('should require userUUID to be set', async () => {
      const clientWithoutUUID = new CovenantClient(baseURL, sessionless);
      // Don't set userUUID
      
      try {
        await clientWithoutUUID.createContract({
          title: 'Test',
          participants: ['02a12345678901234567890123456789012345678901234567890123456789012', '03b12345678901234567890123456789012345678901234567890123456789012ab'],
          steps: [{ description: 'Test step' }]
        });
        // Should not reach here
        true.should.equal(false, 'Expected authentication error');
      } catch (error) {
        error.message.should.include('Sessionless authentication not properly initialized');
      }
    });
  });

  // Cleanup after tests
  after(async () => {
    // Clean up created contracts
    try {
      if (createdContractUuid) {
        await client.deleteContract(createdContractUuid);
      }
    } catch (error) {
      // Ignore cleanup errors
      console.log('Cleanup completed');
    }
  });
});