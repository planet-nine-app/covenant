#!/usr/bin/env node

import sessionless from '../../../sessionless/src/javascript/node/index.js';
import fetch from 'node-fetch';

// Create a test user (participant) to sign a step
async function signTestStep() {
  try {
    // Create test user keys
    const keys = sessionless.generateKeys();
    console.log('🔑 Generated test user:');
    console.log('UUID:', keys.uuid);
    console.log('PubKey:', keys.pubKey);
    
    // Update contract to include this user as participant
    const contractUuid = '144f602d-75ab-473c-9c55-b29bf2defee0';
    const stepId = '132df700-fdbf-4ac9-85f5-649c0326e550'; // First step ID
    
    // First, get the current contract
    console.log('\n📋 Getting current contract...');
    const contractResponse = await fetch(`http://localhost:3011/contract/${contractUuid}`);
    const contractData = await contractResponse.json();
    
    if (!contractData.success) {
      throw new Error(`Failed to get contract: ${contractData.error}`);
    }
    
    const contract = contractData.data;
    console.log('✅ Got contract:', contract.title);
    console.log('📋 Current participants:', contract.participants);
    
    // Replace first participant with our test user
    const updatedParticipants = [keys.uuid, contract.participants[1]];
    console.log('📝 Updated participants:', updatedParticipants);
    
    // Update contract participants
    console.log('\n🔄 Updating contract participants...');
    const timestamp = Date.now().toString();
    const updateMessage = timestamp + keys.uuid + contractUuid;
    const updateSignature = sessionless.sign(updateMessage, keys.privateKey);
    
    const updateResponse = await fetch(`http://localhost:3011/contract/${contractUuid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: contract.title,
        description: contract.description,
        participants: updatedParticipants,
        timestamp,
        userUUID: keys.uuid,
        pubKey: keys.pubKey,
        signature: updateSignature
      })
    });
    
    const updateResult = await updateResponse.json();
    if (!updateResult.success) {
      throw new Error(`Failed to update contract: ${updateResult.error}`);
    }
    
    console.log('✅ Contract participants updated');
    
    // Now sign the step
    console.log('\n✍️ Signing contract step...');
    const stepMessage = timestamp + keys.uuid + contractUuid + stepId;
    const stepSignature = sessionless.sign(stepMessage, keys.privateKey);
    
    const signResponse = await fetch(`http://localhost:3011/contract/${contractUuid}/sign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stepId,
        stepSignature,
        timestamp,
        userUUID: keys.uuid,
        pubKey: keys.pubKey,
        signature: updateSignature
      })
    });
    
    const signResult = await signResponse.json();
    if (!signResult.success) {
      throw new Error(`Failed to sign step: ${signResult.error}`);
    }
    
    console.log('✅ Step signed successfully!');
    console.log('📊 Step completed:', signResult.data.stepCompleted);
    
    // Get updated SVG to verify pubKey embedding
    console.log('\n🎨 Getting updated SVG...');
    const svgResponse = await fetch(`http://localhost:3011/contract/${contractUuid}/svg`);
    const svgContent = await svgResponse.text();
    
    // Check if pubKey is embedded
    if (svgContent.includes('data-contract-participants')) {
      const match = svgContent.match(/data-contract-participants='([^']+)'/);
      if (match) {
        const participants = JSON.parse(match[1]);
        console.log('✅ PubKeys embedded in SVG:');
        participants.forEach((pubKey, i) => {
          console.log(`  Participant ${i + 1}: ${pubKey}`);
          if (pubKey === keys.pubKey) {
            console.log('    🎯 ^ This matches our test user!');
          }
        });
      }
    } else {
      console.log('❌ No participant pubKeys found in SVG');
    }
    
    console.log('\n🎉 Test completed! User pubKey should now be embedded in contract SVG.');
    console.log('🌐 Test the authorization at: file:///Users/zachbabb/Work/planet-nine/covenant/demo/pubkey-authorization-test.html');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

signTestStep();