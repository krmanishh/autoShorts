FROM node:20-alpine AS base
WORKDIR /app

# ── Deps ──────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci

# ── Build ─────────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
# Inline env for build-time substitution
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# ── Production runner ─────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

# Next.js standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
