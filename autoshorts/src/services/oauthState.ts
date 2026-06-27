// src/services/oauthState.ts
// Short-lived nonces stored in Redis that map to userId for OAuth callbacks.
// One-time use; expire after 10 min to prevent replay attacks.
// Reuses the shared IORedis connection from queues.ts instead of opening a new one.
import { redisConnection } from '../queue/queues'
import crypto from 'crypto'

const STATE_TTL_SECONDS = 10 * 60 // 10 minutes

export async function createOAuthState(userId: string): Promise<string> {
  const nonce = crypto.randomBytes(24).toString('hex')
  await redisConnection.set(`oauth:state:${nonce}`, userId, 'EX', STATE_TTL_SECONDS)
  return nonce
}

export async function consumeOAuthState(nonce: string): Promise<string | null> {
  const key = `oauth:state:${nonce}`
  // Atomic GET + DEL via pipeline so the nonce is one-time-use even under concurrency
  const pipeline = redisConnection.pipeline()
  pipeline.get(key)
  pipeline.del(key)
  const results = await pipeline.exec()
  const userId = results?.[0]?.[1] as string | null
  return userId ?? null
}
