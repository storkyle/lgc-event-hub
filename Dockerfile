# Build stage
FROM node:20.19.5-slim AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy package files
COPY ./package.json ./
COPY ./pnpm-lock.yaml ./
COPY tsconfig.json ./

# Install dependencies
RUN pnpm install

# Copy source
COPY src ./src

# Build TypeScript
RUN pnpm run build

# Production stage
FROM node:20.19.5-slim

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Copy schema for initialization
COPY schema.sql ./

# Set non-root user
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Default command (can be overridden)
CMD ["node", "dist/api/server.js"]

