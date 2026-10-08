FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/frontend ./apps/frontend
COPY apps/backend/package.json ./apps/backend/package.json

RUN npm ci --ignore-scripts \
  && npm run build -w @mtm/shared \
  && npm run build -w @mtm/frontend

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
