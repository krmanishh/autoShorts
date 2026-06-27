// src/workers/monitorWorker.ts
import 'dotenv/config'
import { Worker } from 'bullmq'
import { redisConnection, clipQueue, QUEUE_MONITOR } from '../queue/queues'
import { prisma } from '../db/client'
import { getLatestChannelVideos } from '../services/youtube'
import { logger, dbLog } from '../services/logger'
import type { MonitorJobData, YouTubeVideoItem } from '../types'
import { parseISO8601Duration } from '../utils/duration'

const worker = new Worker<MonitorJobData>(
  QUEUE_MONITOR,
  async (job) => {
    const { automationId } = job.data
    logger.info(`[monitor] Running check for automation ${automationId}`)

    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
      include: { publishTargets: true },
    })

    if (!automation || automation.status !== 'RUNNING') {
      logger.info(`[monitor] Automation ${automationId} is not running — skipping`)
      return
    }

    // Fetch latest videos from source
    let videos: YouTubeVideoItem[] = []
    try {
      if (automation.sourceType === 'YOUTUBE') {
        videos = await getLatestChannelVideos(automation.sourceUrl, 5)
      }
      // Vimeo / RSS handlers would go here
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      await dbLog('ERROR', 'detect', `Failed to fetch channel: ${msg}`, automationId)
      throw err
    }

    await dbLog('INFO', 'detect', `Fetched ${videos.length} recent videos`, automationId)

    let newCount = 0

    for (const video of videos) {
      const externalId = video.id
      const title = video.snippet.title
      // publishedAt is an ISO date string like "2024-01-15T10:30:00Z" — parse directly
      const uploadedAt = video.snippet.publishedAt
        ? new Date(video.snippet.publishedAt)
        : new Date()

      // Check if already processed or queued
      const existing = await prisma.sourceVideo.findUnique({
        where: { automationId_externalId: { automationId, externalId } },
      })

      if (existing) {
        // Skip if done, queued, or failed too many times
        if (
          existing.processingStatus === 'DONE' ||
          existing.processingStatus === 'QUEUED' ||
          existing.processingStatus === 'PROCESSING' ||
          (existing.processingStatus === 'FAILED' && existing.failureCount >= 3)
        ) {
          continue
        }
      }

      // Parse duration
      const durationRaw = video.contentDetails?.duration ?? 'PT0S'
      const sourceDurationSeconds = parseISO8601Duration(durationRaw)

      // Skip very short videos (probably already a short)
      if (sourceDurationSeconds > 0 && sourceDurationSeconds < automation.clipDuration + 5) {
        logger.debug('[monitor] Skipping short video', { title, sourceDurationSeconds })
        continue
      }

      // Upsert source video record as pending first so enqueue failures
      // do not leave the video stuck in QUEUED indefinitely.
      const sourceVideo = await prisma.sourceVideo.upsert({
        where: { automationId_externalId: { automationId, externalId } },
        create: {
          automationId,
          externalId,
          title,
          description: video.snippet.description,
          thumbnailUrl: video.snippet.thumbnails?.high?.url,
          videoUrl: `https://www.youtube.com/watch?v=${externalId}`,
          duration: sourceDurationSeconds || null,
          uploadedAt,
          processingStatus: 'PENDING',
        },
        update: {
          processingStatus: 'PENDING',
        },
      })

      const jobName = `clip-${automationId}-${externalId}`
      const jobId = jobName

      // Enqueue clip generation job
      await clipQueue.add(
        jobName,
        {
          automationId,
          userId: automation.userId,
          sourceVideoId: sourceVideo.id,
          videoUrl: sourceVideo.videoUrl!,
          duration: automation.clipDuration,
          sourceTitle: title,
          sourceDescription: video.snippet.description ?? '',
        },
        {
          jobId, // deduplicate
        }
      )

      await prisma.sourceVideo.update({
        where: { id: sourceVideo.id },
        data: { processingStatus: 'QUEUED' },
      })

      await dbLog(
        'INFO',
        'detect',
        `New video queued: "${title}"`,
        automationId,
        { externalId, videoId: sourceVideo.id, jobId }
      )
      newCount++
    }

    // Update last checked timestamp
    await prisma.automation.update({
      where: { id: automationId },
      data: { lastCheckedAt: new Date() },
    })

    logger.info(`[monitor] Done — ${newCount} new videos queued for automation ${automationId}`)
  },
  {
    connection: redisConnection as any,
    concurrency: 5,
  }
)

worker.on('failed', async (job, err) => {
  logger.error('[monitor] Job failed', { jobId: job?.id, err: err.message })
  if (job?.data.automationId) {
    await dbLog('ERROR', 'detect', `Monitor check failed: ${err.message}`, job.data.automationId)
  }
})

worker.on('completed', (job) => {
  logger.debug('[monitor] Job completed', { jobId: job.id })
})

// Graceful shutdown
async function shutdown() {
  logger.info('[monitor] Shutting down worker...')
  await worker.close()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

logger.info('[monitor] Worker started')
export default worker
