// src/app/dashboard/page.tsx
'use client'
import { Video, Scissors, Upload, AlertCircle, Eye, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard, SkeletonCard, PageHeader, StatusBadge, PlatformBadge, LogBadge } from '@/components/ui'
import { WeeklyChart } from '@/components/charts/WeeklyChart'
import { useStats, useActivity, useAutomations, useConnections } from '@/hooks/useData'
import { formatDistanceToNow, parseISO } from 'date-fns'
import type { SystemLog } from '@/types'

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useStats()
  const { data: activity, isLoading: actLoading } = useActivity(15)
  const { data: automations } = useAutomations()
  const { data: connections } = useConnections()

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        subtitle="Live overview — refreshes every 15 seconds"
        action={
          <div className="flex items-center gap-2">
            {automations?.some(a => a.status === 'RUNNING') ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                Agent running
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-ink-3 bg-surface-2 border border-surface-3 px-2.5 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-5" />
                No active automations
              </span>
            )}
          </div>
        }
      />

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard label="Videos processed" value={stats?.videosProcessed ?? 0}
              icon={Video} color="violet" delta="Source videos converted" />
            <StatCard label="Clips generated" value={stats?.clipsGenerated ?? 0}
              icon={Scissors} color="teal" delta="9:16 vertical clips" />
            <StatCard label="Published" value={stats?.published ?? 0}
              icon={Upload} color="green" delta="Across all platforms" />
            <StatCard label="Failed" value={stats?.failed ?? 0}
              icon={AlertCircle} color="red" delta="Auto-retrying" />
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Activity feed */}
        <div className="col-span-2">
          <h2 className="text-sm font-medium text-ink-2 mb-3">Activity feed</h2>
          <div className="card divide-y divide-surface-2">
            {actLoading ? (
              <div className="p-4 flex items-center justify-center">
                <span className="spinner text-ink-4" />
              </div>
            ) : !activity?.length ? (
              <div className="p-6 text-center text-sm text-ink-4">
                No activity yet. Create an automation to get started.
              </div>
            ) : (
              activity.map((log) => <ActivityRow key={log.id} log={log} />)
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Weekly chart */}
          <div>
            <h2 className="text-sm font-medium text-ink-2 mb-3">Shorts published — last 7 days</h2>
            <div className="card p-4">
              <WeeklyChart />
            </div>
          </div>

          {/* Connected platforms */}
          <div>
            <h2 className="text-sm font-medium text-ink-2 mb-3">Connected accounts</h2>
            <div className="space-y-2">
              <PlatformCard
                platform="YOUTUBE"
                connection={connections?.find(c => c.platform === 'YOUTUBE')}
                published={automations?.reduce((s, a) => s + a.stats.published, 0) ?? 0}
              />
              <PlatformCard
                platform="INSTAGRAM"
                connection={connections?.find(c => c.platform === 'INSTAGRAM')}
                published={automations?.reduce((s, a) => s + a.stats.published, 0) ?? 0}
              />
              <PlatformCard
                platform="FACEBOOK"
                connection={connections?.find(c => c.platform === 'FACEBOOK')}
                published={automations?.reduce((s, a) => s + a.stats.published, 0) ?? 0}
              />
            </div>
          </div>

          {/* Active automations summary */}
          <div>
            <h2 className="text-sm font-medium text-ink-2 mb-3">Automations</h2>
            <div className="card divide-y divide-surface-2">
              {!automations?.length ? (
                <div className="p-4 text-xs text-ink-4 text-center">None yet</div>
              ) : (
                automations.map((a) => (
                  <div key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink-1 truncate">{a.name}</div>
                      <div className="text-xs text-ink-4 mt-0.5">
                        {a.lastCheckedAt
                          ? `Checked ${formatDistanceToNow(parseISO(a.lastCheckedAt), { addSuffix: true })}`
                          : 'Not checked yet'}
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function ActivityRow({ log }: { log: SystemLog }) {
  const iconMap: Record<string, React.ElementType> = {
    detect: Eye,
    clip: Scissors,
    publish: Upload,
    retry: RefreshCw,
    agent: AlertCircle,
  }
  const Icon = iconMap[log.category] ?? AlertCircle
  const colorMap: Record<string, string> = {
    detect: 'bg-violet-50 text-violet-600',
    clip: 'bg-teal-50 text-teal-600',
    publish: 'bg-emerald-50 text-emerald-600',
    retry: 'bg-amber-50 text-amber-600',
    agent: 'bg-blue-50 text-blue-600',
  }
  const color = colorMap[log.category] ?? 'bg-surface-2 text-ink-3'

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${color}`}>
        <Icon size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink-1">{log.message}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <LogBadge level={log.level} />
          <span className="text-xs text-ink-4">
            {formatDistanceToNow(parseISO(log.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  )
}

function PlatformCard({
  platform, connection, published,
}: {
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK'
  connection?: { platformUsername: string | null; updatedAt: string }
  published: number
}) {
  const config = {
    YOUTUBE: {
      label: 'YouTube Shorts',
      bg: 'bg-red-500',
      icon: <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M23.5 6.19a3 3 0 0 0-2.11-2.12C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.39.57A3 3 0 0 0 .5 6.19 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.81 3 3 0 0 0 2.11 2.12C4.46 20.5 12 20.5 12 20.5s7.54 0 9.39-.57a3 3 0 0 0 2.11-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>,
    },
    INSTAGRAM: {
      label: 'Instagram Reels',
      bg: 'bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600',
      icon: <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
    },
    FACEBOOK: {
      label: 'Facebook Reels',
      bg: 'bg-blue-600',
      icon: <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>,
    },
  }[platform]

  return (
    <div className="card p-3">
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${config.bg}`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-ink-1">{config.label}</div>
          <div className="text-xs text-ink-4 truncate">
            {connection?.platformUsername ? `@${connection.platformUsername}` : 'Not connected'}
          </div>
        </div>
        {connection ? (
          <span className="badge badge-green text-xs">Connected</span>
        ) : (
          <span className="badge badge-gray text-xs">—</span>
        )}
      </div>
    </div>
  )
}
