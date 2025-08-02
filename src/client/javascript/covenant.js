/**
 * Covenant JavaScript Client SDK
 * For interacting with magical contract management service
 */

class CovenantClient {
  constructor(baseUrl, sessionless, keys = null) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.sessionless = sessionless;
    this.userUUID = null;
    this.pubKey = keys ? keys.pubKey : null;
  }
  
  // Set user UUID (required for authentication)
  setUserUUID(userUUID) {
    this.userUUID = userUUID;
  }
  
  // Helper to create authenticated payload
  async createAuthenticatedPayload(contractUUID = null, additionalData = {}) {
    if (!this.sessionless || !this.userUUID || !this.pubKey) {
      throw new Error('Sessionless authentication not properly initialized. Call setUserUUID() and ensure sessionless has keys.');
    }
    
    const timestamp = new Date().getTime() + '';
    const message = contractUUID 
      ? timestamp + this.userUUID + contractUUID
      : timestamp + this.userUUID;
    
    const signature = await this.sessionless.sign(message);
    
    return {
      signature,
      timestamp,
      userUUID: this.userUUID,
      pubKey: this.pubKey,
      ...additionalData
    };
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  // Create new magical contract
  async createContract(contractData) {
    try {
      const authPayload = await this.createAuthenticatedPayload(null, {
        title: contractData.title,
        description: contractData.description || '',
        participants: contractData.participants || [],
        steps: contractData.steps || [],
        productUuid: contractData.productUuid || null,
        bdoLocation: contractData.bdoLocation || null
      });

      const response = await fetch(`${this.baseUrl}/contract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authPayload)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create contract');
      }

      return data;
    } catch (error) {
      throw new Error(`Create contract failed: ${error.message}`);
    }
  }

  // Get contract by UUID
  async getContract(uuid) {
    try {
      const response = await fetch(`${this.baseUrl}/contract/${uuid}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get contract');
      }

      return data;
    } catch (error) {
      throw new Error(`Get contract failed: ${error.message}`);
    }
  }

  // Update contract
  async updateContract(uuid, updates) {
    try {
      const authPayload = await this.createAuthenticatedPayload(uuid, updates);

      const response = await fetch(`${this.baseUrl}/contract/${uuid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authPayload)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update contract');
      }

      return data;
    } catch (error) {
      throw new Error(`Update contract failed: ${error.message}`);
    }
  }

  // Sign a contract step
  async signStep(contractUuid, stepId, message = '') {
    try {
      if (!this.sessionless) {
        throw new Error('Sessionless instance required for signing');
      }

      // Create the main authentication payload
      const authPayload = await this.createAuthenticatedPayload(contractUuid);
      
      // Create step signature - timestamp + userUUID + contractUUID + stepId
      const stepMessage = authPayload.timestamp + authPayload.userUUID + contractUuid + stepId;
      const stepSignature = await this.sessionless.sign(stepMessage);
      
      // Add step-specific data
      authPayload.stepId = stepId;
      authPayload.stepSignature = stepSignature;

      const response = await fetch(`${this.baseUrl}/contract/${contractUuid}/sign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authPayload)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign step');
      }

      return data;
    } catch (error) {
      throw new Error(`Sign step failed: ${error.message}`);
    }
  }

  // List contracts (optionally filtered by participant)
  async listContracts(participantUuid = null) {
    try {
      let url = `${this.baseUrl}/contracts`;
      if (participantUuid) {
        url += `?participant=${encodeURIComponent(participantUuid)}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to list contracts');
      }

      return data;
    } catch (error) {
      throw new Error(`List contracts failed: ${error.message}`);
    }
  }

  // Get contracts for current user (requires sessionless)
  async getMyContracts() {
    if (!this.sessionless) {
      throw new Error('Sessionless instance required to get user contracts');
    }
    
    return this.listContracts(this.sessionless.uuid);
  }

  // Delete contract
  async deleteContract(uuid) {
    try {
      const authPayload = await this.createAuthenticatedPayload(uuid);

      const response = await fetch(`${this.baseUrl}/contract/${uuid}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authPayload)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete contract');
      }

      return data;
    } catch (error) {
      throw new Error(`Delete contract failed: ${error.message}`);
    }
  }

  // Get contract as SVG
  async getContractSVG(uuid, options = {}) {
    try {
      const { theme = 'light', width = 800, height = 600 } = options;
      const params = new URLSearchParams({
        theme,
        width: width.toString(),
        height: height.toString()
      });

      const response = await fetch(`${this.baseUrl}/contract/${uuid}/svg?${params}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get contract SVG');
      }

      return await response.text();
    } catch (error) {
      throw new Error(`Get contract SVG failed: ${error.message}`);
    }
  }

  // Helper: Create contract with steps from simple format
  createContractWithSteps({ title, description, participants, stepDescriptions, productUuid = null }) {
    const steps = stepDescriptions.map((desc, index) => ({
      id: `step-${index + 1}`,
      description: desc,
      magicSpell: null // Can be added later
    }));

    return this.createContract({
      title,
      description,
      participants,
      steps,
      productUuid: productUuid
    });
  }

  // Helper: Add MAGIC spell to step
  async addMagicSpell(contractUuid, stepId, magicSpell) {
    try {
      // Get current contract
      const contractResult = await this.getContract(contractUuid);
      const contract = contractResult.data;

      // Find and update the step
      const step = contract.steps.find(s => s.id === stepId);
      if (!step) {
        throw new Error(`Step ${stepId} not found`);
      }

      step.magicSpell = magicSpell;

      // Update contract
      return await this.updateContract(contractUuid, { steps: contract.steps });
    } catch (error) {
      throw new Error(`Add magic spell failed: ${error.message}`);
    }
  }

  // Helper: Check if step is fully signed
  isStepComplete(step, participantCount) {
    const signatureCount = Object.values(step.signatures || {}).filter(sig => sig !== null).length;
    return signatureCount >= participantCount;
  }

  // Helper: Get contract progress
  getContractProgress(contract) {
    const totalSteps = contract.steps.length;
    const completedSteps = contract.steps.filter(step => step.completed).length;
    const participantCount = contract.participants.length;

    return {
      totalSteps,
      completedSteps,
      progressPercent: totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0,
      participantCount,
      isComplete: completedSteps === totalSteps
    };
  }

  // Helper: Get user's signature status for contract
  getUserSignatureStatus(contract, userUuid) {
    if (!userUuid) {
      userUuid = this.sessionless?.uuid;
    }

    if (!userUuid) {
      throw new Error('User UUID required');
    }

    return contract.steps.map(step => ({
      stepId: step.id,
      description: step.description,
      hasSigned: !!(step.signatures[userUuid]),
      signatureTimestamp: step.signatures[userUuid]?.timestamp || null,
      isCompleted: step.completed
    }));
  }
}

// Export for different environments
export default CovenantClient;

// Also support CommonJS for backwards compatibility
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = CovenantClient;
} else if (typeof window !== 'undefined') {
  // Browser environment
  window.CovenantClient = CovenantClient;
}