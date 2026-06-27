// src/services/instagram.ts
import axios from 'axios'
import { decrypt } from './encryption'
import { prisma } from '../db/client'
import { logger } from './logger'

const FB_BASE = 'https://graph.facebook.com/v20.0'

// Note: the OAuth authorization URL is built in api/routes/auth.ts using a
// server-side state nonce (see services/oauthState.ts). There is intentionally
// no URL-builder here to avoid a second, less-secure code path existing.

// ── Exchange code for tokens ───────────────────────────────
export async function exchangeInstagramCode(code: string) {
  const res = await axios.get(`${FB_BASE}/oauth/access_token`, {
    params: {
      client_id: process.env.INSTAGRAM_APP_ID,
      client_secret: process.env.INSTAGRAM_APP_SECRET,
      redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
      code,
    },
  })

  // Get long-lived token
  const llRes = await axios.get(`${FB_BASE}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.INSTAGRAM_APP_ID,
      client_secret: process.env.INSTAGRAM_APP_SECRET,
      fb_exchange_token: res.data.access_token,
    },
  })

  // Get Instagram Business Account ID
  const meRes = await axios.get(`${FB_BASE}/me/accounts`, {
    params: { access_token: llRes.data.access_token },
  })
  const page = meRes.data.data?.[0]
  if (!page) throw new Error('No Facebook Page found for this account')

  const igRes = await axios.get(`${FB_BASE}/${page.id}`, {
    params: {
      fields: 'instagram_business_account',
      access_token: page.access_token,
    },
  })
  const igAccountId = igRes.data.instagram_business_account?.id
  if (!igAccountId) throw new Error('No Instagram Business Account linked to this Page')

  const igMeRes = await axios.get(`${FB_BASE}/${igAccountId}`, {
    params: { fields: 'username', access_token: page.access_token },
  })

  return {
    accessToken: page.access_token,
    igAccountId,
    username: igMeRes.data.username ?? '',
    expiresIn: llRes.data.expires_in,
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
    `${FB_BASE}/${igAccountId}/media`,
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
    `${FB_BASE}/${igAccountId}/media_publish`,
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
    const res = await axios.get(`${FB_BASE}/${containerId}`, {
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
