// src/app/published/page.tsx
'use client'
import { useState } from 'react'
import { Upload, ExternalLink, Clock } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, EmptyState, StatusBadge, PlatformBadge } from '@/components/ui'
import { usePublications } from '@/hooks/useData'
import { format, parseISO } from 'date-fns'

export default function PublishedPage() {
  const [page, setPage] = useState(1)
  const { data: publications, isLoading } = usePublications(page)

  return (
    <AppShell>
      <PageHeader
        title="Published shorts"
        subtitle="All Shorts and Reels published by the agent"
      />

      {isLoading ? (
        <div className="card divide-y divide-surface-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 flex gap-3 animate-pulse">
              <div className="w-8 h-8 bg-surface-2 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-2 rounded w-56" />
                <div className="h-3 bg-surface-2 rounded w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : !publications?.length ? (
        <EmptyState
          icon={Upload}
          title="Nothing published yet"
          description="Published Shorts and Reels will appear here once the agent processes its first video."
        />
      ) : (
        <>
          <div className="card divide-y divide-surface-2">
            {publications.map((pub) => {
              const iconConfig = {
                YOUTUBE: {
                  bg: 'bg-red-500',
                  svg: <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M23.5 6.19a3 3 0 0 0-2.11-2.12C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.39.57A3 3 0 0 0 .5 6.19 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.81 3 3 0 0 0 2.11 2.12C4.46 20.5 12 20.5 12 20.5s7.54 0 9.39-.57a3 3 0 0 0 2.11-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>,
                },
                INSTAGRAM: {
                  bg: 'bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600',
                  svg: <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
                },
                FACEBOOK: {
                  bg: 'bg-blue-600',
                  svg: <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>,
                },
              }[pub.platform]

              return (
              <div key={pub.id} className="px-4 py-3 flex items-center gap-3">
                {/* Platform icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 ${iconConfig.bg}`}>
                  {iconConfig.svg}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-1 truncate">
                    {pub.clip.title ?? pub.clip.sourceVideo.title}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <PlatformBadge platform={pub.platform} />
                    <StatusBadge status={pub.status} />
                    {pub.publishedAt && (
                      <span className="text-xs text-ink-4 flex items-center gap-0.5">
                        <Clock size={10} />
                        {format(parseISO(pub.publishedAt), 'MMM d, h:mm a')}
                      </span>
                    )}
                    <span className="text-xs text-ink-4">{pub.clip.duration}s</span>
                  </div>
                </div>

                {pub.platformUrl && (
                  <a
                    href={pub.platformUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn text-xs py-1 flex-shrink-0"
                  >
                    <ExternalLink size={11} /> View
                  </a>
                )}

                {pub.status === 'FAILED' && (
                  <span className="text-xs text-red-500 flex-shrink-0">Retry pending</span>
                )}
              </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between mt-4">
            <button className="btn text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span className="text-xs text-ink-4">Page {page}</span>
            <button className="btn text-xs" disabled={(publications?.length ?? 0) < 20} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </>
      )}
    </AppShell>
  )
}
