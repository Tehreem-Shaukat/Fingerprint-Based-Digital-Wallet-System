# 🚀 Quick Start Guide

## Fix "Failed to Fetch" Error

The **"Failed to fetch"** error means the backend server is not running. Here's how to fix it:

---

## ⚡ Quick Fix (3 Steps)

### Step 1: Open Terminal in Backend Folder
Navigate to the `backend` folder in your project.

### Step 2: Install Dependencies (First Time Only)
```bash
npm install
```

### Step 3: Start the Server
```bash
npm start
```

**You should see:**
```
🚀 WebAuthn Fingerprint Authentication Server running on http://localhost:3000
📱 Frontend available at http://localhost:3000
🔐 Using platform authenticator (fingerprint scanner)
```

---

## ✅ Verify It's Working

1. **Keep the terminal open** (don't close it - the server needs to keep running)
2. **Open your browser** and go to: `http://localhost:3000`
3. **Try registering** - it should work now!

---

## 🪟 Windows Users - Easy Way

Double-click `START_SERVER.bat` in the project root folder.

This will automatically:
- Check if dependencies are installed
- Install them if needed
- Start the server

---

## 🍎 Mac/Linux Users - Easy Way

Run this command in terminal:
```bash
chmod +x START_SERVER.sh
./START_SERVER.sh
```

---

## 🔍 Still Not Working?

### Check These:

1. **Is the server running?**
   - Look at the terminal - you should see the server messages
   - If not, run `npm start` again

2. **Is port 3000 available?**
   - Close any other applications using port 3000
   - Or change the port in `backend/server.js`

3. **Are dependencies installed?**
   - Make sure `node_modules` folder exists in `backend` folder
   - If not, run `npm install` in the `backend` folder

4. **Check browser console (F12)**
   - Look for specific error messages
   - The improved error handling will now show clearer messages

---

## 📝 What Changed

I've improved the error handling to:
- ✅ Show clearer error messages
- ✅ Detect when server is not running
- ✅ Provide helpful instructions
- ✅ Add server connection check on page load

---

## 🎯 Next Steps

Once the server is running:
1. ✅ Open `http://localhost:3000` in your browser
2. ✅ Enter a username (e.g., "mikran")
3. ✅ Click "Register Fingerprint"
4. ✅ Scan your fingerprint when prompted
5. ✅ Success! You can now login

---

**Remember: The server must be running for the app to work!**
