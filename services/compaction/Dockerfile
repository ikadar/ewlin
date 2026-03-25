# Flux Compaction Service - Production Docker Image
# Multi-stage build for optimized image size
# Build context: monorepo root (for workspace dependencies)

# ===========================================
# Stage 1: Builder
# ===========================================
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration and package files
COPY package.json pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/validator/package.json ./packages/validator/
COPY services/compaction/package.json ./services/compaction/

# Scoped workspace — only include packages needed for this service
RUN printf "packages:\n  - 'packages/types'\n  - 'packages/validator'\n  - 'services/compaction'\n" > pnpm-workspace.yaml

# Install dependencies (scoped — skips unrelated packages like apps/web)
RUN pnpm install --frozen-lockfile

# Copy source code for types (dependency of validator)
COPY packages/types/tsconfig.json packages/types/tsconfig.base.json ./packages/types/
COPY packages/types/src ./packages/types/src

# Copy source code for validator (dependency of compaction)
COPY packages/validator/tsconfig.json packages/validator/tsconfig.base.json ./packages/validator/
COPY packages/validator/src ./packages/validator/src

# Copy source code for compaction service
COPY services/compaction/tsconfig.json services/compaction/tsconfig.base.json ./services/compaction/
COPY services/compaction/src ./services/compaction/src

# Build in dependency order: types -> validator -> compaction
WORKDIR /app/packages/types
RUN pnpm build

WORKDIR /app/packages/validator
RUN pnpm build

WORKDIR /app/services/compaction
RUN pnpm build

# ===========================================
# Stage 2: Production
# ===========================================
FROM node:22-alpine AS production

# Install pnpm, curl (for health checks), and tzdata (for timezone support)
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate \
    && apk add --no-cache curl tzdata

# Set working directory
WORKDIR /app

# Copy workspace configuration and package files
COPY package.json pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/validator/package.json ./packages/validator/
COPY services/compaction/package.json ./services/compaction/

# Scoped workspace (same as builder stage)
RUN printf "packages:\n  - 'packages/types'\n  - 'packages/validator'\n  - 'services/compaction'\n" > pnpm-workspace.yaml

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder stage
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/validator/dist ./packages/validator/dist
COPY --from=builder /app/services/compaction/dist ./services/compaction/dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3002

# Set working directory to the service
WORKDIR /app/services/compaction

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Run as non-root user (node user exists in node:alpine)
USER node

# Start the server
CMD ["node", "dist/index.js"]
