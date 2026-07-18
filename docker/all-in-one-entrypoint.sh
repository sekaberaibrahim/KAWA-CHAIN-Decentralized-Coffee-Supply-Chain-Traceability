#!/bin/bash
set -e

echo ""
echo "══════════════════════════════════════════"
echo " KAWA·CHAIN — starting up"
echo "══════════════════════════════════════════"

# Check if contracts are already deployed (from a previous run with same image)
DEPLOYED=$(node -e "try{const d=require('./frontend/src/lib/deployment.json');console.log(d.contracts.ParticipantRegistry!=='DEPLOY_FIRST'?'yes':'no')}catch{console.log('no')}")

if [ "$DEPLOYED" = "yes" ]; then
  echo ""
  echo " Contracts already deployed — skipping deployment."
  echo " (To redeploy, rebuild the image: docker build -t kawa .)"
  echo ""
else
  # Need DEPLOYER_KEY to deploy
  if [ -z "$DEPLOYER_KEY" ]; then
    echo ""
    echo " ✗ DEPLOYER_KEY not set."
    echo ""
    echo " You need to pass your MetaMask private key:"
    echo ""
    echo "   docker run -p 5173:5173 -e DEPLOYER_KEY=0xYourKey kawa"
    echo ""
    echo " How to get your private key:"
    echo "   1. Open MetaMask"
    echo "   2. Click the three dots (⋮) next to your account"
    echo "   3. Click 'Account details'"
    echo "   4. Click 'Show private key'"
    echo "   5. Enter your MetaMask password"
    echo "   6. Copy the key (starts with 0x)"
    echo ""
    echo " Make sure you have Sepolia ETH first:"
    echo "   → https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
    echo ""
    exit 1
  fi

  echo ""
  echo " Deploying contracts to Sepolia..."
  echo " (this takes 1-3 minutes, be patient)"
  echo ""
  node scripts/deploy-sepolia.js
fi

echo ""
echo " Starting frontend..."
echo ""
echo "══════════════════════════════════════════"
echo " Open in your browser:"
echo ""
echo "   http://localhost:5173"
echo ""
echo " MetaMask: switch to Sepolia network"
echo "══════════════════════════════════════════"
echo ""

cd frontend
npx vite --host 0.0.0.0 --port 5173
