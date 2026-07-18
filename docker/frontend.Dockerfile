# KAWA-CHAIN frontend container: serves the React app with Vite.
FROM node:20-bookworm-slim

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

EXPOSE 5173
# --host 0.0.0.0 so the dev server is reachable from the host browser
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
