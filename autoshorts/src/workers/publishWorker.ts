// src/workers/publishWorker.ts
import 'dotenv/config'
import { Worker } from 'bullmq'
import { redisConnection, QUEUE_PUBLISH } from '../queue/queues'
import { prisma } from '../db/client'
import { uploadYouTubeShort } from '../services/youtube'
import { uploadInstagramReel } from '../services/instagram'
import { uploadFacebookReel } from '../services/facebook'
import { logger, dbLog } from '../services/logger'
import type { PublishJobData } from '../types'

const worker = new Worker<PublishJobData>(
  QUEUE_PUBLISH,
  async (job) => {
    const { automationId, userId, clipId, outputUrl, title, caption, hashtags, platforms } =
      job.data

    logger.info(`[publish] Publishing clip ${clipId} to ${platforms.length} platform(s)`)

    // Find or create publication records
    for (const target of platforms) {
      const { platform, privacy } = target

      let publication = await prisma.publication.findFirst({
        where: { clipId, platform },
      })
      if (!publication) {
        publication = await prisma.publication.create({
          data: { clipId, platform, status: 'UPLOADING' },
        })
      } else {
        publication = await prisma.publication.update({
          where: { id: publication.id },
          data: { status: 'UPLOADING' },
        })
      }

      try {
        await dbLog(
          'INFO',
          'publish',
          `Uploading to ${platform}...`,
          automationId,
          { clipId, platform }
        )

        let platformVideoId: string
        let platformUrl: string

        if (platform === 'YOUTUBE') {
          // For YouTube we need the local file path
          const clip = await prisma.generatedClip.findUnique({ where: { id: clipId } })
          if (!clip?.outputPath) throw new Error('Clip output path not found')

          const result = await uploadYouTubeShort(
            userId,
            clip.outputPath,
            title,
            buildYouTubeDescription(caption, hashtags),
            hashtags.map((h) => h.replace('#', '')),
            privacy
          )
          platformVideoId = result.videoId
          platformUrl = result.url
        } else if (platform === 'INSTAGRAM') {
          // Instagram needs a public URL
          if (outputUrl.startsWith('file://')) {
            throw new Error(
              'Instagram publishing requires a public video URL. Set STORAGE_PROVIDER=s3 or cloudinary.'
            )
          }
          const result = await uploadInstagramReel(
            userId,
            outputUrl,
            buildInstagramCaption(caption, hashtags)
          )
          platformVideoId = result.mediaId
          platformUrl = result.url
        } else if (platform === 'FACEBOOK') {
          // Facebook Reels also needs a public URL, same as Instagram
          if (outputUrl.startsWith('file://')) {
            throw new Error(
              'Facebook publishing requires a public video URL. Set STORAGE_PROVIDER=s3 or cloudinary.'
            )
          }
          const result = await uploadFacebookReel(
            userId,
            outputUrl,
            buildFacebookDescription(caption, hashtags),
            privacy
          )
          platformVideoId = result.videoId
          platformUrl = result.url
        } else {
          throw new Error(`Unsupported platform: ${platform}`)
        }

        // Update publication record as published
        await prisma.publication.update({
          where: { id: publication.id },
          data: {
            status: 'PUBLISHED',
            platformVideoId,
            platformUrl,
            publishedAt: new Date(),
          },
        })

        await dbLog(
          'INFO',
          'publish',
          `Published to ${platform}: ${platformUrl}`,
          automationId,
          { clipId, platform, platformVideoId, platformUrl }
        )

        logger.info(`[publish] ✓ ${platform} — ${platformUrl}`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error(`[publish] Failed on ${platform}`, { err: msg, clipId })

        const current = await prisma.publication.findUnique({ where: { id: publication.id } })
        const newCount = (current?.failureCount ?? 0) + 1

        await prisma.publication.update({
          where: { id: publication.id },
          data: {
            status: newCount >= 3 ? 'FAILED' : 'PENDING',
            failureCount: newCount,
            failureReason: msg,
          },
        })

        await dbLog(
          'ERROR',
          'publish',
          `${platform} upload failed (attempt ${newCount}/3): ${msg}`,
          automationId
        )

        // Only throw if ALL platforms failed — we still try the next one
        if (platforms.length === 1) throw err
      }
    }
  },
  {
    connection: redisConnection as any,
    concurrency: 3,
  }
)

// ── Helpers ────────────────────────────────────────────────
function buildYouTubeDescription(caption: string, hashtags: string[]): string {
  const hashStr = hashtags.join(' ')
  return `${caption}\n\n${hashStr}\n\n#Shorts`
}

function buildInstagramCaption(caption: string, hashtags: string[]): string {
  return `${caption}\n\n${hashtags.join(' ')}`
}

function buildFacebookDescription(caption: string, hashtags: string[]): string {
  return `${caption}\n\n${hashtags.join(' ')}`
}

worker.on('failed', (job, err) => {
  logger.error('[publish] Job permanently failed after all retries', {
    jobId: job?.id,
    err: err.message,
  })
})

// Graceful shutdown
async function shutdown() {
  logger.info('[publish] Shutting down worker...')
  await worker.close()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

logger.info('[publish] Worker started')
export default worker
