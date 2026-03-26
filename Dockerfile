# ---------- Base builder ----------
FROM node:22-alpine AS builder

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace files first
COPY package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml ./

# Copy entire monorepo
COPY . .

# 🚀 Allow env.ts to skip strict validation during build
ENV NEXT_BUILD=1

# Install all deps
RUN pnpm install --frozen-lockfile

# Build ONLY nextjs app
RUN pnpm turbo run build --filter=@acme/nextjs

# ---------- Runner ----------
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone build
COPY --from=builder /app/apps/nextjs/.next/standalone ./
COPY --from=builder /app/apps/nextjs/.next/static ./apps/nextjs/.next/static
COPY --from=builder /app/apps/nextjs/public ./apps/nextjs/public

EXPOSE 3000

CMD ["node", "apps/nextjs/server.js"]
