// src/services/storage.ts
// Clip storage abstraction. Controlled by STORAGE_PROVIDER env var:
//   STORAGE_PROVIDER=cloudinary   -> upload to Cloudinary (no card verification needed, good for now)
//   STORAGE_PROVIDER=s3           -> upload to S3 (switch to this later)
//   (unset / anything else)       -> local filesystem fallback, returns file:// path (dev mode)
import { logger } from './logger'
import fs from 'fs'
import path from 'path'

type StorageProvider = 's3' | 'cloudinary' | 'local'

function getProvider(): StorageProvider {
  const configured = (process.env.STORAGE_PROVIDER ?? '').toLowerCase()
  if (configured === 's3') return 's3'
  if (configured === 'cloudinary') return 'cloudinary'
  return 'local'
}

export async function uploadClipToStorage(
  localPath: string,
  clipId: string
): Promise<string> {
  const provider = getProvider()

  if (provider === 's3') {
    if (!isS3Configured()) {
      logger.warn(
        '[storage] STORAGE_PROVIDER=s3 but AWS env vars are missing — clip stays local',
        { localPath }
      )
      return `file://${localPath}`
    }
    return uploadToS3(localPath, clipId)
  }

  if (provider === 'cloudinary') {
    if (!isCloudinaryConfigured()) {
      logger.warn(
        '[storage] STORAGE_PROVIDER=cloudinary but Cloudinary env vars are missing — clip stays local',
        { localPath }
      )
      return `file://${localPath}`
    }
    return uploadToCloudinary(localPath, clipId)
  }

  logger.warn('[storage] No STORAGE_PROVIDER set — clip stays local', { localPath })
  return `file://${localPath}`
}

// ── S3 ───────────────────────────────────────────────────────
function isS3Configured() {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET
  )
}

async function uploadToS3(localPath: string, clipId: string): Promise<string> {
  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')

    const s3 = new S3Client({
      region: process.env.AWS_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })

    const key = `clips/${clipId}/${path.basename(localPath)}`
    const fileStream = fs.createReadStream(localPath)

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: fileStream,
        ContentType: 'video/mp4',
        ACL: 'public-read',
      })
    )

    const url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION ?? 'us-east-1'}.amazonaws.com/${key}`
    logger.debug('[storage] Clip uploaded to S3', { url })
    return url
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`S3 upload failed: ${msg}`)
  }
}

// ── Cloudinary ───────────────────────────────────────────────
function isCloudinaryConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  )
}

async function uploadToCloudinary(localPath: string, clipId: string): Promise<string> {
  try {
    const { v2: cloudinary } = await import('cloudinary')

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      api_key: process.env.CLOUDINARY_API_KEY!,
      api_secret: process.env.CLOUDINARY_API_SECRET!,
    })

    // Upload via a stream rather than passing the raw local path string.
    // On Windows, paths like "C:\Users\..." can be misread by the SDK's
    // source-type detection as a URI scheme ("C:"), which triggers spurious
    // "Custom Id cannot contain :" validation errors. Streaming the file
    // avoids that ambiguity entirely.
    const safePublicId = path
      .basename(localPath, path.extname(localPath))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^_+|_+$/g, '')

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: `clips/${clipId}`,
          public_id: safePublicId || `clip-${Date.now()}`,
          overwrite: true,
        },
        (error, uploadResult) => {
          if (error) return reject(error)
          if (!uploadResult) return reject(new Error('Cloudinary returned no result'))
          resolve(uploadResult as { secure_url: string })
        }
      )
      fs.createReadStream(localPath).pipe(uploadStream)
    })

    logger.debug('[storage] Clip uploaded to Cloudinary', { url: result.secure_url })
    return result.secure_url
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Cloudinary upload failed: ${msg}`)
  }
}