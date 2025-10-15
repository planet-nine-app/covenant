import sessionless from 'sessionless-node';
import fetch from 'node-fetch';

const COVENANT_URL = process.env.COVENANT_URL || 'http://127.0.0.1:3011/';
const FOUNT_URL = process.env.FOUNT_URL || 'http://127.0.0.1:3006/';

const MAGIC = {
  /**
   * purchaseLesson - Creates a SODOTO contract for a lesson purchase
   *
   * Expected spell components:
   * - teacherPubKey: Teacher's public key (participant 1)
   * - studentPubKey: Student's public key (participant 2)
   * - lessonBdoPubKey: BDO UUID of the lesson being purchased
   * - lessonTitle: Title of the lesson
   * - price: Price in cents
   */
  purchaseLesson: async (spell) => {
    try {
      console.log('🪄 Covenant resolving purchaseLesson spell');

      const {
        teacherPubKey,
        studentPubKey,
        lessonBdoPubKey,
        lessonTitle,
        price,
        studentUUID,
        contractSignature
      } = spell.components;

      if (!teacherPubKey || !studentPubKey || !lessonBdoPubKey || !studentUUID || !contractSignature) {
        return {
          success: false,
          error: 'Missing required spell components: teacherPubKey, studentPubKey, lessonBdoPubKey, studentUUID, contractSignature'
        };
      }

      // Create contract data
      const contractData = {
        title: `Lesson: ${lessonTitle || 'Untitled Lesson'}`,
        description: `Purchase contract for ${lessonTitle || 'lesson'}`,
        participants: [teacherPubKey, studentPubKey],
        steps: [
          {
            description: 'Lesson Acquired',
          },
          {
            description: 'See One',
          },
          {
            description: 'Do One',
          },
          {
            description: 'Teach One',
          },
          {
            description: 'Grant Nineum Permission',
          }
        ],
        product_uuid: lessonBdoPubKey,
        bdo_location: lessonBdoPubKey,

        // Sessionless auth - using the pre-signed contract signature from spell components
        signature: contractSignature,
        timestamp: String(spell.timestamp), // Ensure timestamp is string
        userUUID: studentUUID,
        pubKey: studentPubKey // Student is creating the contract
      };

      // Debug logging
      console.log(`\n🔍 Contract creation debug:`);
      console.log(`Message for verification: "${String(spell.timestamp)}${studentUUID}"`);
      console.log(`Signature: ${contractSignature}`);
      console.log(`PubKey: ${studentPubKey}`);

      // Call Covenant's POST /contract endpoint
      const response = await fetch(`${COVENANT_URL}contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractData)
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Covenant contract creation failed:', error);
        return {
          success: false,
          error: `Contract creation failed: ${error}`
        };
      }

      const result = await response.json();

      console.log('✅ Contract created:', result.data?.uuid);

      return {
        success: true,
        contractUuid: result.contractUuid || result.data?.uuid,
        bdoPubKey: result.bdoPubKey || result.data?.pubKey,
        contract: result.data
      };

    } catch (error) {
      console.error('❌ purchaseLesson spell failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * covenantUserCreate - Create a Covenant user
   *
   * Expected spell components:
   * - pubKey: User's public key
   */
  covenantUserCreate: async (spell) => {
    try {
      console.log('🪄 Covenant resolving covenantUserCreate spell');

      const { pubKey } = spell.components;

      if (!pubKey) {
        return {
          success: false,
          error: 'Missing required spell component: pubKey'
        };
      }

      // Call Covenant's PUT /user/create endpoint
      const response = await fetch(`${COVENANT_URL}user/create`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubKey: pubKey,
          timestamp: String(spell.timestamp),
          signature: spell.casterSignature
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Covenant user creation failed:', error);
        return {
          success: false,
          error: `User creation failed: ${error}`
        };
      }

      const result = await response.json();

      console.log('✅ User created:', result.user?.uuid);

      return {
        success: true,
        user: result.user
      };

    } catch (error) {
      console.error('❌ covenantUserCreate spell failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * covenantContract - Create a new magical contract
   *
   * Expected spell components:
   * - title: Contract title
   * - description: Contract description (optional)
   * - participants: Array of participant pubKeys
   * - steps: Array of step objects with description
   * - userUUID: UUID of the creator
   * - pubKey: Public key of the creator
   * - product_uuid: Product UUID (optional)
   * - bdo_location: BDO location (optional)
   */
  covenantContract: async (spell) => {
    try {
      console.log('🪄 Covenant resolving covenantContract spell');

      const {
        title,
        description,
        participants,
        steps,
        userUUID,
        pubKey,
        product_uuid,
        bdo_location
      } = spell.components;

      if (!title || !participants || !steps || !userUUID || !pubKey) {
        return {
          success: false,
          error: 'Missing required spell components: title, participants, steps, userUUID, pubKey'
        };
      }

      // Call Covenant's POST /contract endpoint
      const response = await fetch(`${COVENANT_URL}contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          participants,
          steps,
          product_uuid,
          bdo_location,
          signature: spell.casterSignature,
          timestamp: String(spell.timestamp),
          userUUID,
          pubKey
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Covenant contract creation failed:', error);
        return {
          success: false,
          error: `Contract creation failed: ${error}`
        };
      }

      const result = await response.json();

      console.log('✅ Contract created:', result.contractUuid);

      return {
        success: true,
        contractUuid: result.contractUuid,
        bdoPubKey: result.bdoPubKey,
        data: result.data
      };

    } catch (error) {
      console.error('❌ covenantContract spell failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * covenantContractUpdate - Update a contract
   *
   * Expected spell components:
   * - uuid: Contract UUID
   * - userUUID: UUID of the updater
   * - pubKey: Public key of the updater
   * - title: New title (optional)
   * - description: New description (optional)
   * - steps: New steps array (optional)
   * - status: New status (optional)
   */
  covenantContractUpdate: async (spell) => {
    try {
      console.log('🪄 Covenant resolving covenantContractUpdate spell');

      const {
        uuid,
        userUUID,
        pubKey,
        title,
        description,
        steps,
        status
      } = spell.components;

      if (!uuid || !userUUID || !pubKey) {
        return {
          success: false,
          error: 'Missing required spell components: uuid, userUUID, pubKey'
        };
      }

      const updateData = {
        signature: spell.casterSignature,
        timestamp: String(spell.timestamp),
        userUUID,
        pubKey
      };

      // Add optional fields if provided
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (steps !== undefined) updateData.steps = steps;
      if (status !== undefined) updateData.status = status;

      // Call Covenant's PUT /contract/:uuid endpoint
      const response = await fetch(`${COVENANT_URL}contract/${uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Covenant contract update failed:', error);
        return {
          success: false,
          error: `Contract update failed: ${error}`
        };
      }

      const result = await response.json();

      console.log('✅ Contract updated:', uuid);

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      console.error('❌ covenantContractUpdate spell failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * covenantContractSign - Sign a contract step
   *
   * Expected spell components:
   * - uuid: Contract UUID
   * - stepId: ID of the step to sign
   * - stepSignature: Pre-signed signature for the step
   * - userUUID: UUID of the signer
   * - pubKey: Public key of the signer
   */
  covenantContractSign: async (spell) => {
    try {
      console.log('🪄 Covenant resolving covenantContractSign spell');

      const {
        uuid,
        stepId,
        stepSignature,
        userUUID,
        pubKey
      } = spell.components;

      if (!uuid || !stepId || !stepSignature || !userUUID || !pubKey) {
        return {
          success: false,
          error: 'Missing required spell components: uuid, stepId, stepSignature, userUUID, pubKey'
        };
      }

      // Call Covenant's PUT /contract/:uuid/sign endpoint
      const response = await fetch(`${COVENANT_URL}contract/${uuid}/sign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          stepSignature,
          signature: spell.casterSignature,
          timestamp: String(spell.timestamp),
          userUUID,
          pubKey
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Covenant contract sign failed:', error);
        return {
          success: false,
          error: `Contract sign failed: ${error}`
        };
      }

      const result = await response.json();

      console.log('✅ Contract step signed:', uuid, stepId);

      return {
        success: true,
        contractUuid: result.contractUuid,
        bdoPubKey: result.bdoPubKey,
        data: result.data
      };

    } catch (error) {
      console.error('❌ covenantContractSign spell failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * covenantContractDelete - Delete a contract
   *
   * Expected spell components:
   * - uuid: Contract UUID
   * - userUUID: UUID of the deleter
   * - pubKey: Public key of the deleter (must be creator)
   */
  covenantContractDelete: async (spell) => {
    try {
      console.log('🪄 Covenant resolving covenantContractDelete spell');

      const {
        uuid,
        userUUID,
        pubKey
      } = spell.components;

      if (!uuid || !userUUID || !pubKey) {
        return {
          success: false,
          error: 'Missing required spell components: uuid, userUUID, pubKey'
        };
      }

      // Call Covenant's DELETE /contract/:uuid endpoint
      const response = await fetch(`${COVENANT_URL}contract/${uuid}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: spell.casterSignature,
          timestamp: String(spell.timestamp),
          userUUID,
          pubKey
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Covenant contract delete failed:', error);
        return {
          success: false,
          error: `Contract delete failed: ${error}`
        };
      }

      const result = await response.json();

      console.log('✅ Contract deleted:', uuid);

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      console.error('❌ covenantContractDelete spell failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Gateway function for spell forwarding
   */
  gatewayForSpell: async (spellName, covenantUser) => {
    const gateway = {
      timestamp: new Date().getTime() + '',
      uuid: covenantUser.fountUUID,
      minimumCost: 0, // Covenant doesn't charge for contract creation
      ordinal: covenantUser.ordinal || 0
    };

    const message = gateway.timestamp + gateway.uuid + gateway.minimumCost + gateway.ordinal;
    gateway.signature = await sessionless.sign(message);

    return gateway;
  },

  /**
   * Forward spell to next destination
   */
  forwardSpell: async (spell, destination) => {
    return await fetch(destination, {
      method: 'post',
      body: JSON.stringify(spell),
      headers: {'Content-Type': 'application/json'}
    });
  }
};

export default MAGIC;
