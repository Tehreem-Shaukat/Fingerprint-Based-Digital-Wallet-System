/**
 * WebAuthn Fingerprint Authentication Server
 * 
 * This server implements FIDO2/WebAuthn authentication using device fingerprint scanners.
 * It does NOT store or access raw fingerprint data - only cryptographic credentials.
 * 
 * Security Features:
 * - Uses platform authenticator (device fingerprint scanner)
 * - Requires user verification
 * - Cryptographic challenge-response authentication
 * - No biometric data stored on server
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow frontend to access backend
app.use(express.json()); // Parse JSON requests
app.use(express.static(path.join(__dirname, '../frontend'))); // Serve frontend files

// Storage file path
const USERS_FILE = path.join(__dirname, 'users.json');

/**
 * Load users from JSON file
 * In production, use a proper database
 */
function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
    return {};
}

/**
 * Save users to JSON file
 */
function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error saving users:', error);
    }
}

/**
 * Generate a random challenge for WebAuthn
 * Challenges prevent replay attacks
 */
function generateChallenge() {
    return crypto.randomBytes(32).toString('base64url');
}

/**
 * Get the effective domain for WebAuthn RP ID
 * WebAuthn requires rp.id to match the origin domain
 * For development, always use 'localhost' (WebAuthn doesn't accept IP addresses)
 */
function getEffectiveDomain(req) {
    // For local development, always use 'localhost'
    // WebAuthn specification doesn't allow IP addresses (127.0.0.1, etc.)
    // Users must access via http://localhost:3000 for WebAuthn to work
    
    // In production, you would extract the actual domain from the request
    // For now, we always use 'localhost' for development
    return 'localhost';
}

/**
 * Registration Endpoint
 * Step 1: Generate challenge and return registration options
 */
app.post('/api/register/start', (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    const users = loadUsers();
    if (users[username]) {
        return res.status(400).json({ error: 'Username already exists' });
    }

    // Generate a random challenge
    const challenge = generateChallenge();

    // Store challenge temporarily (in production, use Redis or session)
    if (!global.challenges) global.challenges = {};
    global.challenges[username] = challenge;

    // Get effective domain for WebAuthn
    const rpId = getEffectiveDomain(req);

    // WebAuthn registration options
    // authenticatorSelection.authenticatorAttachment: 'platform' = use built-in fingerprint scanner
    // authenticatorSelection.userVerification: 'required' = must verify with fingerprint
    // Note: challenge and user.id are sent as base64url strings, frontend will convert to ArrayBuffer
    const registrationOptions = {
        challenge: challenge, // Send as base64url string, frontend converts to ArrayBuffer
        rp: {
            name: 'Fingerprint Wallet',
            id: rpId, // Always 'localhost' for development
        },
        user: {
            id: Buffer.from(username, 'utf8').toString('base64url'), // Convert to base64url for JSON
            name: username,
            displayName: username,
        },
        pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
            authenticatorAttachment: 'platform', // Use built-in fingerprint scanner
            userVerification: 'required', // Require fingerprint verification
            requireResidentKey: false,
        },
        timeout: 60000, // 60 seconds timeout
        attestation: 'none', // We don't need attestation for basic auth
    };

    res.json(registrationOptions);
});

/**
 * Registration Endpoint
 * Step 2: Verify and store the credential
 */
app.post('/api/register/complete', async (req, res) => {
    const { username, credential } = req.body;

    if (!username || !credential) {
        return res.status(400).json({ error: 'Username and credential are required' });
    }

    // Verify challenge (in production, check expiration too)
    const storedChallenge = global.challenges?.[username];
    if (!storedChallenge) {
        return res.status(400).json({ error: 'Invalid or expired challenge' });
    }

    // For academic purposes, we'll do simplified verification
    // In production, you'd verify the attestation and signature properly
    try {
        // Store the credential ID and public key
        // We do NOT store fingerprint data - only the cryptographic credential
        const users = loadUsers();
        users[username] = {
            credentialId: credential.id,
            publicKey: credential.response.publicKey || 'stored', // Simplified for academic project
            registeredAt: new Date().toISOString(),
        };
        saveUsers(users);

        // Clean up challenge
        delete global.challenges[username];

        res.json({ 
            success: true, 
            message: 'Fingerprint registered successfully!',
            username 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * Login Endpoint
 * Step 1: Generate challenge and return authentication options
 */
app.post('/api/login/start', (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    const users = loadUsers();
    const user = users[username];

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Generate challenge for login
    const challenge = generateChallenge();

    // Store challenge
    if (!global.challenges) global.challenges = {};
    global.challenges[username] = challenge;

    // Get effective domain for WebAuthn
    const rpId = getEffectiveDomain(req);

    // WebAuthn authentication options
    // Note: challenge and credential id are sent as base64url strings, frontend converts to ArrayBuffer
    const authOptions = {
        challenge: challenge, // Send as base64url string, frontend converts to ArrayBuffer
        rpId: rpId, // Always 'localhost' for development
        allowCredentials: [
            {
                id: user.credentialId, // Already stored as base64url string
                type: 'public-key',
            },
        ],
        userVerification: 'required', // Require fingerprint scan
        timeout: 60000,
    };

    res.json(authOptions);
});

/**
 * Login Endpoint
 * Step 2: Verify the authentication response
 */
app.post('/api/login/complete', async (req, res) => {
    const { username, credential } = req.body;

    if (!username || !credential) {
        return res.status(400).json({ error: 'Username and credential are required' });
    }

    const users = loadUsers();
    const user = users[username];

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Verify challenge
    const storedChallenge = global.challenges?.[username];
    if (!storedChallenge) {
        return res.status(400).json({ error: 'Invalid or expired challenge' });
    }

    // Verify credential ID matches
    if (credential.id !== user.credentialId) {
        return res.status(401).json({ error: 'Authentication failed' });
    }

    // For academic purposes, simplified verification
    // In production, you'd cryptographically verify the signature
    try {
        // Clean up challenge
        delete global.challenges[username];

        res.json({ 
            success: true, 
            message: 'Login successful!',
            username,
            loginTime: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: 'Authentication failed' });
    }
});

/**
 * Get user info (for demo purposes)
 */
app.get('/api/user/:username', (req, res) => {
    const { username } = req.params;
    const users = loadUsers();
    const user = users[username];

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Don't expose sensitive data
    res.json({
        username,
        registeredAt: user.registeredAt,
    });
});

/**
 * Wallet Endpoints
 */

// Wallets storage file
const WALLETS_FILE = path.join(__dirname, 'wallets.json');

/**
 * Load wallets from JSON file
 */
function loadWallets() {
    try {
        if (fs.existsSync(WALLETS_FILE)) {
            const data = fs.readFileSync(WALLETS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading wallets:', error);
    }
    return {};
}

/**
 * Save wallets to JSON file
 */
function saveWallets(wallets) {
    try {
        fs.writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2));
    } catch (error) {
        console.error('Error saving wallets:', error);
    }
}

/**
 * Get wallet data
 */
app.get('/api/wallet/:username', (req, res) => {
    const { username } = req.params;
    const wallets = loadWallets();
    const wallet = wallets[username];

    if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
    }

    res.json(wallet);
});

/**
 * Create new wallet
 */
app.post('/api/wallet/create', (req, res) => {
    const { username, balance, address, transactions } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    const wallets = loadWallets();
    
    if (wallets[username]) {
        return res.status(400).json({ error: 'Wallet already exists' });
    }

    wallets[username] = {
        balance: balance || 0,
        address: address || generateWalletAddress(username),
        transactions: transactions || [],
        createdAt: new Date().toISOString(),
    };

    saveWallets(wallets);

    res.json({ 
        success: true, 
        message: 'Wallet created successfully',
        wallet: wallets[username]
    });
});

/**
 * Update wallet data
 */
app.put('/api/wallet/:username', (req, res) => {
    const { username } = req.params;
    const { balance, address, transactions } = req.body;

    const wallets = loadWallets();
    const wallet = wallets[username];

    if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
    }

    // Update wallet data
    if (balance !== undefined) wallet.balance = balance;
    if (address) wallet.address = address;
    if (transactions) wallet.transactions = transactions;
    wallet.updatedAt = new Date().toISOString();

    saveWallets(wallets);

    res.json({ 
        success: true, 
        message: 'Wallet updated successfully',
        wallet 
    });
});

/**
 * Generate wallet address (simplified for demo)
 */
function generateWalletAddress(username) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(username + Date.now()).digest('hex');
    return `0x${hash.substring(0, 40).toUpperCase()}`;
}

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Fingerprint Wallet API is running',
        endpoints: {
            register: '/api/register/start',
            login: '/api/login/start',
            wallet: '/api/wallet/:username'
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 WebAuthn Fingerprint Authentication Server running on http://localhost:${PORT}`);
    console.log(`📱 Frontend available at http://localhost:${PORT}`);
    console.log(`🔐 Using platform authenticator (fingerprint scanner)`);
    console.log(`\n✅ Server is ready! You can now register and login.`);
    console.log(`\n⚠️  If you see "failed to fetch" errors:`);
    console.log(`   1. Make sure this server is running`);
    console.log(`   2. Check that port ${PORT} is not in use`);
    console.log(`   3. Verify you're accessing http://localhost:${PORT}\n`);
});
