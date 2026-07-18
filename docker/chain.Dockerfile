# KAWA-CHAIN blockchain container:
# runs the Hardhat node, then auto-deploys the contracts and seeds demo data.
FROM node:20-bookworm-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json ./
RUN npm ci

# Project sources
COPY hardhat.config.js run-e2e.sh ./
COPY contracts ./contracts
COPY scripts ./scripts
COPY test ./test
RUN sed -i 's/\r$//' run-e2e.sh && chmod +x run-e2e.sh

# Compile contracts at build time (uses the npm solc package — no downloads)
RUN node scripts/compile-solc.js

# curl is used by the entrypoint to wait for the RPC to come up
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

# sed strips CRLF in case the file was checked out on Windows
COPY docker/chain-entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 8545
ENTRYPOINT ["/entrypoint.sh"]
