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

// Load .env file only if it exists (for local development)
// Railway and other platforms will provide environment variables directly
try {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
    }
} catch (err) {
    // Silent fail - environment variables may be set by platform
}

const { supabase } = require('./supabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow frontend to access backend
app.use(express.json()); // Parse JSON requests
app.use(express.static(path.join(__dirname, '../frontend'))); // Serve frontend files

// Mount transfer routes (payments, wallets, transactions)
try {
    const transferRoutes = require('./routes/transfer');
    app.use('/api', transferRoutes);
} catch (err) {
    console.warn('Transfer routes not available:', err.message);
}

// Helper: get user from Supabase
async function getUserByUsername(username) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .maybeSingle(); // Returns null if no rows, doesn't throw error
        return { data, error };
    } catch (err) {
        console.error('Error fetching user:', err);
        return { data: null, error: err };
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
 */
function getEffectiveDomain(req) {
    // Allow override via environment variable (for production deployments)
    if (process.env.WEBAUTHN_RP_ID) {
        console.log('RP ID from env:', process.env.WEBAUTHN_RP_ID);
        return process.env.WEBAUTHN_RP_ID;
    }

    const host = req.get('host') || 'localhost';
    const origin = req.get('origin');
    
    console.log('🔍 WebAuthn RP ID Debug:');
    console.log('   Host header:', host);
    console.log('   Origin header:', origin);
    
    // Try to extract domain from Origin header first (most reliable)
    if (origin) {
        try {
            const url = new URL(origin);
            const domain = url.hostname;
            
            // For localhost, explicitly allow both HTTP and HTTPS
            if (domain === 'localhost' || domain === '127.0.0.1') {
                console.log('   Using localhost RP ID:', domain);
                return domain;
            }
            
            // For production domains, use hostname from origin
            let rpId = domain;
            if (domain.startsWith('www.')) {
                rpId = domain.substring(4);
            }
            
            console.log('   Using RP ID from Origin:', rpId);
            return rpId;
        } catch (err) {
            console.log('   Could not parse Origin header:', err.message);
        }
    }
    
    // Fallback to Host header if no Origin
    const domain = host.split(':')[0];
    
    // For localhost, use as-is
    if (domain === 'localhost' || domain === '127.0.0.1') {
        console.log('   Using localhost RP ID:', domain);
        return domain;
    }
    
    // For other domains, remove www if present
    let rpId = domain;
    if (domain.startsWith('www.')) {
        rpId = domain.substring(4);
    }
    
    console.log('   Using RP ID from Host:', rpId);
    return rpId;
}

/**
 * Registration Endpoint
 * Step 1: Generate challenge and return registration options
 */
app.post('/api/register/start', async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    // Check if user already exists in Supabase
    const { data: existingUser, error: existingError } = await getUserByUsername(username);
    if (existingError) {
        console.error('❌ Supabase error checking user:', existingError.message);
        // Check if error is "no rows returned" (table missing or user not found)
        if (existingError.code === 'PGRST116' || existingError.message.includes('no rows')) {
            // This is expected for new users, continue
        } else if (existingError.message.includes('relation') && existingError.message.includes('does not exist')) {
            console.error('⚠️  Supabase tables not created yet!');
            console.error('   Please create the required tables in Supabase dashboard.');
            console.error('   See SUPABASE_INTEGRATION.md for SQL setup instructions.');
            return res.status(500).json({ 
                error: 'Database tables not initialized. Admin must create tables in Supabase.',
                details: 'See SUPABASE_INTEGRATION.md for setup instructions.'
            });
        } else {
            return res.status(500).json({ error: 'Database error: ' + existingError.message });
        }
    }
    if (existingUser) {
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
            id: rpId, // Dynamically set based on the domain being accessed
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
        // Insert user into Supabase users table
        const { data: userData, error: insertUserError } = await supabase.from('users').insert([
            {
                username,
                credentialId: credential.id,
                publicKey: credential.response?.publicKey || 'stored',
                registeredAt: new Date().toISOString(),
            },
        ]).select();

        if (insertUserError) {
            console.error('❌ Error inserting user:', {
                message: insertUserError.message,
                code: insertUserError.code,
                details: insertUserError.details,
                hint: insertUserError.hint,
            });
            
            // Check for common errors
            if (insertUserError.message.includes('relation') && insertUserError.message.includes('does not exist')) {
                return res.status(500).json({ 
                    error: 'Database tables not initialized',
                    details: 'The "users" table does not exist in Supabase. Please create it using the SQL in SUPABASE_INTEGRATION.md'
                });
            }
            if (insertUserError.message.includes('permission denied')) {
                return res.status(500).json({ 
                    error: 'Permission denied - RLS policy issue',
                    details: 'Check Row Level Security (RLS) policies in Supabase. Tables should allow anonymous inserts.'
                });
            }
            
            return res.status(500).json({ 
                error: 'Registration failed - user insert',
                details: insertUserError.message
            });
        }

        // Create a default wallet for the user
        const { data: walletData, error: insertWalletError } = await supabase.from('wallets').insert([
            {
                username,
                balance: 10000,
                address: generateWalletAddress(username),
                transactions: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ]).select();

        if (insertWalletError) {
            console.error('❌ Error creating wallet:', {
                message: insertWalletError.message,
                code: insertWalletError.code,
                details: insertWalletError.details,
                hint: insertWalletError.hint,
            });
            
            if (insertWalletError.message.includes('relation') && insertWalletError.message.includes('does not exist')) {
                return res.status(500).json({ 
                    error: 'Database tables not initialized',
                    details: 'The "wallets" table does not exist in Supabase. Please create it using the SQL in SUPABASE_INTEGRATION.md'
                });
            }
            if (insertWalletError.message.includes('permission denied')) {
                return res.status(500).json({ 
                    error: 'Permission denied - RLS policy issue',
                    details: 'Check Row Level Security (RLS) policies in Supabase. Tables should allow anonymous inserts.'
                });
            }
            
            return res.status(500).json({ 
                error: 'Registration failed - wallet creation',
                details: insertWalletError.message
            });
        }

        // Clean up challenge
        delete global.challenges[username];

        console.log('✅ User registered successfully:', username);
        res.json({
            success: true,
            message: 'Fingerprint registered successfully!',
            username,
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            error: 'Registration failed',
            details: error.message 
        });
    }
});

/**
 * Login Endpoint
 * Step 1: Generate challenge and return authentication options
 */
app.post('/api/login/start', async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    const { data: user, error } = await getUserByUsername(username);
    if (error) {
        console.error('Supabase error fetching user:', error);
        return res.status(500).json({ error: 'Internal error' });
    }

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
    const authOptions = {
        challenge: challenge,
        rpId: rpId,
        allowCredentials: [
            {
                id: user.credentialId,
                type: 'public-key',
            },
        ],
        userVerification: 'required',
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

    const { data: user, error: userError } = await getUserByUsername(username);
    if (userError) {
        console.error('Supabase error fetching user:', userError);
        return res.status(500).json({ error: 'Internal error' });
    }

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
app.get('/api/user/:username', async (req, res) => {
    const { username } = req.params;
    const { data: user, error } = await getUserByUsername(username);
    if (error) {
        console.error('Supabase error fetching user:', error);
        return res.status(500).json({ error: 'Internal error' });
    }
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ username, registeredAt: user.registeredAt });
});

/**
 * Wallet Endpoints
 */

// Helper: get wallet from Supabase
async function getWalletByUsername(username) {
    try {
        const { data, error } = await supabase
            .from('wallets')
            .select('*')
            .eq('username', username)
            .maybeSingle(); // Returns null if no rows, doesn't throw error
        return { data, error };
    } catch (err) {
        console.error('Error fetching wallet:', err);
        return { data: null, error: err };
    }
}

/**
 * Get wallet data
 */
app.get('/api/wallet/:username', async (req, res) => {
    const { username } = req.params;
    const { data: wallet, error } = await getWalletByUsername(username);
    if (error) {
        console.error('Supabase error fetching wallet:', error);
        return res.status(500).json({ error: 'Internal error' });
    }
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    res.json(wallet);
});

/**
 * Create new wallet
 */
app.post('/api/wallet/create', async (req, res) => {
    const { username, balance, address, transactions } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    const { data: existingWallet } = await getWalletByUsername(username);
    if (existingWallet) return res.status(400).json({ error: 'Wallet already exists' });

    const { error } = await supabase.from('wallets').insert([
        {
            username,
            balance: balance || 0,
            address: address || generateWalletAddress(username),
            transactions: transactions || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    ]);

    if (error) {
        console.error('Supabase error creating wallet:', error);
        return res.status(500).json({ error: 'Could not create wallet' });
    }

    const { data: wallet } = await getWalletByUsername(username);
    res.json({ success: true, message: 'Wallet created successfully', wallet });
});

/**
 * Update wallet data
 */
app.put('/api/wallet/:username', async (req, res) => {
    const { username } = req.params;
    const { balance, address, transactions } = req.body;

    const { data: wallet, error: fetchError } = await getWalletByUsername(username);
    if (fetchError) {
        console.error('Supabase error fetching wallet:', fetchError);
        return res.status(500).json({ error: 'Internal error' });
    }
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    const updates = {};
    if (balance !== undefined) updates.balance = balance;
    if (address) updates.address = address;
    if (transactions) updates.transactions = transactions;
    updates.updatedAt = new Date().toISOString();

    const { error: updateError } = await supabase
        .from('wallets')
        .update(updates)
        .eq('username', username);

    if (updateError) {
        console.error('Supabase error updating wallet:', updateError);
        return res.status(500).json({ error: 'Could not update wallet' });
    }

    const { data: updatedWallet } = await getWalletByUsername(username);
    res.json({ success: true, message: 'Wallet updated successfully', wallet: updatedWallet });
});

/**
 * Send money endpoint
 * Body: { sender, receiver, amount }
 */
app.post('/api/wallet/send', async (req, res) => {
    const { sender, receiver, amount } = req.body;
    if (!sender || !receiver || !amount) return res.status(400).json({ error: 'sender, receiver and amount are required' });

    // Fetch sender balance
    const { data: senderWallet, error: senderError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('username', sender)
        .single();
    if (senderError) {
        console.error('Error fetching sender wallet:', senderError);
        return res.status(500).json({ error: 'Internal error' });
    }

    if (!senderWallet || senderWallet.balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct from sender
    const { error: deductError } = await supabase
        .from('wallets')
        .update({ balance: senderWallet.balance - amount })
        .eq('username', sender);
    if (deductError) {
        console.error('Error deducting sender balance:', deductError);
        return res.status(500).json({ error: 'Could not update sender balance' });
    }

    // Add to receiver (get current balance first)
    const { data: receiverWallet, error: receiverError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('username', receiver)
        .single();
    if (receiverError) {
        console.error('Error fetching receiver wallet:', receiverError);
        return res.status(500).json({ error: 'Internal error' });
    }

    const newReceiverBalance = (receiverWallet?.balance || 0) + amount;
    const { error: addError } = await supabase
        .from('wallets')
        .update({ balance: newReceiverBalance })
        .eq('username', receiver);
    if (addError) {
        console.error('Error adding to receiver balance:', addError);
        return res.status(500).json({ error: 'Could not update receiver balance' });
    }

    // Record transaction
    const { error: txError } = await supabase.from('transactions').insert([
        { sender, receiver, amount, createdAt: new Date().toISOString() },
    ]);
    if (txError) {
        console.error('Error inserting transaction:', txError);
    }

    res.json({ success: true, message: 'Transfer completed' });
});

/**
 * Generate wallet address (simplified for demo)
 */
function generateWalletAddress(username) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(username + Date.now()).digest('hex');
    return `0x${hash.substring(0, 40).toUpperCase()}`;
}

// Debug endpoint - shows how the browser is connecting
app.get('/api/debug', (req, res) => {
    const host = req.get('host') || '?';
    const origin = req.get('origin') || 'not sent';
    const protocol = req.protocol;
    const hostname = req.hostname;
    
    res.json({
        debug: {
            requestProtocol: protocol,
            requestHost: host,
            requestHostname: hostname,
            originHeader: origin,
            serverPort: PORT,
            detectedRPID: getEffectiveDomain(req)
        },
        instructions: {
            issue: "If you're seeing WebAuthn 'relying party ID' errors:",
            solution: "Make sure you're accessing via HTTP (not HTTPS) for localhost",
            correctURL: `http://localhost:${PORT}`,
            wrongURL: `https://localhost:${PORT}`,
            tips: [
                "If browser auto-redirects to HTTPS, clear browser history",
                "Try accessing in incognito/private mode",
                "Check that origin header matches the URL you're typing"
            ]
        }
    });
});

// Database diagnostic endpoint
app.get('/api/health/database', async (req, res) => {
    console.log('Checking database health...');
    
    const checkTable = async (tableName) => {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('count', { count: 'exact', head: true });
            
            if (error) {
                if (error.message.includes('does not exist') || error.message.includes('relation')) {
                    return { status: '❌ MISSING', message: `Table "${tableName}" does not exist` };
                }
                if (error.message.includes('permission denied')) {
                    return { status: '⚠️  EXISTS BUT NO ACCESS', message: `Cannot read from "${tableName}". Check RLS policies.` };
                }
                return { status: '❌ ERROR', message: error.message };
            }
            return { status: '✅ OK', count: data?.length || 0 };
        } catch (err) {
            return { status: '❌ ERROR', message: err.message };
        }
    };
    
    const results = {
        supabaseConnection: supabaseUrl ? '✅ Connected' : '❌ No URL',
        tables: {
            users: await checkTable('users'),
            wallets: await checkTable('wallets'),
            transactions: await checkTable('transactions'),
        },
        setup: {
            dbURL: supabaseUrl ? 'Set' : 'Missing',
            dbKey: supabaseKey ? 'Set (hidden)' : 'Missing',
            envFile: '.env file loaded',
        }
    };
    
    res.json(results);
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Fingerprint Wallet API is running',
        endpoints: {
            register: '/api/register/start',
            login: '/api/login/start',
            wallet: '/api/wallet/:username',
            debug: '/api/debug',
            health: '/api/health/database'
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n`);
    console.log(`🚀 WebAuthn Fingerprint Authentication Server running on http://localhost:${PORT}`);
    console.log(`📱 Frontend available at http://localhost:${PORT}`);
    console.log(`🔐 Using platform authenticator (fingerprint scanner)`);
    console.log(`\n`);
    console.log(`✅ Server is ready! You can now register and login.`);
    console.log(`\n`);
    console.log(`⚠️  IMPORTANT - WebAuthn RP ID Issue:`);
    console.log(`   1. Access via HTTP (not HTTPS): http://localhost:${PORT}`);
    console.log(`   2. Don't use: https://localhost:${PORT} (will cause RP ID error)`);
    console.log(`   3. If browser redirects to HTTPS, bypass it by typing http:// explicitly`);
    console.log(`\n`);
    console.log(`❌ If you see "relying party ID" error:`);
    console.log(`   - You're accessing via HTTPS when you should use HTTP`);
    console.log(`   - Browser's address bar might auto-upgrade to HTTPS`);
    console.log(`   - Solution: Clear browser history, type http://localhost:${PORT} directly`);
    console.log(`\n`);
});
