// src/services/instagram.ts
import axios from 'axios'
import { decrypt } from './encryption'
import { prisma } from '../db/client'
import { logger } from './logger'

// "Instagram API with Instagram Login" uses its own hosts, separate from
// the regular Facebook Graph API. The IG account authenticates directly —
// no Facebook Page lookup needed.
const IG_GRAPH_BASE = 'https://graph.instagram.com/v21.0'

// Note: the OAuth authorization URL is built in api/routes/auth.ts using a
// server-side state nonce (see services/oauthState.ts). There is intentionally
// no URL-builder here to avoid a second, less-secure code path existing.

// ── Exchange code for tokens ───────────────────────────────
export async function exchangeInstagramCode(code: string) {
  // Step 1: exchange the authorization code for a short-lived token.
  // This endpoint expects form-encoded POST data, not query params.
  const shortLivedRes = await axios.post(
    'https://api.instagram.com/oauth/access_token',
    new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
      code,
    })
  )
  const { access_token: shortLivedToken, user_id: igAccountId } = shortLivedRes.data

  // Step 2: exchange the short-lived token (~1hr) for a long-lived one (~60 days)
  const longLivedRes = await axios.get('https://graph.instagram.com/access_token', {
    params: {
      grant_type: 'ig_exchange_token',
      client_secret: process.env.INSTAGRAM_APP_SECRET,
      access_token: shortLivedToken,
    },
  })

  const accessToken: string = longLivedRes.data.access_token
  const expiresIn: number = longLivedRes.data.expires_in // seconds

  // Step 3: fetch the username for display purposes
  const meRes = await axios.get(`${IG_GRAPH_BASE}/${igAccountId}`, {
    params: { fields: 'username', access_token: accessToken },
  })

  return {
    accessToken,
    igAccountId: String(igAccountId),
    username: meRes.data.username ?? '',
    expiresIn,
  }
}

// ── Upload a Reel to Instagram ─────────────────────────────
// Instagram requires a publicly accessible video URL.
// In production the clip is uploaded to S3 first.
//
// Note: Instagram's Graph API has no privacy/draft tier for Reels — a Reel
// is always public the moment media_publish succeeds. The automation's
// configured `privacy` setting (PUBLIC/UNLISTED/PRIVATE) is intentionally
// not passed here because there's nothing on Instagram's side for it to do.
export async function uploadInstagramReel(
  userId: string,
  publicVideoUrl: string,
  caption: string
): Promise<{ mediaId: string; url: string }> {
  const token = await prisma.oAuthToken.findUnique({
    where: { userId_platform: { userId, platform: 'INSTAGRAM' } },
  })
  if (!token) throw new Error('Instagram account not connected')

  const accessToken = decrypt(token.accessToken)
  const igAccountId = token.platformUserId!

  // Step 1: Create media container
  logger.debug('Instagram: creating media container')
  const containerRes = await axios.post(
    `${IG_GRAPH_BASE}/${igAccountId}/media`,
    null,
    {
      params: {
        media_type: 'REELS',
        video_url: publicVideoUrl,
        caption: caption.slice(0, 2200),
        share_to_feed: true,
        access_token: accessToken,
      },
    }
  )
  const containerId: string = containerRes.data.id

  // Step 2: Poll until container is FINISHED (video processing)
  await pollContainerStatus(igAccountId, containerId, accessToken)

  // Step 3: Publish
  logger.debug('Instagram: publishing reel', { containerId })
  const publishRes = await axios.post(
    `${IG_GRAPH_BASE}/${igAccountId}/media_publish`,
    null,
    {
      params: {
        creation_id: containerId,
        access_token: accessToken,
      },
    }
  )

  const mediaId: string = publishRes.data.id
  return {
    mediaId,
    url: `https://www.instagram.com/reel/${mediaId}/`,
  }
}

async function pollContainerStatus(
  igAccountId: string,
  containerId: string,
  accessToken: string,
  maxWaitMs = 300_000 // 5 min
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const res = await axios.get(`${IG_GRAPH_BASE}/${containerId}`, {
      params: { fields: 'status_code,status', access_token: accessToken },
    })
    const { status_code } = res.data
    if (status_code === 'FINISHED') return
    if (status_code === 'ERROR') throw new Error('Instagram media processing failed')
    await sleep(5_000)
  }
  throw new Error('Instagram container processing timed out')
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}