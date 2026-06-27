FROM node:20-alpine AS base

# Install ffmpeg and yt-dlp
RUN apk add --no-cache ffmpeg python3 py3-pip curl && \
    pip3 install yt-dlp --break-system-packages

WORKDIR /app

# ── Dependencies ──────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

# ── Build ─────────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Production image ──────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN mkdir -p tmp/downloads tmp/clips logs

EXPOSE 3001

CMD ["node", "dist/index.js"]
