# 🧱 Supabase Integration Guide

This guide walks you through integrating Supabase with the Fingerprint Wallet system to replace JSON file storage with a real database.

---

## 📋 Prerequisites

- A Supabase project URL and anon public key (provided by your instructor or admin)
- Node.js 18+ installed
- Backend running locally or on Railway

---

## 🔧 Step 1: Install Dependencies

Supabase client and dotenv are now included in `package.json`:

```bash
cd backend
npm install
```

**Installed packages:**
- `@supabase/supabase-js` - Supabase client library
- `dotenv` - Environment variable management

---

## 🔑 Step 2: Configure Environment Variables

### Local Development (`.env`)

Create a `.env` file in the `backend/` folder:

```env
SUPABASE_URL=https://evbijalarfligildciyy.supabase.co
SUPABASE_KEY=sb_publishable_z7D-_4AQFZMcGI6XvKGz7g_EczRID1q
PORT=3000
```

### Railway Deployment

Set these environment variables in Railway dashboard:

```
SUPABASE_URL = https://evbijalarfligildciyy.supabase.co
SUPABASE_KEY = sb_publishable_z7D-_4AQFZMcGI6XvKGz7g_EczRID1q
NODE_ENV = production
WEBAUTHN_RP_ID = fingerprint-based-digital-wallet-system-production.up.railway.app
```

**⚠️ Critical for WebAuthn:** The `WEBAUTHN_RP_ID` must be set to your exact Railway domain. This ensures WebAuthn authentication works correctly on production. RP ID must match the domain users access your app from.

**⚠️ Security Note:** The `SUPABASE_KEY` is the public anon key (safe to expose in frontend). Never commit `.env` to version control!

---

## 📊 Step 3: Create Supabase Tables

Log in to [Supabase Dashboard](https://supabase.com) and create these tables:

### Table 1: `users`

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  credentialId TEXT NOT NULL,
  publicKey TEXT,
  registeredAt TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Table 2: `wallets`

```sql
CREATE TABLE wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL REFERENCES users(username),
  balance BIGINT DEFAULT 10000,
  address TEXT,
  transactions JSONB DEFAULT '[]'::jsonb,
  createdAt TIMESTAMP WITH TIME ZONE,
  updatedAt TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Table 3: `transactions`

```sql
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender TEXT NOT NULL,
  receiver TEXT NOT NULL,
  amount BIGINT NOT NULL,
  createdAt TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## 🔄 Step 4: How Registration Works (Supabase Mode)

### Old Way (JSON)
```javascript
users[username] = { credentialId, publicKey, registeredAt };
wallets[username] = { balance: 10000, address, transactions: [] };
```

### New Way (Supabase)
```javascript
// Insert user record
await supabase.from('users').insert([{
  username,
  credentialId: credential.id,
  publicKey: credential.response?.publicKey || 'stored',
  registeredAt: new Date().toISOString()
}]);

// Create wallet automatically
await supabase.from('wallets').insert([{
  username,
  balance: 10000,
  address: generateWalletAddress(username),
  transactions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}]);
```

---

## 💳 Step 5: Get Wallet Balance

### Endpoint: `GET /api/wallet/:username`

```javascript
const { data: wallet, error } = await supabase
  .from('wallets')
  .select('balance')
  .eq('username', username)
  .single();

// Returns: { balance: 10000, ... }
```

---

## 💸 Step 6: Send Money (Transaction)

### Endpoint: `POST /api/wallet/send`

**Request body:**
```json
{
  "sender": "mikran",
  "receiver": "tehreem",
  "amount": 500
}
```

**How it works:**
1. Fetch sender's current balance from Supabase
2. Check if balance >= amount (prevent overdraft)
3. Deduct amount from sender's wallet
4. Add amount to receiver's wallet
5. Record transaction in `transactions` table

```javascript
// Fetch sender balance
const { data: senderWallet } = await supabase
  .from('wallets')
  .select('balance')
  .eq('username', sender)
  .single();

if (senderWallet.balance < amount) {
  return res.status(400).json({ error: 'Insufficient balance' });
}

// Deduct from sender
await supabase
  .from('wallets')
  .update({ balance: senderWallet.balance - amount })
  .eq('username', sender);

// Add to receiver
const { data: receiverWallet } = await supabase
  .from('wallets')
  .select('balance')
  .eq('username', receiver)
  .single();

await supabase
  .from('wallets')
  .update({ balance: receiverWallet.balance + amount })
  .eq('username', receiver);

// Record transaction
await supabase.from('transactions').insert([{
  sender,
  receiver,
  amount,
  createdAt: new Date().toISOString()
}]);
```

---

## ✅ Step 7: Start the Server

```bash
cd backend
npm start
```

You should see:
```
🚀 WebAuthn Fingerprint Authentication Server running on http://localhost:3000
✅ Server is ready! You can now register and login.
```

---

## 📁 File Changes Summary

### New Files
- `backend/supabase.js` - Supabase client initialization
- `backend/.env` - Environment variables (add to .gitignore!)
- `backend/.env.example` - Template for environment variables

### Deleted Files
- ❌ `backend/users.json` - Replaced by Supabase `users` table
- ❌ `backend/wallets.json` - Replaced by Supabase `wallets` table

### Modified Files
- `backend/server.js` - All endpoints now use Supabase queries
- `backend/package.json` - Added `@supabase/supabase-js` and `dotenv`

---

## 🌐 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/register/start` | Start WebAuthn registration |
| `POST` | `/api/register/complete` | Complete registration + create wallet |
| `POST` | `/api/login/start` | Start WebAuthn login challenge |
| `POST` | `/api/login/complete` | Complete login verification |
| `GET` | `/api/wallet/:username` | Get wallet balance & details |
| `POST` | `/api/wallet/send` | **NEW** - Transfer money |
| `POST` | `/api/wallet/create` | Create wallet (manual) |
| `PUT` | `/api/wallet/:username` | Update wallet |

---

## 🐛 Troubleshooting

### Error: "Cannot read properties of undefined (reading 'supabaseUrl')"
**Cause:** `.env` file not found or variables not loaded
**Fix:** 
```bash
# Make sure .env exists in backend/ folder
ls -la backend/.env

# Restart server
npm start
```

### Error: "Relation 'users' does not exist"
**Cause:** Supabase tables haven't been created yet
**Fix:** Create tables using the SQL queries in Step 3

### Error: "Invalid API Key"
**Cause:** Wrong or expired Supabase key
**Fix:** Check Supabase dashboard for correct public anon key

### Balance shows as 0 for new users
**Cause:** Wallet creation failed during registration
**Fix:** Check Supabase bucket permissions and `wallets` table status

---

## 🎯 Next Steps

1. **Test locally:** Register → Login → Send money
2. **Deploy to Railway:** Push code with `.env` vars set
3. **Monitor:** Check Supabase dashboard for data being stored
4. **Scale:** Use row-level security (RLS) policies for multi-tenant safety

---

## 📞 Support

For Supabase issues: https://supabase.com/docs
For WebAuthn issues: https://webauthn.io

Happy coding! 🚀
