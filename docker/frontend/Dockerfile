FROM node:22-alpine AS builder
WORKDIR /app

# Workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Package manifests (for pnpm install)
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
COPY packages/validator/package.json packages/validator/

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY apps/web/ apps/web/
COPY packages/types/ packages/types/
COPY packages/validator/ packages/validator/

# Frontend environment (build-time)
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

# Build (skip tsc type-check — Vite transpiles TS natively, type-check belongs in CI)
RUN pnpm --filter @flux/types build \
 && pnpm --filter @flux/schedule-validator build \
 && pnpm --filter web exec vite build

# Output: /app/apps/web/dist/
