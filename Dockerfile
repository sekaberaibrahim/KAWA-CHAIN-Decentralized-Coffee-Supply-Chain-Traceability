FROM node:20-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY hardhat.config.js ./
COPY contracts ./contracts
COPY scripts ./scripts
RUN mkdir -p frontend/src/lib frontend/src/abis
RUN node scripts/compile-solc.js

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

COPY frontend/ ./frontend/

COPY docker/start.sh /start.sh
RUN sed -i 's/\r$//' /start.sh && chmod +x /start.sh

EXPOSE 5173
CMD ["/start.sh"]
