# One-shot container: deploys contracts to Sepolia testnet then exits.
# Usage:
#   docker build -f docker/sepolia-deploy.Dockerfile -t kawa-deploy .
#   docker run --rm -e DEPLOYER_KEY=0xYourKey -v "%cd%\frontend\src\lib:/app/frontend/src/lib" kawa-deploy
FROM node:20-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY hardhat.config.js ./
COPY contracts ./contracts
COPY scripts ./scripts
RUN mkdir -p frontend/src/lib
RUN node scripts/compile-solc.js

ENTRYPOINT ["node", "scripts/deploy-sepolia.js"]
