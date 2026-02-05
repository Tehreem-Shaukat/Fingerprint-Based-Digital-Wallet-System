#!/bin/bash

echo "========================================"
echo "  Fingerprint Wallet - Starting Server"
echo "========================================"
echo ""

cd backend

echo "Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

echo "Starting server..."
echo ""
echo "Server will be available at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start
