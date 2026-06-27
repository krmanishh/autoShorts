// src/db/client.ts
import { PrismaClient, type Prisma } from '@prisma/client'
import { logger } from '../services/logger'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

// Explicit log config with emit: 'event' is required for $on('error'/'warn')
// to fire. Without this exact shape, $on silently no-ops.
const logConfig: Prisma.LogDefinition[] = [
  { level: 'error', emit: 'event' },
  { level: 'warn', emit: 'event' },
]

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({ log: logConfig })

// Cast needed because PrismaClient's $on overloads are inferred from the
// log config generic, which TypeScript doesn't always narrow automatically
// across the global-singleton reuse path above.
;(prisma as PrismaClient<Prisma.PrismaClientOptions, 'error' | 'warn'>).$on(
  'error',
  (e) => logger.error('Prisma error', { message: e.message })
)
;(prisma as PrismaClient<Prisma.PrismaClientOptions, 'error' | 'warn'>).$on(
  'warn',
  (e) => logger.warn('Prisma warning', { message: e.message })
)

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma
}
