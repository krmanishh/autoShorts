// src/api/routes/dashboard.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../../db/client'
import { redisConnection } from '../../queue/queues'

export const dashboardRouter = Router()
type AuthRequest = Request & { userId: string }

// ── GET /api/dashboard/stats ───────────────────────────────
dashboardRouter.get('/stats', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId

  const automationIds = await prisma.automation
    .findMany({ where: { userId }, select: { id: true } })
    .then((r) => r.map((a) => a.id))

  const [videosProcessed, clipsGenerated, published, failed] = await Promise.all([
    prisma.sourceVideo.count({
      where: { automationId: { in: automationIds }, processingStatus: 'DONE' },
    }),
    prisma.generatedClip.count({
      where: { sourceVideo: { automationId: { in: automationIds } } },
    }),
    prisma.publication.count({
      where: { clip: { sourceVideo: { automationId: { in: automationIds } } }, status: 'PUBLISHED' },
    }),
    prisma.publication.count({
      where: { clip: { sourceVideo: { automationId: { in: automationIds } } }, status: 'FAILED' },
    }),
  ])

  res.json({ videosProcessed, clipsGenerated, published, failed })
})

// ── GET /api/dashboard/activity ───────────────────────────
dashboardRouter.get('/activity', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)

  const automationIds = await prisma.automation
    .findMany({ where: { userId }, select: { id: true } })
    .then((r) => r.map((a) => a.id))

  const logs = await prisma.systemLog.findMany({
    where: { automationId: { in: automationIds } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  res.json(logs)
})

// ── GET /api/dashboard/weekly ──────────────────────────────
dashboardRouter.get('/weekly', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId

  const automationIds = await prisma.automation
    .findMany({ where: { userId }, select: { id: true } })
    .then((r) => r.map((a) => a.id))

  // Published per day for last 7 days
  const days: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days[key] = 0
  }

  const pubs = await prisma.publication.findMany({
    where: {
      clip: { sourceVideo: { automationId: { in: automationIds } } },
      status: 'PUBLISHED',
      publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: { publishedAt: true },
  })

  for (const p of pubs) {
    if (!p.publishedAt) continue
    const key = p.publishedAt.toISOString().slice(0, 10)
    if (key in days) days[key]++
  }

  res.json(Object.entries(days).map(([date, count]) => ({ date, count })))
})

// ── GET /api/dashboard/clips ───────────────────────────────
dashboardRouter.get('/clips', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId
  const page = parseInt(req.query.page as string) || 1
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)

  const automationIds = await prisma.automation
    .findMany({ where: { userId }, select: { id: true } })
    .then((r) => r.map((a) => a.id))

  const clips = await prisma.generatedClip.findMany({
    where: { sourceVideo: { automationId: { in: automationIds } } },
    include: {
      sourceVideo: { select: { title: true, externalId: true, automation: { select: { name: true } } } },
      publications: { select: { platform: true, status: true, platformUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })

  res.json(clips)
})

// ── GET /api/dashboard/health ──────────────────────────────
// Authenticated health check the frontend can reach through axios + JWT
dashboardRouter.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, 'ok' | 'error'> = {}

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
  }

  try {
    await redisConnection.ping()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'error'
  }

  const allOk = Object.values(checks).every(v => v === 'ok')
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version ?? '1.0.0',
  })
})

// ── GET /api/dashboard/publications ───────────────────────
dashboardRouter.get('/publications', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId
  const page = parseInt(req.query.page as string) || 1
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)

  const automationIds = await prisma.automation
    .findMany({ where: { userId }, select: { id: true } })
    .then((r) => r.map((a) => a.id))

  const publications = await prisma.publication.findMany({
    where: { clip: { sourceVideo: { automationId: { in: automationIds } } } },
    include: {
      clip: {
        select: {
          title: true,
          duration: true,
          sourceVideo: { select: { title: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })

  res.json(publications)
})
