// src/api/routes/automations.ts
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../db/client'
import { monitorQueue } from '../../queue/queues'
import { logger, dbLog } from '../../services/logger'

export const automationsRouter = Router()

type AuthRequest = Request & { userId: string }

const createSchema = z.object({
  name: z.string().min(1).max(100),
  sourceType: z.enum(['YOUTUBE', 'VIMEO', 'RSS', 'WEBSITE', 'CUSTOM']),
  sourceUrl: z.string().url(),
  channelName: z.string().optional(),
  clipDuration: z.number().int().refine((v) => [10, 15, 30, 45, 60].includes(v), {
    message: 'clipDuration must be 10, 15, 30, 45, or 60',
  }),
  pollingInterval: z.number().int().min(5).max(60).default(5),
  publishTargets: z
    .array(
      z.object({
        platform: z.enum(['YOUTUBE', 'INSTAGRAM', 'FACEBOOK']),
        privacy: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).default('PUBLIC'),
      })
    )
    .min(1),
})

// ── GET /api/automations ───────────────────────────────────
automationsRouter.get('/', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId

  const automations = await prisma.automation.findMany({
    where: { userId },
    include: {
      publishTargets: true,
      _count: { select: { videos: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Attach stats
  const withStats = await Promise.all(
    automations.map(async (a) => {
      const [clips, published, failed] = await Promise.all([
        prisma.generatedClip.count({
          where: { sourceVideo: { automationId: a.id } },
        }),
        prisma.publication.count({
          where: { clip: { sourceVideo: { automationId: a.id } }, status: 'PUBLISHED' },
        }),
        prisma.publication.count({
          where: { clip: { sourceVideo: { automationId: a.id } }, status: 'FAILED' },
        }),
      ])
      return { ...a, stats: { videosFound: a._count.videos, clipsGenerated: clips, published, failed } }
    })
  )

  res.json(withStats)
})

// ── POST /api/automations ──────────────────────────────────
automationsRouter.post('/', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { name, sourceType, sourceUrl, channelName, clipDuration, pollingInterval, publishTargets } =
    parsed.data

  const automation = await prisma.automation.create({
    data: {
      userId,
      name,
      sourceType,
      sourceUrl,
      channelName,
      clipDuration,
      pollingInterval,
      status: 'RUNNING',
      publishTargets: {
        create: publishTargets,
      },
    },
    include: { publishTargets: true },
  })

  // Schedule first monitor check immediately
  await scheduleMonitorJob(automation.id, userId, pollingInterval)
  await dbLog('INFO', 'agent', `Automation created: "${name}"`, automation.id)

  logger.info('[automations] Created', { automationId: automation.id, name })
  res.status(201).json(automation)
})

// ── PATCH /api/automations/:id/status ─────────────────────
automationsRouter.patch('/:id/status', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId
  const { id } = req.params
  const { status } = req.body as { status: 'RUNNING' | 'PAUSED' }

  if (!['RUNNING', 'PAUSED'].includes(status)) {
    return res.status(400).json({ error: 'status must be RUNNING or PAUSED' })
  }

  const automation = await prisma.automation.findUnique({ where: { id } })
  if (!automation || automation.userId !== userId) {
    return res.status(404).json({ error: 'Automation not found' })
  }

  await prisma.automation.update({ where: { id }, data: { status } })

  if (status === 'RUNNING') {
    await scheduleMonitorJob(id, userId, automation.pollingInterval)
    await dbLog('INFO', 'agent', 'Automation resumed', id)
  } else {
    await dbLog('INFO', 'agent', 'Automation paused', id)
  }

  res.json({ success: true, status })
})

// ── DELETE /api/automations/:id ───────────────────────────
automationsRouter.delete('/:id', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId
  const { id } = req.params

  const automation = await prisma.automation.findUnique({ where: { id } })
  if (!automation || automation.userId !== userId) {
    return res.status(404).json({ error: 'Automation not found' })
  }

  await prisma.automation.delete({ where: { id } })
  logger.info('[automations] Deleted', { id })
  res.json({ success: true })
})

// ── Helper: schedule recurring monitor job ─────────────────
async function scheduleMonitorJob(automationId: string, userId: string, intervalMinutes: number) {
  const repeatKey = `monitor-repeat:${automationId}`
  const everyMs = intervalMinutes * 60 * 1000

  // Remove any existing repeatable jobs for this automation (BullMQ v5 API)
  const repeatableJobs = await monitorQueue.getRepeatableJobs()
  for (const job of repeatableJobs) {
    if (job.key && job.key.includes(automationId)) {
      await monitorQueue.removeRepeatableByKey(job.key)
    }
  }

  // Schedule repeating job
  await monitorQueue.add(
    'monitor',
    { automationId, userId },
    {
      repeat: { every: everyMs },
      jobId: repeatKey,
    }
  )

  // Also run immediately
  await monitorQueue.add(
    'monitor-immediate',
    { automationId, userId },
    { jobId: `monitor-now-${automationId}-${Date.now()}` }
  )
}
