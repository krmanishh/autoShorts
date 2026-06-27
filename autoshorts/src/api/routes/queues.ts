// src/api/routes/queues.ts
import { Router, Request, Response } from 'express'
import { monitorQueue, clipQueue, publishQueue } from '../../queue/queues'

export const queuesRouter = Router()

type QueueName = 'monitor' | 'clip' | 'publish'
const queueMap = {
  monitor: monitorQueue,
  clip: clipQueue,
  publish: publishQueue,
} as const

// GET /api/queues/status
queuesRouter.get('/status', async (_req: Request, res: Response) => {
  const [monitorCounts, clipCounts, publishCounts] = await Promise.all([
    monitorQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    clipQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    publishQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
  ])

  res.json({
    monitor: monitorCounts,
    clip:    clipCounts,
    publish: publishCounts,
  })
})

// GET /api/queues/jobs/:queue  (BullMQ v5 — uses getJobs(), not getWaiting/getActive/getFailed)
queuesRouter.get('/jobs/:queue', async (req: Request, res: Response) => {
  const name = req.params.queue as QueueName
  const q = queueMap[name]
  if (!q) return res.status(404).json({ error: 'Queue not found. Use: monitor, clip, publish' })

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)

  const [waiting, active, failed] = await Promise.all([
    q.getJobs(['waiting'], 0, limit),
    q.getJobs(['active'],  0, limit),
    q.getJobs(['failed'],  0, limit),
  ])

  res.json({
    waiting: waiting.map(j => ({ id: j.id, name: j.name, data: j.data, addedAt: j.timestamp })),
    active:  active.map(j  => ({ id: j.id, name: j.name, data: j.data, progress: j.progress })),
    failed:  failed.map(j  => ({ id: j.id, name: j.name, failedReason: j.failedReason, attemptsMade: j.attemptsMade })),
  })
})

// POST /api/queues/retry/:queue/:jobId
queuesRouter.post('/retry/:queue/:jobId', async (req: Request, res: Response) => {
  const name = req.params.queue as QueueName
  const q = queueMap[name]
  if (!q) return res.status(404).json({ error: 'Queue not found' })

  const job = await q.getJob(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })

  const state = await job.getState()
  if (state !== 'failed') return res.status(400).json({ error: `Job is in state "${state}", not "failed"` })

  await job.retry()
  res.json({ success: true, jobId: job.id })
})
