// src/services/clipService.ts
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { logger } from './logger'

const execFileAsync = promisify(execFile)

if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH)
}

const CLIPS_DIR = path.join(process.cwd(), 'tmp', 'clips')
const DOWNLOADS_DIR = path.join(process.cwd(), 'tmp', 'downloads')
fs.mkdirSync(CLIPS_DIR, { recursive: true })
fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })

// ── Download video using yt-dlp (safe — args passed as array, no shell) ──
export async function downloadVideo(videoUrl: string): Promise<string> {
  const outputPath = path.join(DOWNLOADS_DIR, `${Date.now()}.mp4`)

  logger.debug('Downloading video', { videoUrl })

  const ytDlpBin = process.env.YTDLP_PATH ?? 'yt-dlp'
  await execFileAsync(ytDlpBin, [
    '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '--max-filesize', '2G',
    '-o', outputPath,
    videoUrl,
  ])

  if (!fs.existsSync(outputPath)) {
    throw new Error(`yt-dlp did not produce output file at ${outputPath}`)
  }

  logger.debug('Video downloaded', { outputPath })
  return outputPath
}

// ── Generate 9:16 vertical clip with FFmpeg ─────────────────
export async function generateClip(options: {
  inputPath: string
  startTime: number
  duration: number
  outputName?: string
}): Promise<string> {
  const { inputPath, startTime, duration, outputName } = options
  const name = outputName ?? `clip_${Date.now()}.mp4`
  const outputPath = path.join(CLIPS_DIR, name)

  logger.debug('Generating clip', { startTime, duration, outputPath })

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .videoFilters([
        'scale=-2:1920',
        'crop=1080:1920:(iw-1080)/2:0',
        'fps=30',
      ])
      .audioFilters(['aresample=48000', 'loudnorm'])
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset fast',
        '-crf 23',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
      ])
      .output(outputPath)
      .on('start', (cmd) => logger.debug('FFmpeg started', { cmd }))
      .on('progress', (p) => logger.debug('FFmpeg progress', { percent: p.percent?.toFixed(1) }))
      .on('end', () => { logger.debug('Clip generated', { outputPath }); resolve() })
      .on('error', (err) => { logger.error('FFmpeg error', { err: err.message }); reject(err) })
      .run()
  })

  return outputPath
}

// ── Get video duration in seconds ───────────────────────────
export function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) return reject(err)
      resolve(meta.format.duration ?? 0)
    })
  })
}

// ── Clean up a temp file silently ───────────────────────────
export function cleanupFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    logger.warn('Could not delete temp file', { filePath })
  }
}
