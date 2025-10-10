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
            description: 'Payment Completed',
          },
          {
            description: 'Grant Lesson Access',
          },
          {
            description: 'Complete Lesson',
          },
          {
            description: 'Verify Completion',
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
        contractUuid: result.data?.uuid,
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
