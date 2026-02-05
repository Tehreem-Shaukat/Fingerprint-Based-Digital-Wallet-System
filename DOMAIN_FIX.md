# 🔧 Fix "This is an invalid domain" Error

## Problem
WebAuthn requires the domain to match exactly. If you're accessing the app via:
- `127.0.0.1:3000` instead of `localhost:3000`
- An IP address
- A different hostname

You'll get the error: **"This is an invalid domain"**

---

## ✅ Solution 1: Use localhost (Recommended)

**Always access the app using `localhost` instead of IP addresses:**

### ❌ Don't use:
```
http://127.0.0.1:3000
http://192.168.1.100:3000
```

### ✅ Use instead:
```
http://localhost:3000
```

---

## ✅ Solution 2: Updated Code

I've updated the backend to automatically detect and use the correct domain. The code now:
- ✅ Detects the origin from the request
- ✅ Converts IP addresses to 'localhost' automatically
- ✅ Handles both localhost and proper domains

**The fix is already applied!** Just make sure you're accessing via `localhost`.

---

## 🔍 How to Check

1. **Check your browser address bar:**
   - ✅ Should show: `http://localhost:3000`
   - ❌ Should NOT show: `http://127.0.0.1:3000`

2. **If you see an IP address:**
   - Change it to `localhost`
   - Or use the bookmark/favorite with `localhost`

---

## 📝 WebAuthn Domain Requirements

WebAuthn has strict security requirements:

### ✅ Valid Domains:
- `localhost` (for development)
- `example.com` (for production)
- `subdomain.example.com` (subdomains)

### ❌ Invalid Domains:
- `127.0.0.1` (IP addresses not allowed)
- `192.168.x.x` (private IPs not allowed)
- `::1` (IPv6 localhost not allowed)

---

## 🚀 Quick Fix Steps

1. **Stop the server** (if running)
2. **Start the server again:**
   ```bash
   cd backend
   npm start
   ```
3. **Open browser and go to:**
   ```
   http://localhost:3000
   ```
   (NOT `127.0.0.1`)
4. **Try registering again**

---

## 🔧 If You Must Use IP Address

If you absolutely need to access via IP (e.g., testing from another device), you have two options:

### Option 1: Use a Hostname
Add an entry to your `hosts` file:
- **Windows:** `C:\Windows\System32\drivers\etc\hosts`
- **Mac/Linux:** `/etc/hosts`

Add this line:
```
127.0.0.1    mywallet.local
```

Then access via: `http://mywallet.local:3000`

### Option 2: Use HTTPS with a Domain
For production, use a real domain with HTTPS (WebAuthn requires HTTPS for non-localhost).

---

## ✅ Verification

After the fix, you should:
1. ✅ Access via `http://localhost:3000`
2. ✅ See no "invalid domain" errors
3. ✅ Be able to register with fingerprint
4. ✅ See the fingerprint prompt appear

---

## 📚 Why This Happens

WebAuthn uses the domain as part of its security model:
- Prevents phishing attacks
- Ensures credentials are domain-bound
- Requires exact domain matching

This is a **security feature**, not a bug!

---

**Remember: Always use `localhost` for local development!**
