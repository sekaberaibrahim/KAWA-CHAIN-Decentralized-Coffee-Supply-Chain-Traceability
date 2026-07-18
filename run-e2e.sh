#!/bin/bash
# Self-contained: starts a fresh Hardhat node, runs the e2e test, tears down.
set -u
cd "$(dirname "$0")"
PORT="${1:-8555}"

# Kill any prior node on this port
pkill -9 -f "hardhat node --port $PORT" 2>/dev/null
sleep 2

# Point the test at our port
sed "s|http://127.0.0.1:8545|http://127.0.0.1:$PORT|" test/e2e.js > test/.e2e_run.js

# Launch node with ALL fds detached so it never holds a caller pipe.
npx hardhat node --port "$PORT" >/tmp/hh_node.log 2>&1 </dev/null &
NODE_PID=$!

# Wait for RPC
READY=0
for i in $(seq 1 40); do
  if curl -s -X POST "http://127.0.0.1:$PORT" -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' 2>/dev/null | grep -q result; then
    READY=1; break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "NODE_FAILED_TO_START"
  tail -5 /tmp/hh_node.log
  kill -9 "$NODE_PID" 2>/dev/null
  rm -f test/.e2e_run.js
  exit 1
fi

node test/.e2e_run.js
RC=$?

kill -9 "$NODE_PID" 2>/dev/null
rm -f test/.e2e_run.js
exit $RC
