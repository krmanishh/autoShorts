// src/services/youtube.ts
import { google, youtube_v3 } from 'googleapis'
import { decrypt, encrypt } from './encryption'
import { prisma } from '../db/client'
import { logger } from './logger'
import type { YouTubeVideoItem } from '../types'
import fs from 'fs'

const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
]

// ── OAuth2 client factory ──────────────────────────────────
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  )
}

// Note: the OAuth authorization URL is built in api/routes/auth.ts using
// YOUTUBE_SCOPES below and a server-side state nonce (see services/oauthState.ts).

export { YOUTUBE_SCOPES }

// ── Build authenticated client from stored token ───────────
async function getAuthenticatedClient(userId: string) {
  const token = await prisma.oAuthToken.findUnique({
    where: { userId_platform: { userId, platform: 'YOUTUBE' } },
  })
  if (!token) throw new Error('YouTube account not connected')

  const client = createOAuth2Client()
  client.setCredentials({
    access_token: decrypt(token.accessToken),
    refresh_token: token.refreshToken ? decrypt(token.refreshToken) : undefined,
    expiry_date: token.expiresAt?.getTime(),
  })

  // Auto-refresh and persist new token
  client.on('tokens', async (newTokens) => {
    const updates: Record<string, unknown> = {}
    if (newTokens.access_token) {
      updates.accessToken = encrypt(newTokens.access_token)
    }
    if (newTokens.expiry_date) updates.expiresAt = new Date(newTokens.expiry_date)
    if (Object.keys(updates).length) {
      await prisma.oAuthToken.update({
        where: { userId_platform: { userId, platform: 'YOUTUBE' } },
        data: updates,
      })
    }
  })

  return client
}

// ── Get latest videos from a channel ──────────────────────
// Uses the OAuth2 client (no separate API key env var required).
export async function getLatestChannelVideos(
  channelUrl: string,
  maxResults = 10
): Promise<YouTubeVideoItem[]> {
  const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY ?? createOAuth2Client(),
  })

  // Resolve channel ID from URL
  const channelId = await resolveChannelId(youtube, channelUrl)
  if (!channelId) {
    logger.warn('Could not resolve YouTube channel ID', { channelUrl })
    return []
  }

  // Get upload playlist
  const channelRes = await youtube.channels.list({
    part: ['contentDetails'],
    id: [channelId],
  })
  const uploadsPlaylistId =
    channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsPlaylistId) return []

  // Fetch recent uploads
  const playlistRes = await youtube.playlistItems.list({
    part: ['snippet', 'contentDetails'],
    playlistId: uploadsPlaylistId,
    maxResults,
  })

  const videoIds = (playlistRes.data.items ?? [])
    .map((i) => i.contentDetails?.videoId)
    .filter(Boolean) as string[]

  if (!videoIds.length) return []

  // Get full video details
  const videosRes = await youtube.videos.list({
    part: ['snippet', 'contentDetails'],
    id: videoIds,
  })

  return (videosRes.data.items ?? []) as YouTubeVideoItem[]
}

async function resolveChannelId(
  youtube: youtube_v3.Youtube,
  url: string
): Promise<string | null> {
  // Handle @handle format
  const handleMatch = url.match(/@([\w.-]+)/)
  if (handleMatch) {
    const res = await youtube.channels.list({
      part: ['id'],
      forHandle: handleMatch[1],
    })
    return res.data.items?.[0]?.id ?? null
  }

  // Handle /channel/ID format
  const channelIdMatch = url.match(/\/channel\/([\w-]+)/)
  if (channelIdMatch) return channelIdMatch[1]

  // Handle /c/name or /user/name
  const nameMatch = url.match(/\/(?:c|user)\/([\w-]+)/)
  if (nameMatch) {
    const res = await youtube.channels.list({
      part: ['id'],
      forUsername: nameMatch[1],
    })
    return res.data.items?.[0]?.id ?? null
  }

  return null
}

// ── Get direct download URL for a video ───────────────────
// In production use yt-dlp. Here we return the watch URL and
// delegate actual download to the clip service.
export function getVideoWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

// ── Upload a short to YouTube ──────────────────────────────
export async function uploadYouTubeShort(
  userId: string,
  filePath: string,
  title: string,
  description: string,
  tags: string[],
  privacy: 'public' | 'unlisted' | 'private' = 'public'
): Promise<{ videoId: string; url: string }> {
  const auth = await getAuthenticatedClient(userId)
  const youtube = google.youtube({ version: 'v3', auth })

  // Ensure title has #Shorts so YouTube marks it as a Short
  const shortTitle = title.includes('#Shorts') ? title : `${title} #Shorts`

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: shortTitle.slice(0, 100),
        description,
        tags,
        categoryId: '22', // People & Blogs – good default for shorts
      },
      status: {
        privacyStatus: privacy,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      mimeType: 'video/mp4',
      body: fs.createReadStream(filePath),
    },
  })

  const videoId = res.data.id!
  return {
    videoId,
    url: `https://youtube.com/shorts/${videoId}`,
  }
}
