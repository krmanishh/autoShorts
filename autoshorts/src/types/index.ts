// src/types/index.ts
export interface JobData {
  automationId: string
  userId: string
}

export interface MonitorJobData extends JobData {}

export interface ClipJobData extends JobData {
  sourceVideoId: string
  videoUrl: string
  duration: number       // clip duration in seconds
  sourceTitle: string
  sourceDescription: string
}

export interface PublishJobData extends JobData {
  clipId: string
  outputUrl: string
  title: string
  caption: string
  hashtags: string[]
  platforms: Array<{ platform: 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK'; privacy: 'PUBLIC' | 'UNLISTED' | 'PRIVATE' }>
}

export interface YouTubeVideoItem {
  id: string
  snippet: {
    title: string
    description: string
    thumbnails: { high?: { url: string } }
    publishedAt: string
  }
  contentDetails?: {
    duration: string   // ISO 8601 e.g. "PT10M30S"
  }
}

export interface AISegmentResult {
  startTime: number    // seconds into video
  endTime: number
  score: number        // 0-1 engagement score
  reason: string
  title: string
  caption: string
  hashtags: string[]
}

export interface EncryptedData {
  iv: string
  tag: string
  data: string
}
