// src/api/middleware/rateLimit.ts
import { Request, Response, NextFunction } from 'express'

// Simple in-memory rate limiter (use redis-based for multi-instance prod)
const windows = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(options: {
  windowMs: number
  max: number
  keyFn?: (req: Request) => string
  message?: string
}) {
  const { windowMs, max, message = 'Too many requests, please try again later' } = options

  return (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyFn
      ? options.keyFn(req)
      : req.ip ?? req.socket.remoteAddress ?? 'unknown'

    const now = Date.now()
    const entry = windows.get(key)

    if (!entry || now > entry.resetAt) {
      windows.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    entry.count++
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000))
      return res.status(429).json({ error: message })
    }

    next()
  }
}

// Preset limiters
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: 'Too many auth attempts, try again in 15 minutes',
})

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 120,
})

// Cleanup old entries periodically to avoid memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of windows.entries()) {
    if (now > val.resetAt) windows.delete(key)
  }
}, 5 * 60 * 1000)