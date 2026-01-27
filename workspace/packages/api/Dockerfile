# Production Dockerfile for API Server
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Generate Prisma Client
RUN npx prisma generate

# Build stage
FROM base AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY src ./src/

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 contractor-passport

# Copy necessary files
COPY --from=deps --chown=contractor-passport:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=contractor-passport:nodejs /app/dist ./dist
COPY --from=builder --chown=contractor-passport:nodejs /app/prisma ./prisma
COPY --chown=contractor-passport:nodejs package*.json ./

# Create keys directory with proper permissions
RUN mkdir -p /app/keys && chown contractor-passport:nodejs /app/keys

USER contractor-passport

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start command
CMD ["node", "dist/server.js"]
