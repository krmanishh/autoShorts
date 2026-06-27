// src/index.ts
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { authRouter } from './api/routes/auth'
import { automationsRouter } from './api/routes/automations'
import { dashboardRouter } from './api/routes/dashboard'
import { queuesRouter } from './api/routes/queues'
import { requireAuth } from './api/middleware/auth'
import { authLimiter, apiLimiter } from './api/middleware/rateLimit'
import { logger } from './services/logger'
import { prisma } from './db/client'
import { monitorQueue, clipQueue, publishQueue, redisConnection } from './queue/queues'
import fs from 'fs'

// Ensure tmp dirs exist
fs.mkdirSync('tmp/downloads', { recursive: true })
fs.mkdirSync('tmp/clips', { recursive: true })
fs.mkdirSync('logs', { recursive: true })

const app = express()
const PORT = process.env.PORT ?? 3001

// ── Middleware ─────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // allow iframes in dashboard
}))
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev', { stream: { write: (msg) => logger.info(msg.trim()) } }))

// ── Rate limiting ──────────────────────────────────────────
app.use('/api/auth', authLimiter)
app.use('/api', apiLimiter)

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/automations', requireAuth, automationsRouter)
app.use('/api/dashboard', requireAuth, dashboardRouter)
app.use('/api/queues', requireAuth, queuesRouter)

// ── Health check (detailed) ────────────────────────────────
app.get('/health', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {}

  // DB
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
  }

  // Redis
  try {
    await redisConnection.ping()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'error'
  }

  // Queue depths
  let queueCounts = {}
  try {
    const [m, c, p] = await Promise.all([
      monitorQueue.getJobCounts('waiting', 'active', 'failed'),
      clipQueue.getJobCounts('waiting', 'active', 'failed'),
      publishQueue.getJobCounts('waiting', 'active', 'failed'),
    ])
    queueCounts = { monitor: m, clip: c, publish: p }
  } catch { /* non-fatal */ }

  const allOk = Object.values(checks).every(v => v === 'ok')

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    queues: queueCounts,
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version ?? '1.0.0',
  })
})

// ── 404 catch-all ──────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// ── Global error handler ───────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { err: err.message, stack: err.stack })
  res.status(500).json({ error: 'Internal server error' })
})

// ── Start ──────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`AutoShorts API running on http://localhost:${PORT}`)
})

// ── Graceful shutdown ──────────────────────────────────────
let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info(`Received ${signal} — shutting down gracefully`)

  // Stop accepting new connections
  server.close(async () => {
    try {
      // Close queues, then the underlying redis connection they share
      await Promise.allSettled([
        monitorQueue.close(),
        clipQueue.close(),
        publishQueue.close(),
      ])
      await redisConnection.quit()
      await prisma.$disconnect()
      logger.info('Shutdown complete')
      process.exit(0)
    } catch (err) {
      logger.error('Error during shutdown', { err })
      process.exit(1)
    }
  })

  // Force exit after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10_000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { err: err.message, stack: err.stack })
  shutdown('uncaughtException')
})
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason })
})

export default app
