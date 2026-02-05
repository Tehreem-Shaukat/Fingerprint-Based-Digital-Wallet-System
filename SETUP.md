# 🚀 Quick Setup Guide

## Step 1: Install Dependencies

Open a terminal in the `backend` folder and run:

```bash
cd backend
npm install
```

This will install:
- `express` - Web server
- `cors` - Cross-origin resource sharing

## Step 2: Start the Server

```bash
npm start
```

You should see:
```
🚀 WebAuthn Fingerprint Authentication Server running on http://localhost:3000
📱 Frontend available at http://localhost:3000
🔐 Using platform authenticator (fingerprint scanner)
```

## Step 3: Open in Browser

1. Open your browser (Chrome, Edge, Firefox, or Safari)
2. Navigate to: `http://localhost:3000`
3. Make sure you're using **localhost** or **HTTPS** (WebAuthn requires secure context)

## Step 4: Test Registration

1. Enter a username (e.g., "testuser")
2. Click "Register Fingerprint"
3. Your device's fingerprint prompt should appear:
   - **Windows**: Windows Hello prompt
   - **Mac**: Touch ID prompt
   - **Android**: Fingerprint scanner prompt
4. Scan your fingerprint
5. You should see a success message

## Step 5: Test Login

1. Enter the same username
2. Click "Scan Fingerprint"
3. Scan your fingerprint again
4. You should see the dashboard with your login information

## Troubleshooting

### "WebAuthn is not supported"
- Make sure you're using a modern browser (Chrome 67+, Edge 18+, Firefox 60+, Safari 13+)
- Make sure you're on `localhost` or `https://` (not `http://` on a remote server)

### "Registration failed" or "Login failed"
- Check the browser console for errors
- Make sure the backend server is running
- Make sure your device has a fingerprint scanner set up

### Fingerprint prompt doesn't appear
- Make sure Windows Hello / Touch ID is set up on your device
- Check browser permissions for the site
- Try a different browser

## Development Mode

For development with auto-reload:

```bash
npm run dev
```

(Requires `nodemon` - install with `npm install -g nodemon`)

## Production Notes

For production deployment:
1. Use HTTPS (required for WebAuthn on non-localhost)
2. Update `rp.id` in `server.js` to your domain
3. Replace JSON file storage with a database
4. Implement proper signature verification
5. Add rate limiting and security headers
