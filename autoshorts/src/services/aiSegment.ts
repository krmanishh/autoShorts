// src/services/aiSegment.ts
import Anthropic from '@anthropic-ai/sdk'
import { logger } from './logger'
import type { AISegmentResult } from '../types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Pick the best segment and generate metadata ────────────
export async function selectBestSegment(
  title: string,
  description: string,
  videoDurationSeconds: number,
  clipDurationSeconds: number
): Promise<AISegmentResult> {
  const maxStart = Math.max(0, videoDurationSeconds - clipDurationSeconds)

  const prompt = `You are an expert video editor who creates viral short-form content.

Given this YouTube video:
Title: "${title}"
Description: "${description.slice(0, 800)}"
Total duration: ${videoDurationSeconds}s
Desired clip length: ${clipDurationSeconds}s
Max start time: ${maxStart}s

Your job:
1. Identify the BEST segment for a viral short (most engaging, emotional, surprising, or informative moment).
2. Generate a punchy title for the short (max 80 chars, no clickbait, accurate).
3. Write a compelling caption with a CTA (max 200 chars).
4. Suggest 10-12 relevant hashtags.

Respond with ONLY a JSON object, no markdown, no explanation:
{
  "startTime": <number 0 to ${maxStart}>,
  "endTime": <number startTime + ${clipDurationSeconds}>,
  "score": <float 0-1, confidence this is engaging>,
  "reason": "<one sentence why this segment is best>",
  "title": "<punchy title>",
  "caption": "<caption with CTA>",
  "hashtags": ["hashtag1", "hashtag2", ...]
}`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    const result: AISegmentResult = JSON.parse(text)

    // Clamp values to valid range
    result.startTime = Math.max(0, Math.min(result.startTime, maxStart))
    result.endTime = result.startTime + clipDurationSeconds
    result.score = Math.max(0, Math.min(result.score ?? 0.7, 1))
    result.hashtags = (result.hashtags ?? []).slice(0, 15)

    logger.debug('AI segment selected', {
      startTime: result.startTime,
      score: result.score,
      reason: result.reason,
    })

    return result
  } catch (err) {
    logger.warn('AI segment selection failed, using fallback', { err })
    return fallbackSegment(title, clipDurationSeconds)
  }
}

// ── Fallback: use first N seconds ─────────────────────────
function fallbackSegment(title: string, duration: number): AISegmentResult {
  return {
    startTime: 0,
    endTime: duration,
    score: 0.5,
    reason: 'AI unavailable — using first segment as fallback',
    title: title.slice(0, 80),
    caption: `Watch this! ${title.slice(0, 100)} #shorts`,
    hashtags: ['#shorts', '#reels', '#viral', '#trending', '#fyp', '#ai'],
  }
}
