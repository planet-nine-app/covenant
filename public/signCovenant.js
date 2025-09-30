/**
 * signCovenant - Interactive covenant contract signing system for web pages
 * 
 * This file provides contract signing functionality for any web page,
 * including authorization checks and cryptographic signature handling.
 * 
 * Served from covenant/public/ to make it available as a public endpoint.
 * 
 * Usage:
 * - Include this script on any web page: <script src="http://your-covenant-server/signCovenant.js"></script>
 * - Add covenant spell attributes to elements: <button spell="covenant" spell-components='{"contractUuid": "...", "stepId": "..."}' />
 * - Elements with covenant spell attributes will become interactive automatically
 * 
 * Covenant Bridge Interface:
 * For actual covenant signing (vs simulation), provide a bridge object:
 * 
 * window.covenantBridge = {
 *   getUserPublicKey: async () => {
 *     // Get current user's public key
 *     // Return: { success: true, publicKey: "..." } or { success: false, error: "..." }
 *   },
 *   signContractStep: async (contractUuid, stepId) => {
 *     // Sign a contract step with user's keys
 *     // Return: { success: true, data: signResult } or { success: false, error: "..." }
 *   }
 * };
 * 
 * The bridge handles:
 * - Cryptographic key access for signing
 * - Authentication with covenant service
 * - Step signing requests
 * - Error handling for network/auth failures
 */

(function() {
    'use strict';
    
    console.log('📜 signCovenant.js loaded - Interactive covenant signing system ready');
    
    // ========================================
    // Authorization and PubKey Management
    // ========================================
    
    /**
     * Get current user's public key via bridge
     * @returns {Promise<string|null>} User's public key or null if not available
     */
    async function getUserPublicKey() {
        try {
            // Check if covenant bridge is available
            if (window.covenantBridge && typeof window.covenantBridge.getUserPublicKey === 'function') {
                const result = await window.covenantBridge.getUserPublicKey();
                if (result && result.success) {
                    return result.publicKey;
                }
            }
            
            // Fallback to extension APIs
            if (window.AdvancementExtension && window.AdvancementExtension.sessionless) {
                const address = await window.AdvancementExtension.sessionless.getAddress();
                return address.address;
            }
            
            console.warn('❌ No covenant bridge or extension API available for pubKey');
            return null;
            
        } catch (error) {
            console.error('❌ Error getting user public key:', error);
            return null;
        }
    }
    
    /**
     * Check if user is authorized to sign a covenant contract
     * @param {string} contractUuid - Contract UUID to check authorization for
     * @param {string} userPubKey - User's public key to check against participants
     * @returns {Promise<boolean>} True if user is authorized, false otherwise
     */
    async function checkCovenantAuthorization(contractUuid, userPubKey) {
        try {
            // Find SVG elements that contain contract participant data
            const svgElements = document.querySelectorAll('svg[data-contract-participants]');
            
            for (const svg of svgElements) {
                try {
                    const participantsData = svg.getAttribute('data-contract-participants');
                    if (participantsData) {
                        const participantPubKeys = JSON.parse(participantsData);
                        if (Array.isArray(participantPubKeys) && participantPubKeys.includes(userPubKey)) {
                            console.log('✅ User authorized - pubKey found in contract participants');
                            return true;
                        }
                    }
                } catch (parseError) {
                    console.error('❌ Error parsing SVG participant data:', parseError);
                }
            }
            
            console.warn('❌ User not authorized - pubKey not found in any contract participants');
            return false;
            
        } catch (error) {
            console.error('❌ Error checking covenant authorization:', error);
            return false;
        }
    }
    
    /**
     * Hide unauthorized covenant buttons
     * @param {string} userPubKey - User's public key
     */
    async function hideUnauthorizedButtons(userPubKey) {
        const covenantButtons = document.querySelectorAll('[spell="covenant"]');
        console.log(`📜 Checking authorization for ${covenantButtons.length} covenant buttons`);
        
        for (const button of covenantButtons) {
            try {
                const spellComponents = button.getAttribute('spell-components');
                if (!spellComponents) continue;
                
                const { contractUuid } = JSON.parse(spellComponents);
                const isAuthorized = await checkCovenantAuthorization(contractUuid, userPubKey);
                
                if (!isAuthorized) {
                    button.style.display = 'none';
                    console.log(`📜 Hidden unauthorized covenant button for contract ${contractUuid.substring(0, 8)}...`);
                } else {
                    console.log(`📜 Authorized covenant button for contract ${contractUuid.substring(0, 8)}...`);
                }
            } catch (error) {
                console.error('❌ Error checking covenant button authorization:', error);
                button.style.display = 'none'; // Hide on error
            }
        }
    }
    
    // ========================================
    // Covenant Spell Handlers
    // ========================================
    
    /**
     * Apply covenant interaction handlers to elements
     * @param {Element} container - Container to search for covenant elements (default: document)
     */
    function applyCovenantHandlers(container = document) {
        const covenantElements = container.querySelectorAll('[spell="covenant"]');
        console.log(`📜 Found ${covenantElements.length} covenant elements in container`);
        
        covenantElements.forEach(element => {
            // Skip if already processed
            if (element.classList.contains('covenant-element-processed')) {
                return;
            }
            
            element.classList.add('covenant-element-processed');
            
            // Add covenant cursor styling
            element.style.cursor = `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><text y="24" font-size="24">📜</text></svg>') 16 16, pointer`;
            
            // Add hover effects
            element.addEventListener('mouseenter', () => {
                element.style.filter = 'drop-shadow(0 0 8px rgba(100, 181, 246, 0.8))';
                element.style.transition = 'filter 0.2s ease';
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.filter = '';
            });
            
            // Add click handler for covenant signing
            element.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                
                // Cast covenant spell on this element
                signCovenantSpell(element);
            });
            
            console.log('✨ Covenant handler applied to contract:', element.getAttribute('spell-components'));
        });
    }
    
    // ========================================
    // Core Covenant Signing Logic
    // ========================================
    
    /**
     * Sign a covenant contract step
     * @param {Element} element - The element with covenant spell attributes
     */
    async function signCovenantSpell(element) {
        const spellType = element.getAttribute('spell');
        const spellComponentsAttr = element.getAttribute('spell-components');
        
        console.log(`📜 Signing covenant contract`);
        console.log(`🔍 Element info:`, {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            spell: spellType,
            spellComponents: spellComponentsAttr
        });
        
        if (spellType !== 'covenant') {
            throw new Error('This handler only supports covenant spells');
        }
        
        let spellComponents = null;
        if (spellComponentsAttr) {
            try {
                spellComponents = JSON.parse(spellComponentsAttr);
                console.log('📦 Parsed covenant spell components:', spellComponents);
            } catch (error) {
                console.warn('⚠️ Failed to parse covenant spell-components JSON:', error);
                showCustomDialog({
                    title: '❌ Invalid Covenant Spell',
                    message: 'Malformed spell-components JSON',
                    details: [error.message],
                    type: 'error'
                });
                return;
            }
        }
        
        const { contractUuid, stepId, action = 'signStep' } = spellComponents || {};
        
        if (!contractUuid || !stepId) {
            showCustomDialog({
                title: '❌ Invalid Covenant Spell',
                message: 'Missing required contract information',
                details: [
                    'Covenant spells require:',
                    '• contractUuid - The contract to sign',
                    '• stepId - The specific step to sign'
                ],
                type: 'error'
            });
            return;
        }
        
        try {
            console.log(`📜 Processing covenant ${action}: contract ${contractUuid}, step ${stepId}`);
            
            // Get user's public key for authorization
            const userPubKey = await getUserPublicKey();
            if (!userPubKey) {
                showCustomDialog({
                    title: '❌ Authentication Required',
                    message: 'Unable to access your public key',
                    details: [
                        'Covenant signing requires cryptographic authentication.',
                        '',
                        'This is available through:',
                        '• The Advancement browser extension',
                        '• A custom covenant bridge implementation'
                    ],
                    type: 'warning'
                });
                return;
            }
            
            // Check authorization
            const isAuthorized = await checkCovenantAuthorization(contractUuid, userPubKey);
            if (!isAuthorized) {
                showCustomDialog({
                    title: '❌ Not Authorized',
                    message: 'You are not a participant in this contract',
                    details: [
                        `Contract: ${contractUuid.substring(0, 8)}...`,
                        `Your pubKey: ${userPubKey.substring(0, 20)}...`,
                        '',
                        'Only contract participants can sign steps.'
                    ],
                    type: 'warning'
                });
                return;
            }
            
            // Confirm with user
            const confirmed = await showConfirmDialog({
                title: '📜 Sign Contract Step',
                message: `Sign step in contract ${contractUuid.substring(0, 8)}...?`,
                details: [
                    `Step ID: ${stepId}`,
                    `Action: ${action}`,
                    '',
                    'This will use your cryptographic identity to sign this contract step.'
                ]
            });
            
            if (!confirmed) {
                console.log('📜 User cancelled covenant signing');
                return;
            }
            
            // Visual feedback during signing
            const originalFill = element.getAttribute('fill') || element.style.backgroundColor;
            if (element.tagName === 'rect' || element.tagName === 'circle') {
                element.setAttribute('fill', '#64b5f6');
            } else {
                element.style.backgroundColor = '#64b5f6';
            }
            
            // Sign the contract step
            const result = await performCovenantSigning(contractUuid, stepId, action);
            
            if (result.success) {
                console.log('✅ Covenant step signed successfully!');
                
                const stepCompleted = result.data?.stepCompleted ? ' (Step Completed!)' : ' (Awaiting other signatures)';
                showCustomDialog({
                    title: '✅ Contract Step Signed',
                    message: `Step signed successfully!${stepCompleted}`,
                    details: [
                        `Contract: ${contractUuid.substring(0, 8)}...`,
                        `Step: ${stepId}`,
                        '',
                        result.data?.stepCompleted ? 
                            'All participants have signed this step.' :
                            'Waiting for other participants to sign.'
                    ],
                    type: 'success'
                });
                
                // Dispatch custom event for website to handle
                document.dispatchEvent(new CustomEvent('covenantStepSigned', {
                    detail: {
                        contractUuid: contractUuid,
                        stepId: stepId,
                        stepCompleted: result.data?.stepCompleted || false,
                        userPubKey: userPubKey,
                        timestamp: Date.now()
                    }
                }));
                
            } else {
                console.warn(`⚠️ Covenant signing failed: ${result.error}`);
                showCustomDialog({
                    title: '❌ Signing Failed',
                    message: `Failed to sign contract step`,
                    details: [
                        result.error || 'Unknown error occurred',
                        '',
                        `Contract: ${contractUuid.substring(0, 8)}...`,
                        `Step: ${stepId}`
                    ],
                    type: 'error'
                });
            }
            
            // Reset visual after delay
            setTimeout(() => {
                if (element.tagName === 'rect' || element.tagName === 'circle') {
                    if (originalFill) {
                        element.setAttribute('fill', originalFill);
                    } else {
                        element.removeAttribute('fill');
                    }
                } else {
                    element.style.backgroundColor = originalFill || '';
                }
            }, 1500);
            
        } catch (error) {
            console.error('❌ Covenant signing failed:', error);
            showCustomDialog({
                title: '❌ Signing Error',
                message: 'Covenant signing failed',
                details: [
                    error.message,
                    '',
                    'Check that:',
                    '• Covenant service is running',
                    '• You have valid authentication',
                    '• Contract and step IDs are correct'
                ],
                type: 'error'
            });
        }
    }
    
    /**
     * Perform the actual covenant step signing
     * @param {string} contractUuid - Contract UUID
     * @param {string} stepId - Step ID to sign
     * @param {string} action - Action type (default: 'signStep')
     * @returns {Promise<Object>} Signing result
     */
    async function performCovenantSigning(contractUuid, stepId, action) {
        console.log(`📤 Performing covenant signing: ${action}`);
        
        // Check if covenant bridge is available for cryptographic signing
        if (window.covenantBridge && typeof window.covenantBridge.signContractStep === 'function') {
            console.log('🌉 Covenant bridge available, using cryptographic signing');
            
            try {
                const result = await window.covenantBridge.signContractStep(contractUuid, stepId);
                console.log('✅ Bridge signing completed:', result);
                return result;
                
            } catch (error) {
                console.error('❌ Covenant bridge signing failed:', error);
                return { success: false, error: `Bridge signing failed: ${error.message}` };
            }
        }
        
        // Fallback: Show that signing would happen (demo mode)
        console.log('🔍 No covenant bridge available, using simulation mode');
        
        return {
            success: true,
            simulation: true,
            data: {
                contractUuid: contractUuid,
                stepId: stepId,
                action: action,
                stepCompleted: false, // Simulated result
                message: 'This is a simulation - real signing requires The Advancement extension or custom bridge'
            }
        };
    }
    
    // ========================================
    // Custom Dialog System (Covenant-Themed)
    // ========================================
    
    /**
     * Show a custom covenant-themed dialog
     * @param {Object} config - Dialog configuration
     * @param {string} config.title - Dialog title
     * @param {string} config.message - Main message
     * @param {Array<string>} config.details - Array of detail lines
     * @param {string} config.type - Dialog type: 'info', 'success', 'warning', 'error'
     */
    function showCustomDialog(config) {
        const { title, message, details = [], type = 'info' } = config;
        
        console.log(`📱 Covenant Dialog: ${title} - ${message}`);
        
        // Remove any existing dialog
        const existingDialog = document.getElementById('covenant-custom-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }
        
        // Color scheme based on type (covenant theme)
        const colorSchemes = {
            info: { bg: '#64b5f6', border: '#42a5f5' },
            success: { bg: '#81c784', border: '#66bb6a' },
            warning: { bg: '#ffb74d', border: '#ffa726' },
            error: { bg: '#f44336', border: '#e53935' }
        };
        
        const colors = colorSchemes[type] || colorSchemes.info;
        
        // Create dialog container
        const dialogContainer = document.createElement('div');
        dialogContainer.id = 'covenant-custom-dialog';
        dialogContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        // Create dialog content with covenant styling
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 480px;
            width: 90vw;
            max-height: 70vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            border: 2px solid ${colors.bg};
            position: relative;
            animation: covenant-dialog-appear 0.3s ease-out;
        `;
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes covenant-dialog-appear {
                from {
                    opacity: 0;
                    transform: translateY(-20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
        `;
        document.head.appendChild(style);
        
        // Dialog HTML with covenant theme
        dialog.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
                <div style="
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: linear-gradient(45deg, ${colors.bg}, ${colors.border});
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 16px;
                    color: white;
                    font-size: 24px;
                    font-weight: bold;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                ">
                    ${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '❌' : '📜'}
                </div>
                <div>
                    <h3 style="
                        margin: 0 0 4px 0;
                        font-size: 20px;
                        font-weight: 600;
                        color: white;
                        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                    ">${title}</h3>
                    <p style="
                        margin: 0;
                        font-size: 14px;
                        color: #b0bec5;
                    ">${message}</p>
                </div>
            </div>
            
            ${details.length > 0 ? `
                <div style="
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                    padding: 16px;
                    margin: 16px 0;
                    font-family: 'Monaco', 'Consolas', monospace;
                    font-size: 13px;
                    line-height: 1.6;
                    color: #eceff1;
                    white-space: pre-line;
                    border-left: 4px solid ${colors.bg};
                    backdrop-filter: blur(10px);
                ">${details.join('\\n')}</div>
            ` : ''}
            
            <div style="
                display: flex;
                justify-content: flex-end;
                margin-top: 24px;
            ">
                <button onclick="document.getElementById('covenant-custom-dialog').remove()" style="
                    background: linear-gradient(45deg, ${colors.bg}, ${colors.border});
                    color: white;
                    border: none;
                    border-radius: 8px;
                    padding: 12px 24px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.3)'" 
                   onmouseout="this.style.transform=''; this.style.boxShadow='0 2px 4px rgba(0, 0, 0, 0.2)'">
                    ✨ Understood
                </button>
            </div>
        `;
        
        dialogContainer.appendChild(dialog);
        document.body.appendChild(dialogContainer);
        
        // Auto-close after 8 seconds for success dialogs
        if (type === 'success') {
            setTimeout(() => {
                if (document.getElementById('covenant-custom-dialog')) {
                    dialogContainer.remove();
                }
            }, 8000);
        }
        
        // Close on background click
        dialogContainer.addEventListener('click', (e) => {
            if (e.target === dialogContainer) {
                dialogContainer.remove();
            }
        });
        
        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                dialogContainer.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        console.log(`📱 Covenant dialog displayed: ${title}`);
    }
    
    /**
     * Show a confirmation dialog for covenant actions
     * @param {Object} config - Confirmation dialog configuration
     * @returns {Promise<boolean>} True if user confirmed, false if cancelled
     */
    function showConfirmDialog(config) {
        const { title, message, details = [] } = config;
        
        return new Promise((resolve) => {
            console.log(`📋 Covenant Confirm: ${title}`);
            
            // Remove any existing dialog
            const existingDialog = document.getElementById('covenant-confirm-dialog');
            if (existingDialog) {
                existingDialog.remove();
            }
            
            // Create dialog container
            const dialogContainer = document.createElement('div');
            dialogContainer.id = 'covenant-confirm-dialog';
            dialogContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;
            
            // Create dialog content
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                color: white;
                border-radius: 12px;
                padding: 24px;
                max-width: 520px;
                width: 90vw;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                border: 2px solid #64b5f6;
                position: relative;
                animation: covenant-dialog-appear 0.3s ease-out;
            `;
            
            // Dialog HTML
            dialog.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 20px;">
                    <div style="
                        width: 50px;
                        height: 50px;
                        border-radius: 50%;
                        background: linear-gradient(45deg, #64b5f6, #81c784);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 16px;
                        font-size: 24px;
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                    ">📜</div>
                    <div>
                        <h3 style="
                            margin: 0 0 4px 0;
                            font-size: 20px;
                            font-weight: 600;
                            color: white;
                        ">${title}</h3>
                        <p style="
                            margin: 0;
                            font-size: 16px;
                            color: #b0bec5;
                        ">${message}</p>
                    </div>
                </div>
                
                ${details.length > 0 ? `
                    <div style="
                        background: rgba(255, 255, 255, 0.05);
                        border-radius: 8px;
                        padding: 16px;
                        margin: 16px 0;
                        font-size: 14px;
                        line-height: 1.6;
                        color: #eceff1;
                        white-space: pre-line;
                        border-left: 4px solid #64b5f6;
                    ">${details.join('\\n')}</div>
                ` : ''}
                
                <div style="
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                ">
                    <button onclick="window.covenantConfirmResolve(false)" style="
                        background: rgba(244, 67, 54, 0.1);
                        color: #f44336;
                        border: 1px solid #f44336;
                        border-radius: 8px;
                        padding: 12px 24px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='rgba(244, 67, 54, 0.2)'" 
                       onmouseout="this.style.background='rgba(244, 67, 54, 0.1)'">
                        ❌ Cancel
                    </button>
                    <button onclick="window.covenantConfirmResolve(true)" style="
                        background: linear-gradient(45deg, #64b5f6, #81c784);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        padding: 12px 24px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                    " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.3)'" 
                       onmouseout="this.style.transform=''; this.style.boxShadow='0 2px 4px rgba(0, 0, 0, 0.2)'">
                        ✍️ Sign Step
                    </button>
                </div>
            `;
            
            dialogContainer.appendChild(dialog);
            document.body.appendChild(dialogContainer);
            
            // Set up global resolver
            window.covenantConfirmResolve = (confirmed) => {
                dialogContainer.remove();
                delete window.covenantConfirmResolve;
                resolve(confirmed);
            };
            
            // Close on Escape (defaults to false)
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    dialogContainer.remove();
                    delete window.covenantConfirmResolve;
                    document.removeEventListener('keydown', escapeHandler);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', escapeHandler);
        });
    }
    
    // ========================================
    // Initialization and Auto-Authorization
    // ========================================
    
    /**
     * Initialize covenant signing system and check authorization
     */
    async function initializeCovenantSystem() {
        console.log('🚀 Initializing covenant signing system...');
        
        // Apply covenant handlers to existing elements
        applyCovenantHandlers();
        
        // Check authorization and hide unauthorized buttons
        const userPubKey = await getUserPublicKey();
        if (userPubKey) {
            console.log(`📜 Got user pubKey: ${userPubKey.substring(0, 20)}...`);
            await hideUnauthorizedButtons(userPubKey);
        } else {
            console.log('📜 No user pubKey available - hiding all covenant buttons');
            const covenantButtons = document.querySelectorAll('[spell="covenant"]');
            covenantButtons.forEach(button => {
                button.style.display = 'none';
            });
        }
        
        // Monitor for dynamically added covenant elements
        const observer = new MutationObserver((mutations) => {
            let hasNewNodes = false;
            
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    hasNewNodes = true;
                    break;
                }
            }
            
            if (hasNewNodes) {
                console.log('🔄 New DOM nodes detected, scanning for covenant elements...');
                
                // Apply handlers to new elements
                applyCovenantHandlers();
                
                // Re-check authorization for new buttons
                if (userPubKey) {
                    setTimeout(() => hideUnauthorizedButtons(userPubKey), 100);
                }
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('✅ Covenant signing system initialized successfully');
    }
    
    // ========================================
    // Global API
    // ========================================
    
    // Expose covenant signing functions globally
    window.signCovenant = signCovenantSpell;
    window.applyCovenantHandlers = applyCovenantHandlers;
    
    // Expose debug and utility functions
    window.covenantDebug = {
        getUserPublicKey: getUserPublicKey,
        checkAuthorization: checkCovenantAuthorization,
        hideUnauthorizedButtons: hideUnauthorizedButtons,
        logStatus: () => {
            console.log('📜 signCovenant Status Report:');
            console.log(`  ✨ Covenant elements processed: ${document.querySelectorAll('.covenant-element-processed').length}`);
            console.log(`  🔐 Total covenant buttons: ${document.querySelectorAll('[spell="covenant"]').length}`);
            console.log(`  👁️ Visible covenant buttons: ${document.querySelectorAll('[spell="covenant"]:not([style*="display: none"])').length}`);
        }
    };
    
    // Listen for covenant events (for debugging/monitoring)
    window.addEventListener('covenantStepSigned', (event) => {
        console.log('📜 Covenant step signed event:', event.detail);
    });
    
    // ========================================
    // Auto-Initialize
    // ========================================
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeCovenantSystem);
    } else {
        initializeCovenantSystem();
    }
    
    console.log('📜 signCovenant.js setup complete - waiting for DOM ready');
    
})();