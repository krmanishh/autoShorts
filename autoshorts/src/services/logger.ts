// src/services/logger.ts
import winston from 'winston'
import { prisma } from '../db/client'

const { combine, timestamp, printf, colorize, errors } = winston.format

const fmt = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
  return `${timestamp} [${level}] ${stack || message}${metaStr}`
})

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(errors({ stack: true }), timestamp({ format: 'HH:mm:ss' }), fmt),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), errors({ stack: true }), timestamp({ format: 'HH:mm:ss' }), fmt),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
})

// Also persist important logs to DB for dashboard feed
export async function dbLog(
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
  category: string,
  message: string,
  automationId?: string,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.systemLog.create({
      data: { level, category, message, automationId, metadata },
    })
  } catch {
    // Don't crash if DB log fails
    logger.warn('Failed to write log to DB', { message })
  }
}
