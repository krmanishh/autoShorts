// src/app/clips/page.tsx
'use client'
import { useState } from 'react'
import { Scissors, ExternalLink, Clock, Star } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, EmptyState, StatusBadge, PlatformBadge } from '@/components/ui'
import { useClips } from '@/hooks/useData'
import { formatDistanceToNow, parseISO } from 'date-fns'

export default function ClipsPage() {
  const [page, setPage] = useState(1)
  const { data: clips, isLoading } = useClips(page)

  return (
    <AppShell>
      <PageHeader
        title="Generated clips"
        subtitle="All 9:16 vertical clips created by the agent"
      />

      {isLoading ? (
        <div className="card divide-y divide-surface-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex gap-4 animate-pulse">
              <div className="w-12 h-20 bg-surface-2 rounded flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-2 rounded w-64" />
                <div className="h-3 bg-surface-2 rounded w-48" />
                <div className="h-3 bg-surface-2 rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : !clips?.length ? (
        <EmptyState
          icon={Scissors}
          title="No clips yet"
          description="Once the agent detects and processes a video, generated clips will appear here."
        />
      ) : (
        <>
          <div className="card divide-y divide-surface-2">
            {clips.map((clip) => (
              <div key={clip.id} className="p-4 flex items-start gap-4">
                {/* Thumbnail placeholder */}
                <div className="w-11 h-20 bg-gradient-to-b from-violet-100 to-violet-200 rounded flex items-center justify-center flex-shrink-0">
                  <Scissors size={16} className="text-violet-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink-1 truncate">
                        {clip.title ?? clip.sourceVideo.title}
                      </div>
                      <div className="text-xs text-ink-4 mt-0.5 truncate">
                        Source: {clip.sourceVideo.title}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {clip.publications.map((p) => (
                        <div key={p.platform} className="flex items-center gap-1">
                          <PlatformBadge platform={p.platform} />
                          <StatusBadge status={p.status} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Metadata row */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-ink-4">
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {clip.duration}s clip
                    </span>
                    <span>
                      {clip.startTime.toFixed(0)}s – {clip.endTime.toFixed(0)}s
                    </span>
                    {clip.aiScore != null && (
                      <span className="flex items-center gap-0.5">
                        <Star size={10} className="text-amber-400" />
                        {(clip.aiScore * 100).toFixed(0)}% score
                      </span>
                    )}
                    <span className="text-ink-5">
                      {formatDistanceToNow(parseISO(clip.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  {/* AI reason */}
                  {clip.aiSegmentReason && (
                    <div className="mt-1.5 text-xs text-ink-4 italic">"{clip.aiSegmentReason}"</div>
                  )}

                  {/* Hashtags */}
                  {clip.hashtags?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {clip.hashtags.slice(0, 6).map((h) => (
                        <span key={h} className="text-2xs text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{h}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Links */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {clip.publications.filter(p => p.platformUrl).map((p) => (
                    <a
                      key={p.platform}
                      href={p.platformUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn text-xs py-1"
                    >
                      <ExternalLink size={11} />
                      {p.platform === 'YOUTUBE' ? 'YouTube' : p.platform === 'INSTAGRAM' ? 'Instagram' : 'Facebook'}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <button
              className="btn text-xs"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <span className="text-xs text-ink-4">Page {page}</span>
            <button
              className="btn text-xs"
              disabled={(clips?.length ?? 0) < 20}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </AppShell>
  )
}
