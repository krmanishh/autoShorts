// src/queue/queues.ts
import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import type { MonitorJobData, ClipJobData, PublishJobData } from '../types'

// ── Shared Redis connection ─────────────────────────────────
// BullMQ requires either a real ioredis instance or a plain options object —
// passing { url: '...' } directly does NOT reliably parse the connection string
// in all bullmq/ioredis version combinations. Constructing IORedis explicitly
// from the URL is the documented, reliable approach.
export const redisConnection = new IORedis(
  process.env.REDIS_URL ?? 'redis://localhost:6379',
  {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: true,
  }
)

redisConnection.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[redis] Connection error:', err.message)
})

// ── Queue names ────────────────────────────────────────────
export const QUEUE_MONITOR = 'monitor'
export const QUEUE_CLIP    = 'clip'
export const QUEUE_PUBLISH = 'publish'

// ── Queues ─────────────────────────────────────────────────
export const monitorQueue = new Queue<MonitorJobData>(QUEUE_MONITOR, {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
})

export const clipQueue = new Queue<ClipJobData>(QUEUE_CLIP, {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
})

export const publishQueue = new Queue<PublishJobData>(QUEUE_PUBLISH, {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 }, // 30s between publish retries
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
})

export type { Worker }
