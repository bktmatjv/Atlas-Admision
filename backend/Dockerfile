FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY packages/motor/package.json packages/motor/package.json
RUN npm ci
COPY packages/motor/ packages/motor/
COPY backend/tsconfig.json backend/tsconfig.json
COPY backend/src/ backend/src/
RUN npm run build:api

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY packages/motor/package.json packages/motor/package.json
RUN npm ci --omit=dev --ignore-scripts --workspace=@atlas/backend --workspace=@atlas/motor && npm cache clean --force
COPY --from=build /app/backend/dist/ backend/dist/
COPY --from=build /app/packages/motor/dist/ packages/motor/dist/
COPY backend/data/ backend/data/
COPY backend/workers/ backend/workers/
RUN mkdir -p backend/uploads && chown node:node backend/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=6 CMD node -e "fetch('http://127.0.0.1:3000/api/v1/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node backend/dist/database/cli.js migrate && node backend/dist/database/cli.js import && exec node backend/dist/main.js"]
