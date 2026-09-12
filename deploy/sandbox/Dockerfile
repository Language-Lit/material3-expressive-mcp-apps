FROM node:24-bookworm-slim AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run sandbox:build

FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=build --chown=node:node /build/deploy/sandbox/dist ./
USER node
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
