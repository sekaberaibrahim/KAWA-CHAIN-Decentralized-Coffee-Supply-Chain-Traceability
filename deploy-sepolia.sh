#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  KAWA·CHAIN — Deploy to Sepolia via Docker
# ═══════════════════════════════════════════════════════════

if [ -z "$DEPLOYER_KEY" ]; then
  echo ""
  echo "  Usage: DEPLOYER_KEY=0xYourKey ./deploy-sepolia.sh"
  echo ""
  echo "  How to get your private key from MetaMask:"
  echo "    1. Open MetaMask → click three dots (⋮)"
  echo "    2. Account details → Show private key"
  echo "    3. Enter your password and copy the key"
  echo ""
  echo "  How to get free Sepolia ETH:"
  echo "    → https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
  echo ""
  exit 1
fi

echo ""
echo "  Building deployment container..."
docker build -f docker/sepolia-deploy.Dockerfile -t kawa-deploy .

echo ""
echo "  Deploying to Sepolia (takes 1-3 minutes)..."
docker run --rm \
  -e DEPLOYER_KEY="$DEPLOYER_KEY" \
  -v "$(pwd)/frontend/src/lib:/app/frontend/src/lib" \
  kawa-deploy

echo ""
echo "  Done! Now start the frontend:"
echo "    docker compose -f docker-compose-sepolia.yml up --build"
echo "  Then open http://localhost:5173"
