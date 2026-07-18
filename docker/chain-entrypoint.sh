#!/bin/bash
# Starts the Hardhat node, waits until the RPC answers, deploys the contracts,
# seeds demo data, then keeps the node in the foreground.
set -e

echo "──────────────────────────────────────────────"
echo " KAWA·CHAIN — starting local blockchain"
echo "──────────────────────────────────────────────"

# --hostname 0.0.0.0 so the node is reachable from outside the container
npx hardhat node --hostname 0.0.0.0 --port 8545 &
NODE_PID=$!

# Wait for the RPC to be ready
echo "Waiting for RPC…"
for i in $(seq 1 60); do
  if curl -s -X POST http://127.0.0.1:8545 \
      -H "Content-Type: application/json" \
      --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
      | grep -q result; then
    echo "RPC ready after ${i}s"
    break
  fi
  sleep 1
done

echo ""
echo "── Deploying contracts ──"
node scripts/deploy-standalone.js

echo ""
echo "── Seeding demo data ──"
node scripts/seed.js

echo ""
echo "──────────────────────────────────────────────"
echo " Blockchain ready on port 8545"
echo " Frontend:  http://localhost:5173"
echo " MetaMask RPC: http://127.0.0.1:8545  (chain id 31337)"
echo "──────────────────────────────────────────────"

# Hand the container over to the node process
wait $NODE_PID
