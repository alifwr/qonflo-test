FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY apps/backend/package.json apps/backend/tsconfig.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

RUN npm ci --ignore-scripts

COPY packages/shared/src ./packages/shared/src
COPY apps/backend/src ./apps/backend/src

RUN npm rebuild better-sqlite3 \
  && npm run build -w @mtm/shared \
  && npm run build -w @mtm/backend \
  && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app /app
RUN mkdir -p /app/apps/backend/data \
  && chown -R node:node /app

WORKDIR /app/apps/backend
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
