# ===========================================
# Multi-stage Docker Build for OpenAPI Partner
# Base Image: oven/bun (Alpine-based for small size)
# ===========================================

# ==================== Build Stage ====================
FROM oven/bun:canary-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Generate Drizzle migrations (if needed)
# RUN bun run db:generate

# Build Next.js application
RUN bun run build

# ==================== Runner Stage ====================
FROM oven/bun:canary-alpine AS runner

WORKDIR /app

# Create non-root user for better security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create data directory with correct permissions
RUN mkdir -p /app/data /app/logs && chown -R nextjs:nodejs /app

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy package.json for scripts
COPY --from=builder /app/package.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Expose the application port
EXPOSE 3000

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["bun", "run", "start"]
