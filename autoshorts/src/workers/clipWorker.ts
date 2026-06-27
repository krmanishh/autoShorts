// src/workers/clipWorker.ts

import 'dotenv/config'

import { Worker } from 'bullmq'

import { redisConnection, publishQueue, QUEUE_CLIP } from '../queue/queues'

import { prisma } from '../db/client'

import { selectBestSegment } from '../services/aiSegment'

import { downloadVideo, generateClip, getVideoDuration, cleanupFile } from '../services/clipService'

import { uploadClipToStorage } from '../services/storage'

import { logger, dbLog } from '../services/logger'

import type { ClipJobData } from '../types'

import { Prisma } from '@prisma/client'

import fs from 'fs'


// ── Helpers ────────────────────────────────────────────────

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function enqueuePublish(params: {
  automationId: string
  userId: string
  sourceVideoId: string
  clipId: string
  outputUrl: string
  title: string
  caption: string
  hashtags: string[]
}) {
  const { automationId, userId, sourceVideoId, clipId, outputUrl, title, caption, hashtags } = params

  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    include: { publishTargets: { where: { enabled: true } } },
  })

  if (!automation || !automation.publishTargets.length) {
    logger.warn('[clip] No enabled publish targets — clip created but not published', {
      automationId,
      publishTargets: automation?.publishTargets?.length ?? 0,
    })
    return false
  }

  const jobName = `publish-${sourceVideoId}`
  const jobId = jobName

  logger.info('[clip] Enqueueing publish job', {
    automationId,
    sourceVideoId,
    clipId,
    jobName,
    jobId,
    targetCount: automation.publishTargets.length,
  })

  try {
    await publishQueue.add(
      jobName,
      {
        automationId,
        userId,
        clipId,
        outputUrl,
        title,
        caption,
        hashtags,
        platforms: automation.publishTargets.map((t) => ({
          platform: t.platform,
          privacy: t.privacy.toUpperCase() as 'PUBLIC' | 'UNLISTED' | 'PRIVATE',
        })),
      },
      { jobId }
    )
  } catch (err: unknown) {
    const msg = toMessage(err)
    logger.error('[clip] Failed to enqueue publish job', {
      automationId,
      sourceVideoId,
      clipId,
      jobName,
      jobId,
      err: msg,
    })
    throw err
  }

  logger.info('[clip] Publish job enqueued', {
    automationId,
    sourceVideoId,
    clipId,
    jobName,
    jobId,
  })

  return true
}


// ── Worker ─────────────────────────────────────────────────

const worker = new Worker<ClipJobData>(
  QUEUE_CLIP,
  async (job) => {
    const { automationId, userId, sourceVideoId, videoUrl, duration, sourceTitle, sourceDescription } =
      job.data

    logger.info(`[clip] Processing video "${sourceTitle}"`, { sourceVideoId })

    // ── Idempotency check ──────────────────────────────────
    // A previous attempt may have already completed clip creation/upload
    // and then failed later (e.g. enqueueing the publish job). Don't redo
    // the whole pipeline in that case — resume from here instead, since
    // GeneratedClip.sourceVideoId is unique and re-creating it would crash.
    let clip = await prisma.generatedClip.findUnique({ where: { sourceVideoId } })

    if (clip) {
      logger.info('[clip] Existing clip found for this video — resuming from publish step', {
        sourceVideoId,
        clipId: clip.id,
      })
      await dbLog(
        'INFO',
        'clip',
        `Clip already generated for "${sourceTitle}" — resuming publish step`,
        automationId,
        { clipId: clip.id }
      )

      await prisma.sourceVideo.update({
        where: { id: sourceVideoId },
        data: { processingStatus: 'DONE', processedAt: new Date() },
      })

      await job.updateProgress(100)

      await enqueuePublish({
        automationId,
        userId,
        sourceVideoId,
        clipId: clip.id,
        outputUrl: clip.outputUrl!,
        title: clip.title ?? sourceTitle,
        caption: clip.caption ?? '',
        hashtags: clip.hashtags,
      })

      return
    }

    // Mark as processing
    await prisma.sourceVideo.update({
      where: { id: sourceVideoId },
      data: { processingStatus: 'PROCESSING' },
    })
    await dbLog('INFO', 'clip', `Analyzing: "${sourceTitle}"`, automationId, { sourceVideoId })

    let downloadedPath: string | null = null
    let clipPath: string | null = null

    try {
      // ── Step 1: Download source video ─────────────────
      await job.updateProgress(10)
      await dbLog('INFO', 'clip', 'Downloading source video...', automationId)
      downloadedPath = await downloadVideo(videoUrl)

      const sourceDuration = await getVideoDuration(downloadedPath)
      await job.updateProgress(30)

      // ── Step 2: AI segment selection ──────────────────
      await dbLog('INFO', 'clip', 'AI analyzing for best segment...', automationId)
      const segment = await selectBestSegment(
        sourceTitle,
        sourceDescription,
        Math.floor(sourceDuration),
        duration
      )
      await job.updateProgress(50)
      await dbLog(
        'INFO',
        'clip',
        `Best segment: ${segment.startTime}s–${segment.endTime}s (score: ${segment.score.toFixed(2)}) — "${segment.title}"`,
        automationId,
        { reason: segment.reason }
      )

      // ── Step 3: Generate vertical clip ────────────────
      await dbLog('INFO', 'clip', 'Encoding 9:16 clip with FFmpeg...', automationId)
      clipPath = await generateClip({
        inputPath: downloadedPath,
        startTime: segment.startTime,
        duration,
        outputName: `${sourceVideoId}.mp4`,
      })
      await job.updateProgress(75)

      const fileStat = fs.statSync(clipPath)

      // ── Step 4: Upload to storage ─────────────────────
      await dbLog('INFO', 'clip', 'Uploading clip to storage...', automationId)
      const outputUrl = await uploadClipToStorage(clipPath, sourceVideoId)
      await job.updateProgress(90)

      // Clean up downloaded source now that upload is done
      // (keep encoded clip path reference until after DB write, then clean up)
      cleanupFile(downloadedPath)
      downloadedPath = null

      // ── Step 5: Persist GeneratedClip record ──────────
      // Use create and recover from duplicate-key races instead of upsert
      // because multi-worker retries can still hit sourceVideoId conflicts.
      try {
        clip = await prisma.generatedClip.create({
          data: {
            sourceVideoId,
            duration,
            startTime: segment.startTime,
            endTime: segment.endTime,
            outputPath: clipPath,
            outputUrl,
            fileSize: fileStat.size,
            aiScore: segment.score,
            aiSegmentReason: segment.reason,
            title: segment.title,
            caption: segment.caption,
            hashtags: segment.hashtags,
          },
        })
      } catch (err: unknown) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          Array.isArray(err.meta?.target) &&
          (err.meta.target as string[]).includes('sourceVideoId')
        ) {
          logger.warn('[clip] GeneratedClip already exists for this sourceVideoId, loading existing record', {
            sourceVideoId,
          })
          clip = await prisma.generatedClip.findUnique({ where: { sourceVideoId } })
          if (!clip) throw err
        } else {
          throw err
        }
      }

      await prisma.sourceVideo.update({
        where: { id: sourceVideoId },
        data: { processingStatus: 'DONE', processedAt: new Date() },
      })

      await dbLog(
        'INFO',
        'clip',
        `Clip generated: "${segment.title}"`,
        automationId,
        { clipId: clip.id, outputUrl }
      )

      // ── Step 6: Fetch publish targets & enqueue ────────
      await enqueuePublish({
        automationId,
        userId,
        sourceVideoId,
        clipId: clip.id,
        outputUrl,
        title: segment.title,
        caption: segment.caption,
        hashtags: segment.hashtags,
      })

      await job.updateProgress(100)
      logger.info(`[clip] Done — clip queued for publishing`, { clipId: clip.id })
    } catch (err: unknown) {
      const msg = toMessage(err)
      logger.error('[clip] Failed', { sourceVideoId, err: msg })

      // Clean up any local files that may still be on disk
      if (downloadedPath) cleanupFile(downloadedPath)
      if (clipPath) cleanupFile(clipPath)

      // Use atomic increment to avoid the read-then-write race condition
      // where two concurrent retries both read the same failureCount.
      await prisma.sourceVideo.update({
        where: { id: sourceVideoId },
        data: {
          failureCount: { increment: 1 },
          failureReason: msg,
        },
      })

      // Read back the updated count to decide the next status
      const current = await prisma.sourceVideo.findUnique({
        where: { id: sourceVideoId },
        select: { failureCount: true },
      })
      const newCount = current?.failureCount ?? 1

      await prisma.sourceVideo.update({
        where: { id: sourceVideoId },
        data: {
          processingStatus: newCount >= 3 ? 'FAILED' : 'PENDING',
        },
      })

      await dbLog('ERROR', 'clip', `Clip failed (attempt ${newCount}/3): ${msg}`, automationId)
      throw err // BullMQ retries automatically
    }
  },
  {
    connection: redisConnection as any,
    concurrency: 2, // FFmpeg is CPU-intensive; tune down to 1 if disk I/O saturates
  }
)

worker.on('failed', (job, err) => {
  logger.error('[clip] Job permanently failed', { jobId: job?.id, err: err.message })
})

// Graceful shutdown - wait for active FFmpeg jobs to finish
async function shutdown() {
  logger.info('[clip] Shutting down worker gracefully...')
  await worker.close()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

logger.info('[clip] Worker started')
export default worker