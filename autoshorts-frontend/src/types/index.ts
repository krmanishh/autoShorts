// src/types/index.ts

export type AutomationStatus = 'RUNNING' | 'PAUSED' | 'ERROR'
export type SourceType = 'YOUTUBE' | 'VIMEO' | 'RSS' | 'WEBSITE' | 'CUSTOM'
export type Platform = 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK'
export type Privacy = 'PUBLIC' | 'UNLISTED' | 'PRIVATE'
export type ProcessingStatus = 'PENDING' | 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED' | 'SKIPPED'
export type PublicationStatus = 'PENDING' | 'UPLOADING' | 'PUBLISHED' | 'FAILED'
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

export interface User {
  id: string
  email: string
  name: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface OAuthConnection {
  platform: Platform
  platformUsername: string | null
  expiresAt: string | null
  updatedAt: string
}

export interface PublishTarget {
  id: string
  automationId: string
  platform: Platform
  enabled: boolean
  privacy: Privacy
}

export interface AutomationStats {
  videosFound: number
  clipsGenerated: number
  published: number
  failed: number
}

export interface Automation {
  id: string
  name: string
  status: AutomationStatus
  sourceType: SourceType
  sourceUrl: string
  channelName: string | null
  clipDuration: number
  pollingInterval: number
  lastCheckedAt: string | null
  createdAt: string
  publishTargets: PublishTarget[]
  stats: AutomationStats
}

export interface CreateAutomationPayload {
  name: string
  sourceType: SourceType
  sourceUrl: string
  channelName?: string
  clipDuration: number
  pollingInterval: number
  publishTargets: Array<{ platform: Platform; privacy: Privacy }>
}

export interface SourceVideo {
  id: string
  title: string
  externalId: string
  processingStatus: ProcessingStatus
  uploadedAt: string
}

export interface Publication {
  platform: Platform
  status: PublicationStatus
  platformUrl: string | null
}

export interface GeneratedClip {
  id: string
  duration: number
  startTime: number
  endTime: number
  outputUrl: string | null
  aiScore: number | null
  aiSegmentReason: string | null
  title: string | null
  caption: string | null
  hashtags: string[]
  createdAt: string
  sourceVideo: {
    title: string
    externalId: string
    automation: { name: string }
  }
  publications: Publication[]
}

export interface PublicationFull {
  id: string
  platform: Platform
  status: PublicationStatus
  platformUrl: string | null
  publishedAt: string | null
  createdAt: string
  clip: {
    title: string | null
    duration: number
    sourceVideo: { title: string }
  }
}

export interface DashboardStats {
  videosProcessed: number
  clipsGenerated: number
  published: number
  failed: number
}

export interface WeeklyPoint {
  date: string
  count: number
}

export interface QueueJobCounts {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

export interface QueueStatus {
  monitor: QueueJobCounts
  clip: QueueJobCounts
  publish: QueueJobCounts
}

export interface HealthStatus {
  status: 'ok' | 'degraded'
  timestamp: string
  checks: { database: 'ok' | 'error'; redis: 'ok' | 'error' }
  queues: QueueStatus
  uptime: number
  version: string
}

export interface SystemLog {
  id: string
  automationId: string | null
  level: LogLevel
  category: string
  message: string
  metadata: Record<string, unknown> | null
  createdAt: string
}
