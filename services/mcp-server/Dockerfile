# Flux MCP Server - AI Scheduler Assistant
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
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY services/mcp-server/package.json ./services/mcp-server/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code for types (dependency)
COPY packages/types/tsconfig.json packages/types/tsconfig.base.json ./packages/types/
COPY packages/types/src ./packages/types/src

# Copy source code for mcp-server
COPY services/mcp-server/tsconfig.json services/mcp-server/tsconfig.base.json ./services/mcp-server/
COPY services/mcp-server/src ./services/mcp-server/src

# Build in dependency order: types -> mcp-server
WORKDIR /app/packages/types
RUN pnpm build

WORKDIR /app/services/mcp-server
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
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY services/mcp-server/package.json ./services/mcp-server/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder stage
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/services/mcp-server/dist ./services/mcp-server/dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3002

# Set working directory to the service
WORKDIR /app/services/mcp-server

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Run as non-root user
USER node

# Start the server
CMD ["node", "dist/index.js"]
