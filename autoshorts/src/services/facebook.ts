// src/services/facebook.ts
// Facebook Reels publishing via the Graph API.
// Reuses the same Meta OAuth app as Instagram — Facebook Login covers both
// products, so a single "Connect Facebook" flow grants access to the user's
// Facebook Page, which is what actually owns and publishes the Reel.
import axios from 'axios'
import { decrypt } from './encryption'
import { prisma } from '../db/client'
import { logger } from './logger'

const FB_BASE = 'https://graph.facebook.com/v20.0'

// ── Exchange OAuth code for a long-lived Page access token ──
export async function exchangeFacebookCode(code: string) {
  const res = await axios.get(`${FB_BASE}/oauth/access_token`, {
    params: {
      client_id: process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
      code,
    },
  })

  // Exchange short-lived user token for a long-lived one (~60 days)
  const llRes = await axios.get(`${FB_BASE}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      fb_exchange_token: res.data.access_token,
    },
  })

  // Get the Facebook Page(s) this user manages
  const pagesRes = await axios.get(`${FB_BASE}/me/accounts`, {
    params: { access_token: llRes.data.access_token },
  })
  const page = pagesRes.data.data?.[0]
  if (!page) {
    throw new Error(
      'No Facebook Page found. You must manage at least one Facebook Page to publish Reels.'
    )
  }

  // Page access tokens (obtained via /me/accounts) are already long-lived
  // when the parent user token is long-lived — no extra exchange needed.
  return {
    pageAccessToken: page.access_token,
    pageId: page.id as string,
    pageName: page.name as string,
    expiresIn: llRes.data.expires_in as number,
  }
}

// ── Upload a Reel to a Facebook Page ────────────────────────
// Flow: start upload session -> upload video file -> publish
//
// Privacy mapping note: the Graph API's video_state for Reels only supports
// PUBLISHED or DRAFT — there is no "unlisted" tier like YouTube has.
//   PUBLIC    -> PUBLISHED (visible to everyone, default)
//   UNLISTED  -> PUBLISHED (Facebook has no unlisted equivalent; closest
//                behavior is public, since a link-only/unlisted Reel isn't
//                a supported visibility state)
//   PRIVATE   -> DRAFT (saved to the Page but not publicly visible until
//                someone manually publishes it from the Page's content library)
export async function uploadFacebookReel(
  userId: string,
  publicVideoUrl: string,
  description: string,
  privacy: 'public' | 'unlisted' | 'private' = 'public'
): Promise<{ videoId: string; url: string }> {
  const token = await prisma.oAuthToken.findUnique({
    where: { userId_platform: { userId, platform: 'FACEBOOK' } },
  })
  if (!token) throw new Error('Facebook account not connected')

  const pageAccessToken = decrypt(token.accessToken)
  const pageId = token.platformUserId!
  const videoState = privacy === 'private' ? 'DRAFT' : 'PUBLISHED'

  // Step 1: Initialize a Reels upload session
  logger.debug('Facebook: starting Reels upload session', { pageId })
  const startRes = await axios.post(
    `${FB_BASE}/${pageId}/video_reels`,
    null,
    {
      params: {
        upload_phase: 'start',
        access_token: pageAccessToken,
      },
    }
  )
  const videoId: string = startRes.data.video_id
  const uploadUrl: string = startRes.data.upload_url

  // Step 2: Upload video bytes by reference (hosted URL — no local file needed)
  logger.debug('Facebook: uploading video from URL', { videoId })
  await axios.post(
    uploadUrl,
    null,
    {
      headers: {
        Authorization: `OAuth ${pageAccessToken}`,
        file_url: publicVideoUrl,
      },
    }
  )

  // Step 3: Poll until the uploaded video has finished processing
  await pollUploadStatus(videoId, pageAccessToken)

  // Step 4: Publish (or save as draft) the Reel
  logger.debug('Facebook: finishing reel upload', { videoId, videoState })
  const publishRes = await axios.post(
    `${FB_BASE}/${pageId}/video_reels`,
    null,
    {
      params: {
        upload_phase: 'finish',
        video_id: videoId,
        description: description.slice(0, 2200),
        video_state: videoState,
        access_token: pageAccessToken,
      },
    }
  )

  if (!publishRes.data.success) {
    throw new Error('Facebook Reels publish step did not return success')
  }

  return {
    videoId,
    url: `https://www.facebook.com/reel/${videoId}`,
  }
}

async function pollUploadStatus(
  videoId: string,
  pageAccessToken: string,
  maxWaitMs = 300_000 // 5 min
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const res = await axios.get(`${FB_BASE}/${videoId}`, {
      params: { fields: 'status', access_token: pageAccessToken },
    })
    const phase = res.data?.status?.video_status
    if (phase === 'ready') return
    if (phase === 'error') throw new Error('Facebook video processing failed')
    await sleep(5_000)
  }
  throw new Error('Facebook video processing timed out')
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
