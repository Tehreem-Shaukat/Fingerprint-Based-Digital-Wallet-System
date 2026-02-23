# 🔧 WebAuthn RP ID Error - Quick Fix

The error **"The relying party ID is not a registrable domain suffix..."** means your browser is accessing the app via the **wrong protocol**.

---

## ⚡ Instant Fix

**Access the app via HTTP (not HTTPS):**

```
✅ CORRECT:   http://localhost:3000
❌ WRONG:     https://localhost:3000
```

### Why?
WebAuthn is strict - it requires the protocol to match exactly:
- If you visit `https://localhost:3000`, the RelierParty ID validation checks for HTTPS
- But the backend only has `http://localhost:3000`
- Mismatch = Error!

---

## 🔍 Verify Your Connection

Check if you're accessing via the correct protocol:

```bash
# If you see this debug info, you're on the correct protocol:
curl http://localhost:3000/api/debug
```

Output should show:
```json
{
  "debug": {
    "requestProtocol": "http",
    "originHeader": "not sent"
  }
}
```

If it shows `"requestProtocol": "https"` or `"originHeader": "https://..."` → **You're using HTTPS, switch to HTTP!**

---

## 🌐 Browser Auto-Redirect to HTTPS?

Some browsers/dev environments auto-redirect localhost to HTTPS. Fix it:

### Option 1: Clear HSTS Cache
If your browser cached the HTTP→HTTPS redirect:

**Chrome/Edge:**
1. Open `chrome://net-internals/#hsts`
2. Search for `localhost`
3. Delete it
4. Access `http://localhost:3000` again

**Firefox:**
1. Type `about:preferences#privacy` in address bar
2. Scroll to "Cookies and Site Data"
3. Click "Clear All"
4. Access `http://localhost:3000` again

### Option 2: Use Incognito/Private Mode
Fresh session = no cached redirects:
- Chrome: `Ctrl+Shift+N` (Windows) or `Cmd+Shift+N` (Mac)
- Firefox: `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
- Then access: `http://localhost:3000`

### Option 3: Different Browser
Try Chrome, Firefox, or Safari without HTTPS redirects:
```
http://localhost:3000
```

---

## 🛠️ Server Configuration

To explicitly check what RP ID the server is using:

```bash
# Check server initialization logs
cat backend/server.log | grep "RP ID"
```

You should see:
```
Using localhost RP ID: localhost
```

---

## 📱 For VS Code Simple Browser

If using VS Code's Simple Browser preview:

1. Click the link to open in full browser instead
2. Type `http://localhost:3000` manually
3. NOT `https://localhost:3000`

---

## 🚀 Production/Railway Deployment

If deploying to Railway, use HTTPS and set the RP ID:

```bash
# backend/.env
WEBAUTHN_RP_ID=your-domain.railway.app
```

Then access:
```
https://your-domain.railway.app
```

---

## ✅ Quick Checklist

- [ ] Accessing via `http://` (not `https://`)
- [ ] Using `localhost:3000` (not IP address)
- [ ] No browser redirect to `https://`
- [ ] Server logs show `Using localhost RP ID: localhost`
- [ ] Cleared browser cache/cookies if needed
- [ ] Tried incognito/private mode

---

## Still Failing?

```bash
# 1. Check what the browser is sending
curl http://localhost:3000/api/debug | jq '.debug'

# 2. Check server logs
tail -f backend/server.log | grep "RP ID Debug"

# 3. Check browser network tab (F12 → Network tab)
# Look at the request Origin header in the registration POST request

#  4. Check browser console for the exact error
# F12 → Console → See the actual WebAuthn error
```

The debug output will show you exactly what's mismatched!
