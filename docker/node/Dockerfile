# Flux Print Shop Scheduling System - Node.js Container
# Node.js 22 LTS with pnpm for TypeScript development

FROM node:22-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Install additional tools
RUN apk add --no-cache \
    bash \
    git \
    curl

# Set working directory
WORKDIR /app

# The node:22-alpine image already has a 'node' user (uid 1000)
# Set ownership for the app directory
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Default command (keep container running for development)
CMD ["tail", "-f", "/dev/null"]
