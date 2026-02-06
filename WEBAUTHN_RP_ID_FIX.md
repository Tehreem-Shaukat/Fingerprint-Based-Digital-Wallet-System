# WebAuthn RP ID Troubleshooting

If you see the error:
```
The relying party ID is not a registrable domain suffix of, nor equal to the current domain.
Subsequently, an attempt to fetch the .well-known/webauthn resource of the claimed RP ID failed.
```

This means the **RP ID (Relying Party ID) doesn't match your current domain**. Follow these solutions:

---

## 🔍 Quick Diagnosis

The server logs what RP ID it's using:
```bash
# Check server logs
tail -f backend/server.log | grep "RP ID"
```

Look for output like:
```
🔍 WebAuthn RP ID Debug:
   Host header: localhost:3000
   Origin header: https://localhost:3000
   Using localhost RP ID: localhost
```

---

## ✅ Solution 1: Make sure frontend and backend match (localhost)

**Problem:** Frontend accessed from `https://localhost:3000`, backend on `http://localhost:3000`

**Solution:** Access both via **same protocol**

```bash
# Start server
cd backend
npm start
# Server runs on: http://localhost:3000

# In browser, visit:
http://localhost:3000  # ✅ Correct (HTTP)
# NOT https://localhost:3000  # ❌ Wrong (HTTPS)
```

### Why HTTP for localhost?
- Localhost doesn't need HTTPS for development
- WebAuthn is strict about protocol matching
- HTTPS is only required for production domains

---

## ✅ Solution 2: Set explicit RP ID (for Railway/Production)

If you're deploying to Railway or another domain:

1. **Add to `.env`:**
```env
SUPABASE_URL=https://evbijalarfligildciyy.supabase.co
SUPABASE_KEY=sb_publishable_z7D-_4AQFZMcGI6XvKGz7g_EczRID1q
WEBAUTHN_RP_ID=your-domain.railway.app
```

2. **Restart server:**
```bash
npm start
```

3. **Access via the exact domain:**
```
https://your-domain.railway.app
```

No `http://`, no IP addresses, no deviations!

---

## ✅ Solution 3: Check your access URL

WebAuthn is very strict:

| You're accessing | RP ID should be | Status |
|------------------|-----------------|--------|
| `http://localhost:3000` | `localhost` | ✅ Works |
| `https://localhost:3000` | `localhost` | ❌ Fails (protocol mismatch) |
| `http://127.0.0.1:3000` | `127.0.0.1` | ✅ Works |
| `https://example.com` | `example.com` | ✅ Works |
| `https://www.example.com` | `example.com` | ✅ Works (www stripped) |
| `http://example.com` | `example.com` | ❌ Fails (HTTPS required for domains) |

**Key rule:** The RP ID must **exactly match** the domain portion of your URL (minus www and port).

---

## 🔧 Advanced: Manual RP ID Configuration

If auto-detection isn't working, manually set it:

### Option 1: Environment Variable (Recommended)
```bash
# backend/.env
WEBAUTHN_RP_ID=localhost
# or
WEBAUTHN_RP_ID=my-app.railway.app
```

### Option 2: Modify Server Code
Edit `backend/server.js`, in `getEffectiveDomain()`:
```javascript
function getEffectiveDomain(req) {
    // Force a specific RP ID
    return 'localhost'; // or your domain
}
```

---

## 🐛 Debug: Enable Verbose Logging

To see exactly what's happening:

```bash
# Edit backend/server.js and find the registration endpoint
# Look for the console.log statements
# They'll show:
# - What domain the browser sent
# - What RP ID the server is using
# - What hostname was detected
```

Check logs with:
```bash
tail -f backend/server.log | grep -A 5 "RP ID Debug"
```

---

## 📋 Common Scenarios

### Scenario 1: Local Development
```
Access URL:        http://localhost:3000
Server running:    http://localhost:3000
RP ID:            localhost
Result:           ✅ Works
```

### Scenario 2: Railway Deployment
```
Access URL:        https://my-app.railway.app
Server running:    Railway (on their domain)
RP ID:            my-app.railway.app
Result:           ✅ Works (set WEBAUTHN_RP_ID env var)
```

### Scenario 3: Local with HTTPS Mismatch (Common Error!)
```
Access URL:        https://localhost:3000
Server running:    http://localhost:3000
RP ID auto-detect: localhost
Result:           ❌ FAILS (protocol mismatch)
Fix:              Access via http://localhost:3000
```

---

## ✨ Testing RP ID

After fixing, test with:

```bash
curl -X POST http://localhost:3000/api/register/start \
  -H "Content-Type: application/json" \
  -d '{"username":"test"}'
```

You should get back a challenge with `"rp": {"id": "localhost"}` or your configured RP ID.

---

## 🔗 Resources

- [WebAuthn Security Models](https://www.w3.org/TR/webauthn-2/#security-model)
- [RP ID Comparison](https://www.w3.org/TR/webauthn-2/#rp-id)
- [FIDO Alliance FAQ](https://fidoalliance.org/fido-webauthn-myths/)

---

## Still not working?

1. **Check browser console** - Press F12, see actual error
2. **Check server logs** - `tail backend/server.log`
3. **Verify domain matches** - No typos, exact match required
4. **Use HTTP for localhost** - Don't use HTTPS in development
5. **Reset credentials** - Register a completely new user after fixing

Contact support if still failing after these steps!
