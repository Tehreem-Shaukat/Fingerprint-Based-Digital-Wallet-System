#!/bin/bash
# Generate self-signed certificate for localhost HTTPS development

CERT_DIR="./certs"
mkdir -p $CERT_DIR

# Generate private key and certificate valid for 365 days
openssl req -x509 -newkey rsa:2048 -keyout $CERT_DIR/key.pem -out $CERT_DIR/cert.pem -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

echo "✅ Self-signed certificates generated:"
echo "   Key:  $CERT_DIR/key.pem"
echo "   Cert: $CERT_DIR/cert.pem"
echo ""
echo "🔒 Server will now support HTTPS on port 3000"
echo "   Access via: https://localhost:3000"
