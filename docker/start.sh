#!/bin/bash
set -e

echo ""
echo "  KAWA·CHAIN — Sepolia deployment"
echo ""

if [ -z "$DEPLOYER_KEY" ]; then
  echo "  ERROR: pass your MetaMask private key"
  echo ""
  echo "  docker run -p 5173:5173 -e DEPLOYER_KEY=YourKeyHere kawa"
  echo ""
  echo "  Get your key:"
  echo "    MetaMask → three dots → Account details → Show private key"
  echo ""
  echo "  Get free Sepolia ETH first:"
  echo "    https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
  echo ""
  exit 1
fi

echo "  Deploying contracts to Sepolia (1-3 minutes)..."
echo ""
node scripts/deploy-sepolia.js

echo ""
echo "  Starting frontend..."
echo ""

cd frontend
exec npx vite --host 0.0.0.0 --port 5173
