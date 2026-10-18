# Base
FROM oven/bun:1 AS base
WORKDIR /app
ENV NODE_ENV=production

# Dependencies
FROM base AS deps
COPY package.json bun.lock ./

# Install all dependencies because the build may require devDependencies
RUN bun install --frozen-lockfile

# Build
FROM deps AS builder

COPY tsconfig.json ./
COPY src ./src

# If you have other build-time files, copy them here.
# COPY prisma ./prisma
# COPY drizzle ./drizzle

RUN bun run build

# Production dependencies

FROM base AS prod-deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Production runtime
FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

# Create/use the existing non-root node user
USER node

# Production dependencies
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules

# Package metadata
COPY --from=builder --chown=node:node /app/package.json ./package.json

# Compiled application
COPY --from=builder --chown=node:node /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/server.js"]