# 🔧 Troubleshooting Guide

## "Failed to Fetch" Error - Quick Fix

If you're seeing a **"Failed to fetch"** error when trying to register, follow these steps:

---

## ✅ Step 1: Start the Backend Server

The most common cause is that the backend server is not running.

### Windows (PowerShell):
```powershell
cd backend
npm install
npm start
```

### Mac/Linux (Terminal):
```bash
cd backend
npm install
npm start
```

**You should see:**
```
🚀 WebAuthn Fingerprint Authentication Server running on http://localhost:3000
📱 Frontend available at http://localhost:3000
🔐 Using platform authenticator (fingerprint scanner)
```

---

## ✅ Step 2: Verify Server is Running

1. Open a new browser tab
2. Go to: `http://localhost:3000`
3. You should see a JSON response like:
   ```json
   {
     "status": "ok",
     "message": "Fingerprint Wallet API is running"
   }
   ```

If you see this, the server is running correctly!

---

## ✅ Step 3: Check Browser Console

1. Open browser Developer Tools (F12)
2. Go to the **Console** tab
3. Look for any error messages
4. Common errors:
   - `Failed to fetch` → Server not running
   - `CORS error` → CORS configuration issue
   - `Network error` → Connection problem

---

## ✅ Step 4: Verify Port 3000 is Available

If port 3000 is already in use, you'll get an error when starting the server.

### Check if port is in use:
**Windows:**
```powershell
netstat -ano | findstr :3000
```

**Mac/Linux:**
```bash
lsof -i :3000
```

### If port is in use:
1. Stop the other application using port 3000, OR
2. Change the port in `backend/server.js`:
   ```javascript
   const PORT = 3001; // Change to different port
   ```
3. Update `frontend/script.js`:
   ```javascript
   const API_BASE = 'http://localhost:3001/api'; // Match the new port
   ```

---

## ✅ Step 5: Check Dependencies

Make sure all dependencies are installed:

```bash
cd backend
npm install
```

You should see `node_modules` folder created in the `backend` directory.

---

## ✅ Step 6: Verify File Structure

Make sure your project structure looks like this:

```
fingerprint-wallet-html/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── node_modules/ (after npm install)
├── frontend/
│   ├── index.html
│   ├── script.js
│   └── style.css
└── README.md
```

---

## ✅ Step 7: Browser Requirements

- **Use localhost or 127.0.0.1** (WebAuthn requires secure context)
- **Modern browser:** Chrome 67+, Edge 18+, Firefox 60+, Safari 13+
- **HTTPS or localhost:** WebAuthn won't work on `http://` except for localhost

---

## ✅ Step 8: Clear Browser Cache

Sometimes cached files can cause issues:

1. Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
2. Clear cache and cookies
3. Refresh the page (`Ctrl+F5` or `Cmd+Shift+R`)

---

## 🔍 Common Error Messages

### "Cannot connect to server"
**Solution:** Start the backend server (see Step 1)

### "CORS policy error"
**Solution:** The server should have CORS enabled. Check `backend/server.js` line 24:
```javascript
app.use(cors()); // Should be present
```

### "WebAuthn is not supported"
**Solution:** 
- Use a modern browser
- Make sure you're on `localhost` or `https://`
- Check if your device has a fingerprint scanner

### "Registration failed"
**Solution:**
- Check browser console for detailed error
- Make sure fingerprint scanner is set up on your device
- Try a different browser

### "Username already exists"
**Solution:** 
- Use a different username, OR
- Delete `backend/users.json` to reset (for testing only)

---

### "Unexpected token '<'" or HTML response in console
This error means your frontend tried to parse an HTML page as JSON. It usually occurs when the app is calling the wrong backend URL (e.g. still pointing at `http://localhost:8080`) or the server returned an error page.

**How to fix:**
1. Confirm the API base URL is dynamic and matches the current origin.
   - Open browser console and look for a log like `Using HTTP API endpoint for localhost:` or the full `API_BASE` value.
   - When running in production, `API_BASE` should start with `https://` and your Railway domain.
2. Ensure you didn’t hard‑code `localhost` anywhere in `frontend/script.js` (the repo now uses `window.location.origin` logic).
3. The app now uses a `safeFetch()` helper which logs the first 200 characters of non‑JSON responses — check the console for those logs to identify the returned HTML.
4. Make sure the backend is actually reachable at that URL and not returning a 404/502 page from the hosting provider.

Once the API URL is correct the WebAuthn RP ID mismatch should also disappear.

---

## 🚀 Quick Test

Run this in your browser console (F12) to test the connection:

```javascript
fetch('http://localhost:3000/')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

**Expected output:**
```json
{
  "status": "ok",
  "message": "Fingerprint Wallet API is running"
}
```

If this works, the server is running correctly!

---

## 📞 Still Having Issues?

1. **Check the terminal** where the server is running for error messages
2. **Check browser console** (F12) for detailed errors
3. **Verify all files** are saved correctly
4. **Restart the server** (Ctrl+C to stop, then `npm start` again)
5. **Try a different browser** to rule out browser-specific issues

---

## ✅ Success Indicators

When everything is working correctly, you should:
- ✅ See server running message in terminal
- ✅ No errors in browser console
- ✅ Registration form loads without errors
- ✅ Clicking "Register Fingerprint" shows fingerprint prompt
- ✅ After scanning, see success message

---

**Most issues are resolved by simply starting the backend server!**
