/**
 * WebAuthn Fingerprint Authentication - Frontend
 * 
 * This script handles:
 * 1. Fingerprint registration using navigator.credentials.create()
 * 2. Fingerprint login using navigator.credentials.get()
 * 3. Communication with backend API
 * 
 * IMPORTANT: This uses the WebAuthn API which triggers the device's
 * built-in fingerprint scanner (Windows Hello, Touch ID, Android biometrics)
 * 
 * NO fingerprint data is accessed or stored - only cryptographic credentials
 */

// Dynamic API_BASE - works on both localhost and Railway.app
const API_BASE = `${window.location.origin}/api`;

// Application State
let currentUser = null;
let walletData = {
    balance: 0,
    address: '',
    transactions: []
};

// DOM Elements
const welcomeSection = document.getElementById('welcomeSection');
const authSection = document.getElementById('authSection');
const registerCard = document.getElementById('registerCard');
const loginCard = document.getElementById('loginCard');
const walletApp = document.getElementById('walletApp');
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const showLoginLink = document.getElementById('showLoginLink');
const showRegisterLink = document.getElementById('showRegisterLink');
const logoutBtn = document.getElementById('logoutBtn');
const headerLogoutBtn = document.getElementById('headerLogoutBtn');
const messageContainer = document.getElementById('messageContainer');
const headerInfo = document.getElementById('headerInfo');
const userMenu = document.getElementById('userMenu');
const headerUsername = document.getElementById('headerUsername');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check if WebAuthn is supported
    if (!isWebAuthnSupported()) {
        showMessage('WebAuthn is not supported in this browser. Please use Chrome, Edge, Firefox, or Safari.', 'error');
        return;
    }

    // Check if using valid domain for WebAuthn
    checkWebAuthnDomain();

    // Check server connection
    await checkServerConnection();

    // Show registration form by default
    showRegisterForm();

    // Event listeners
    registerForm.addEventListener('submit', handleRegister);
    loginForm.addEventListener('submit', handleLogin);
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterForm();
    });
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (headerLogoutBtn) headerLogoutBtn.addEventListener('click', handleLogout);
    
    // Navigation listeners
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            if (page) navigateToPage(page);
        });
    });
    
    // Quick action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-action');
            if (action) navigateToPage(action);
        });
    });
    
    // Send form
    const sendForm = document.getElementById('sendForm');
    if (sendForm) {
        sendForm.addEventListener('submit', handleSend);
        const sendAmountInput = document.getElementById('sendAmount');
        if (sendAmountInput) {
            sendAmountInput.addEventListener('input', updateSendTotal);
        }
    }
    
    // Copy address buttons
    const copyAddressBtn = document.getElementById('copyAddressBtn');
    if (copyAddressBtn) {
        copyAddressBtn.addEventListener('click', () => {
            copyToClipboard(walletData.address || document.getElementById('receiveAddress').textContent);
        });
    }
    
    const copyWalletBtn = document.getElementById('copyWalletBtn');
    if (copyWalletBtn) {
        copyWalletBtn.addEventListener('click', () => {
            copyToClipboard(walletData.address || document.getElementById('settingsWalletAddress').textContent);
        });
    }
});

/**
 * Check if WebAuthn is supported in the browser
 */
function isWebAuthnSupported() {
    return !!(navigator.credentials && navigator.credentials.create && navigator.credentials.get);
}

/**
 * Check if using valid domain for WebAuthn
 * WebAuthn requires localhost or a valid domain, not IP addresses
 */
function checkWebAuthnDomain() {
    const hostname = window.location.hostname;
    
    // Check if using IP address instead of localhost
    const ipPattern = /^\d+\.\d+\.\d+\.\d+$/;
    const isIPv6 = hostname.includes(':');
    
    if (ipPattern.test(hostname) || (isIPv6 && hostname !== 'localhost')) {
        const currentUrl = window.location.href;
        const localhostUrl = currentUrl.replace(hostname, 'localhost');
        
        showMessage(
            `⚠️ WebAuthn requires "localhost", not IP addresses. ` +
            `Please use: <a href="${localhostUrl}" style="color: var(--primary-color); text-decoration: underline;">${localhostUrl}</a>`,
            'error'
        );
        console.warn('WebAuthn domain warning: Using IP address instead of localhost');
        return false;
    }
    
    return true;
}

/**
 * Check if backend server is running
 */
async function checkServerConnection() {
    try {
        const response = await fetch(`${API_BASE.replace('/api', '')}/`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        // Server is running
        return true;
    } catch (error) {
        console.warn('Server connection check failed:', error);
        showMessage('⚠️ Backend server may not be running. Please start it with: cd backend && npm start', 'error');
        return false;
    }
}

/**
 * Show registration form
 */
function showRegisterForm() {
    welcomeSection.style.display = 'none';
    authSection.style.display = 'block';
    registerCard.style.display = 'block';
    loginCard.style.display = 'none';
    if (walletApp) walletApp.style.display = 'none';
}

/**
 * Show login form
 */
function showLoginForm() {
    welcomeSection.style.display = 'none';
    authSection.style.display = 'block';
    registerCard.style.display = 'none';
    loginCard.style.display = 'block';
    if (walletApp) walletApp.style.display = 'none';
}

/**
 * Show wallet application after successful login
 */
async function showWalletApp(username, loginTime) {
    currentUser = username;
    welcomeSection.style.display = 'none';
    authSection.style.display = 'none';
    if (walletApp) walletApp.style.display = 'flex';
    if (headerInfo) headerInfo.style.display = 'none';
    if (userMenu) userMenu.style.display = 'block';
    
    // Update UI
    const dashboardUsernameEl = document.getElementById('dashboardUsername');
    if (dashboardUsernameEl) dashboardUsernameEl.textContent = username;
    document.getElementById('settingsUsername').textContent = username;
    headerUsername.textContent = username;
    document.getElementById('lastLoginTime').textContent = new Date(loginTime).toLocaleString();
    
    // Initialize wallet
    await initializeWallet(username);
    
    // Show dashboard page
    navigateToPage('dashboard');
}

/**
 * Initialize wallet data
 */
async function initializeWallet(username) {
    try {
        // Load wallet data from backend
        const response = await fetch(`${API_BASE}/wallet/${username}`);
        if (response.ok) {
            const data = await response.json();
            walletData = {
                balance: data.balance || 0,
                address: data.address || generateWalletAddress(username),
                transactions: data.transactions || []
            };
        } else {
            // Create new wallet if doesn't exist
            walletData = {
                balance: 1000.00, // Demo starting balance
                address: generateWalletAddress(username),
                transactions: []
            };
            await createWallet(username, walletData);
        }
        
        updateWalletUI();
    } catch (error) {
        console.error('Error initializing wallet:', error);
        // Use default values
        walletData = {
            balance: 1000.00,
            address: generateWalletAddress(username),
            transactions: []
        };
        updateWalletUI();
    }
}

/**
 * Generate a wallet address (simplified for demo)
 */
function generateWalletAddress(username) {
    // In production, use proper cryptographic address generation
    const hash = btoa(username).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    return `0x${hash}${Date.now().toString(16).substring(0, 24)}`.toUpperCase();
}

/**
 * Create wallet on backend
 */
async function createWallet(username, walletData) {
    try {
        await fetch(`${API_BASE}/wallet/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, ...walletData })
        });
    } catch (error) {
        console.error('Error creating wallet:', error);
    }
}

/**
 * Update wallet UI with current data
 */
function updateWalletUI() {
    // Update balance
    document.getElementById('totalBalance').textContent = formatCurrency(walletData.balance);
    document.getElementById('usdBalance').textContent = formatCurrency(walletData.balance);
    document.getElementById('availableBalance').textContent = formatCurrency(walletData.balance);
    
    // Update address
    document.getElementById('walletAddress').textContent = walletData.address;
    document.getElementById('receiveAddress').textContent = walletData.address;
    document.getElementById('settingsWalletAddress').textContent = walletData.address;
    
    // Update transactions
    document.getElementById('totalTransactions').textContent = walletData.transactions.length;
    const thisMonth = walletData.transactions.filter(t => {
        const txDate = new Date(t.timestamp);
        const now = new Date();
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    }).length;
    document.getElementById('monthTransactions').textContent = thisMonth;
    
    // Update transactions list
    updateTransactionsList();
}

/**
 * Format currency
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(amount);
}

/**
 * Update transactions list UI
 */
function updateTransactionsList() {
    const list = document.getElementById('transactionsList');
    
    if (walletData.transactions.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="30" stroke="currentColor" stroke-width="2" opacity="0.3"/>
                    <path d="M32 20V32M32 32L26 26M32 32L38 26" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p>No transactions yet</p>
                <p class="empty-subtitle">Your transaction history will appear here</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = walletData.transactions
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .map(tx => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-icon ${tx.type}">
                        ${tx.type === 'send' ? '📤' : '📥'}
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-type">${tx.type === 'send' ? 'Sent' : 'Received'}</div>
                        <div class="transaction-date">${new Date(tx.timestamp).toLocaleString()}</div>
                    </div>
                </div>
                <div class="transaction-amount">
                    <div class="transaction-amount-value ${tx.type === 'send' ? 'negative' : 'positive'}">
                        ${tx.type === 'send' ? '-' : '+'}${formatCurrency(Math.abs(tx.amount))}
                    </div>
                    <div class="transaction-status">${tx.status || 'Completed'}</div>
                </div>
            </div>
        `).join('');
}

/**
 * Navigate to a page
 */
function navigateToPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected page
    const page = document.getElementById(`page-${pageName}`);
    if (page) {
        page.classList.add('active');
    }
    
    // Activate nav item
    const navItem = document.querySelector(`[data-page="${pageName}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    // Update send form total
    if (pageName === 'send') {
        updateSendTotal();
    }
}

/**
 * Handle registration form submission
 */
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value.trim();
    const registerBtn = document.getElementById('registerBtn');

    if (!username) {
        showMessage('Please enter a username', 'error');
        return;
    }

    try {
        // Disable button and show loading
        registerBtn.disabled = true;
        registerBtn.classList.add('loading');

        // Step 1: Get registration options from backend
        let response;
        try {
            response = await fetch(`${API_BASE}/register/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username }),
            });
        } catch (fetchError) {
            console.error('Network error:', fetchError);
            throw new Error('❌ Cannot connect to server. Please make sure the backend server is running and accessible.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Server error' }));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        // Step 2: Convert challenge and user.id from base64url to ArrayBuffer
        // WebAuthn requires ArrayBuffer format
        // Base64url uses - and _ instead of + and /, and no padding
        function base64urlToArrayBuffer(base64url) {
            // Convert base64url to base64
            let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
            // Add padding if needed
            while (base64.length % 4) {
                base64 += '=';
            }
            // Decode base64 to binary string, then to Uint8Array
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        }

        const publicKeyCredentialCreationOptions = {
            ...data,
            challenge: base64urlToArrayBuffer(data.challenge),
            user: {
                ...data.user,
                id: base64urlToArrayBuffer(data.user.id),
            },
        };

        // Step 3: Call WebAuthn API - This triggers the fingerprint scanner!
        // navigator.credentials.create() will show the device's fingerprint prompt
        // (Windows Hello, Touch ID, Android biometrics, etc.)
        const credential = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions,
        });

        // Step 4: Convert credential to format backend can understand
        const credentialForBackend = {
            id: credential.id,
            rawId: arrayBufferToBase64url(credential.rawId),
            response: {
                clientDataJSON: arrayBufferToBase64url(credential.response.clientDataJSON),
                attestationObject: arrayBufferToBase64url(credential.response.attestationObject),
            },
            type: credential.type,
        };

        // Step 5: Send credential to backend for storage
        let completeResponse;
        try {
            completeResponse = await fetch(`${API_BASE}/register/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    credential: credentialForBackend,
                }),
            });
        } catch (fetchError) {
            console.error('Network error:', fetchError);
            throw new Error('❌ Cannot connect to server. Please make sure the backend server is running and accessible.');
        }

        if (!completeResponse.ok) {
            const errorData = await completeResponse.json().catch(() => ({ error: 'Server error' }));
            throw new Error(errorData.error || `Server error: ${completeResponse.status}`);
        }

        const completeData = await completeResponse.json();

        if (!completeResponse.ok) {
            throw new Error(completeData.error || 'Registration completion failed');
        }

        showMessage('Fingerprint registered successfully! You can now login.', 'success');
        
        // Switch to login form after a delay
        setTimeout(() => {
            showLoginForm();
            document.getElementById('loginUsername').value = username;
        }, 2000);

    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle user cancellation
        if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
            showMessage('Registration cancelled. Please try again.', 'error');
        } else if (error.message.includes('Cannot connect to server')) {
            showMessage('❌ Cannot connect to server. Please start the backend server:\n1. Open terminal in the "backend" folder\n2. Run: npm install\n3. Run: npm start', 'error');
        } else {
            showMessage(error.message || 'Registration failed. Please try again.', 'error');
        }
    } finally {
        registerBtn.disabled = false;
        registerBtn.classList.remove('loading');
    }
}

/**
 * Handle login form submission
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const loginBtn = document.getElementById('loginBtn');

    if (!username) {
        showMessage('Please enter your username', 'error');
        return;
    }

    try {
        // Disable button and show loading
        loginBtn.disabled = true;
        loginBtn.classList.add('loading');

        // Step 1: Get authentication options from backend
        let response;
        try {
            response = await fetch(`${API_BASE}/login/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username }),
            });
        } catch (fetchError) {
            console.error('Network error:', fetchError);
            throw new Error('❌ Cannot connect to server. Please make sure the backend server is running and accessible.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Server error' }));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        // Step 2: Convert challenge and credential ID from base64url to ArrayBuffer
        function base64urlToArrayBuffer(base64url) {
            // Convert base64url to base64
            let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
            // Add padding if needed
            while (base64.length % 4) {
                base64 += '=';
            }
            // Decode base64 to binary string, then to Uint8Array
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        }

        const publicKeyCredentialRequestOptions = {
            ...data,
            challenge: base64urlToArrayBuffer(data.challenge),
            allowCredentials: data.allowCredentials.map(cred => ({
                ...cred,
                id: base64urlToArrayBuffer(cred.id),
            })),
        };

        // Step 3: Call WebAuthn API - This triggers the fingerprint scanner!
        // navigator.credentials.get() will show the device's fingerprint prompt
        const assertion = await navigator.credentials.get({
            publicKey: publicKeyCredentialRequestOptions,
        });

        // Step 4: Convert assertion to format backend can understand
        const assertionForBackend = {
            id: assertion.id,
            rawId: arrayBufferToBase64url(assertion.rawId),
            response: {
                clientDataJSON: arrayBufferToBase64url(assertion.response.clientDataJSON),
                authenticatorData: arrayBufferToBase64url(assertion.response.authenticatorData),
                signature: arrayBufferToBase64url(assertion.response.signature),
                userHandle: assertion.response.userHandle ? arrayBufferToBase64url(assertion.response.userHandle) : null,
            },
            type: assertion.type,
        };

        // Step 5: Send assertion to backend for verification
        let completeResponse;
        try {
            completeResponse = await fetch(`${API_BASE}/login/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    credential: assertionForBackend,
                }),
            });
        } catch (fetchError) {
            console.error('Network error:', fetchError);
            throw new Error('❌ Cannot connect to server. Please make sure the backend server is running and accessible.');
        }

        if (!completeResponse.ok) {
            const errorData = await completeResponse.json().catch(() => ({ error: 'Server error' }));
            throw new Error(errorData.error || `Server error: ${completeResponse.status}`);
        }

        const completeData = await completeResponse.json();

        if (!completeResponse.ok) {
            throw new Error(completeData.error || 'Authentication failed');
        }

        showMessage('Login successful! Welcome back.', 'success');
        
        // Show wallet app
        setTimeout(() => {
            showWalletApp(username, completeData.loginTime);
        }, 1500);

    } catch (error) {
        console.error('Login error:', error);
        
        // Handle user cancellation
        if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
            showMessage('Login cancelled. Please try again.', 'error');
        } else if (error.message.includes('Cannot connect to server')) {
            showMessage('❌ Cannot connect to server. Please start the backend server:\n1. Open terminal in the "backend" folder\n2. Run: npm install\n3. Run: npm start', 'error');
        } else {
            showMessage(error.message || 'Login failed. Please try again.', 'error');
        }
    } finally {
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
    }
}

/**
 * Handle logout
 */
function handleLogout() {
    currentUser = null;
    walletData = { balance: 0, address: '', transactions: [] };
    showRegisterForm();
    registerForm.reset();
    loginForm.reset();
    headerInfo.style.display = 'block';
    userMenu.style.display = 'none';
    showMessage('Logged out successfully', 'success');
}

/**
 * Update send form total
 */
function updateSendTotal() {
    const amountInput = document.getElementById('sendAmount');
    const totalEl = document.getElementById('sendTotal');
    
    if (amountInput && totalEl) {
        const amount = parseFloat(amountInput.value) || 0;
        const fee = 0; // Network fee (can be calculated)
        const total = amount + fee;
        totalEl.textContent = formatCurrency(total);
    }
}

/**
 * Handle send form submission
 */
async function handleSend(e) {
    e.preventDefault();
    
    const recipientAddress = document.getElementById('recipientAddress').value.trim();
    const amount = parseFloat(document.getElementById('sendAmount').value);
    const note = document.getElementById('sendNote').value.trim();
    const sendBtn = document.getElementById('sendBtn');
    
    if (!recipientAddress) {
        showMessage('Please enter recipient address', 'error');
        return;
    }
    
    if (!amount || amount <= 0) {
        showMessage('Please enter a valid amount', 'error');
        return;
    }
    
    if (amount > walletData.balance) {
        showMessage('Insufficient balance', 'error');
        return;
    }
    
    try {
        sendBtn.disabled = true;
        sendBtn.classList.add('loading');
        
        // Create transaction
        const transaction = {
            type: 'send',
            recipient: recipientAddress,
            amount: amount,
            note: note,
            timestamp: new Date().toISOString(),
            status: 'Completed'
        };
        
        // Update wallet
        walletData.balance -= amount;
        walletData.transactions.push(transaction);
        
        // Save to backend
        await saveWalletData();
        
        // Update UI
        updateWalletUI();
        
        // Reset form
        e.target.reset();
        updateSendTotal();
        
        showMessage('Transaction sent successfully!', 'success');
        
        // Navigate to transactions
        setTimeout(() => navigateToPage('transactions'), 1500);
        
    } catch (error) {
        console.error('Send error:', error);
        showMessage('Transaction failed. Please try again.', 'error');
    } finally {
        sendBtn.disabled = false;
        sendBtn.classList.remove('loading');
    }
}

/**
 * Save wallet data to backend
 */
async function saveWalletData() {
    try {
        await fetch(`${API_BASE}/wallet/${currentUser}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(walletData)
        });
    } catch (error) {
        console.error('Error saving wallet:', error);
    }
}

/**
 * Copy wallet address to clipboard
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showMessage('Copied to clipboard!', 'success');
    } catch (error) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showMessage('Copied to clipboard!', 'success');
    }
}

/**
 * Convert ArrayBuffer to base64url string
 * Base64url is URL-safe base64 encoding (used by WebAuthn)
 */
function arrayBufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Show message to user
 */
function showMessage(message, type = 'success') {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    
    const icon = type === 'success' 
        ? '<svg class="message-icon" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/><path d="M6 10 L9 13 L14 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg class="message-icon" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/><path d="M10 6 L10 10 M10 14 L10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    
    messageEl.innerHTML = `
        ${icon}
        <span class="message-text">${message}</span>
    `;
    
    messageContainer.appendChild(messageEl);
    
    // Auto remove after 8 seconds for error messages (longer for domain warnings)
    const timeout = type === 'error' ? 8000 : 5000;
    setTimeout(() => {
        messageEl.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => messageEl.remove(), 300);
    }, timeout);
}
