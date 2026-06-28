// src/api/routes/auth.ts
import { Router, Request, Response } from 'express'
import { google } from 'googleapis'
import jwt from 'jsonwebtoken'
import { prisma } from '../../db/client'
import { encrypt } from '../../services/encryption'
import { createOAuth2Client, YOUTUBE_SCOPES } from '../../services/youtube'
import { exchangeInstagramCode } from '../../services/instagram'
import { exchangeFacebookCode } from '../../services/facebook'
import { createOAuthState, consumeOAuthState } from '../../services/oauthState'
import { requireAuth } from '../middleware/auth'
import { logger } from '../../services/logger'

export const authRouter = Router()

// ── POST /api/auth/register ──────────────────────────────
authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, name, password } = req.body
  if (!email || !name || !password)
    return res.status(400).json({ error: 'email, name and password are required' })
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' })

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ error: 'Email already registered' })

  const { createHash } = await import('crypto')
  const passwordHash = createHash('sha256')
    .update(password + process.env.JWT_SECRET)
    .digest('hex')

  const user = await prisma.user.create({ data: { email, name, passwordHash } })
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } })
})

// ── POST /api/auth/login ─────────────────────────────────
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const { createHash } = await import('crypto')
  const hash = createHash('sha256')
    .update(password + process.env.JWT_SECRET)
    .digest('hex')
  if (hash !== user.passwordHash)
    return res.status(401).json({ error: 'Invalid credentials' })

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
})

// ── GET /api/auth/youtube ────────────────────────────────
// Secure: creates a server-side nonce, never exposes JWT in URL
authRouter.get('/youtube', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId
  const state = await createOAuthState(userId)

  const oauth2 = createOAuth2Client()
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: YOUTUBE_SCOPES,
    prompt: 'consent',
    state,
  })
  res.json({ url })
})

// ── GET /api/auth/youtube/callback ───────────────────────
authRouter.get('/youtube/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query as { code?: string; state?: string }
  if (!code || !state)
    return res.redirect(`${process.env.FRONTEND_URL}/settings?error=youtube_missing_params`)

  const userId = await consumeOAuthState(state)
  if (!userId) {
    logger.warn('YouTube OAuth: invalid or expired state nonce')
    return res.redirect(`${process.env.FRONTEND_URL}/settings?error=youtube_invalid_state`)
  }

  try {
    const oauth2 = createOAuth2Client()
    const { tokens } = await oauth2.getToken(code)
    oauth2.setCredentials(tokens)

    const yt = google.youtube({ version: 'v3', auth: oauth2 })
    const channelRes = await yt.channels.list({ part: ['snippet'], mine: true })
    const channel = channelRes.data.items?.[0]

    await prisma.oAuthToken.upsert({
      where: { userId_platform: { userId, platform: 'YOUTUBE' } },
      create: {
        userId, platform: 'YOUTUBE',
        accessToken: encrypt(tokens.access_token!),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope,
        platformUserId: channel?.id,
        platformUsername: channel?.snippet?.customUrl ?? channel?.snippet?.title ?? null,
      },
      update: {
        accessToken: encrypt(tokens.access_token!),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        platformUsername: channel?.snippet?.customUrl ?? channel?.snippet?.title ?? undefined,
      },
    })

    logger.info('YouTube account connected', { userId })
    res.redirect(`${process.env.FRONTEND_URL}/settings?connected=youtube`)
  } catch (err) {
    logger.error('YouTube OAuth callback failed', { err })
    res.redirect(`${process.env.FRONTEND_URL}/settings?error=youtube_auth_failed`)
  }
})

// ── GET /api/auth/instagram ──────────────────────────────
// Uses "Instagram API with Instagram Login" — a separate login flow from
// Facebook Login, with its own app ID/secret and its own authorize/token
// endpoints (instagram.com / graph.instagram.com, NOT graph.facebook.com).
// This is required for the current instagram_business_* permissions —
// they don't exist on the regular Facebook Login dialog.
authRouter.get('/instagram', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId
  const state = await createOAuthState(userId)

  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
    scope: 'instagram_business_basic,instagram_business_content_publish',
    response_type: 'code',
    state,
  })
  res.json({ url: `https://www.instagram.com/oauth/authorize?${params}` })
})

// ── GET /api/auth/instagram/callback ─────────────────────
authRouter.get('/instagram/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query as { code?: string; state?: string }
  if (!code || !state)
    return res.redirect(`${process.env.FRONTEND_URL}/settings?error=instagram_missing_params`)

  const userId = await consumeOAuthState(state)
  if (!userId) {
    logger.warn('Instagram OAuth: invalid or expired state nonce')
    return res.redirect(`${process.env.FRONTEND_URL}/settings?error=instagram_invalid_state`)
  }

  try {
    const result = await exchangeInstagramCode(code)
    await prisma.oAuthToken.upsert({
      where: { userId_platform: { userId, platform: 'INSTAGRAM' } },
      create: {
        userId, platform: 'INSTAGRAM',
        accessToken: encrypt(result.accessToken),
        expiresAt: new Date(Date.now() + result.expiresIn * 1000),
        platformUserId: result.igAccountId,
        platformUsername: result.username,
      },
      update: {
        accessToken: encrypt(result.accessToken),
        expiresAt: new Date(Date.now() + result.expiresIn * 1000),
        platformUsername: result.username,
      },
    })

    logger.info('Instagram account connected', { userId, username: result.username })
    res.redirect(`${process.env.FRONTEND_URL}/settings?connected=instagram`)
  } catch (err) {
    logger.error('Instagram OAuth callback failed', { err })
    res.redirect(`${process.env.FRONTEND_URL}/settings?error=instagram_auth_failed`)
  }
})

// ── GET /api/auth/facebook ────────────────────────────────
// Facebook Pages + Reels publishing. Separate from Instagram because a
// user may want to publish to one, the other, or both — they're different
// destinations even though both ride on the same Meta OAuth dialog.
authRouter.get('/facebook', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId
  const state = await createOAuthState(userId)

  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID!,
    redirect_uri: process.env.FACEBOOK_REDIRECT_URI!,
    scope: 'pages_show_list,pages_read_engagement,pages_manage_posts',
    response_type: 'code',
    state,
  })
  res.json({ url: `https://www.facebook.com/v20.0/dialog/oauth?${params}` })
})

// ── GET /api/auth/facebook/callback ───────────────────────
authRouter.get('/facebook/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query as { code?: string; state?: string }
  if (!code || !state)
    return res.redirect(`${process.env.FRONTEND_URL}/settings?error=facebook_missing_params`)

  const userId = await consumeOAuthState(state)
  if (!userId) {
    logger.warn('Facebook OAuth: invalid or expired state nonce')
    return res.redirect(`${process.env.FRONTEND_URL}/settings?error=facebook_invalid_state`)
  }

  try {
    const result = await exchangeFacebookCode(code)
    await prisma.oAuthToken.upsert({
      where: { userId_platform: { userId, platform: 'FACEBOOK' } },
      create: {
        userId, platform: 'FACEBOOK',
        accessToken: encrypt(result.pageAccessToken),
        expiresAt: new Date(Date.now() + result.expiresIn * 1000),
        platformUserId: result.pageId,
        platformUsername: result.pageName,
      },
      update: {
        accessToken: encrypt(result.pageAccessToken),
        expiresAt: new Date(Date.now() + result.expiresIn * 1000),
        platformUserId: result.pageId,
        platformUsername: result.pageName,
      },
    })

    logger.info('Facebook Page connected', { userId, page: result.pageName })
    res.redirect(`${process.env.FRONTEND_URL}/settings?connected=facebook`)
  } catch (err) {
    logger.error('Facebook OAuth callback failed', { err })
    res.redirect(`${process.env.FRONTEND_URL}/settings?error=facebook_auth_failed`)
  }
})

// ── GET /api/auth/connections ─────────────────────────────
authRouter.get('/connections', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId
  const tokens = await prisma.oAuthToken.findMany({
    where: { userId },
    select: { platform: true, platformUsername: true, expiresAt: true, updatedAt: true },
  })
  res.json(tokens)
})