// src/utils/duration.ts

// Parse ISO 8601 duration (PT10M30S) to seconds
export function parseISO8601Duration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/)
  if (!match) return 0
  const hours   = parseFloat(match[1] ?? '0')
  const minutes = parseFloat(match[2] ?? '0')
  const seconds = parseFloat(match[3] ?? '0')
  return hours * 3600 + minutes * 60 + seconds
}
