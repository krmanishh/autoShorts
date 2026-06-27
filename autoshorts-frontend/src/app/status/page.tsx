// src/app/status/page.tsx
'use client'
import { Database, Server, Cpu, Upload, Scissors, Eye, CheckCircle2, XCircle, Activity } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, Skeleton } from '@/components/ui'
import { useHealth, useQueueStatus } from '@/hooks/useData'
import clsx from 'clsx'
import type { QueueJobCounts } from '@/types'

export default function StatusPage() {
  const { data: health, isLoading: healthLoading } = useHealth()
  const { data: queues, isLoading: queuesLoading } = useQueueStatus()

  const isOk = health?.status === 'ok'

  return (
    <AppShell>
      <PageHeader
        title="System status"
        subtitle="Live infrastructure health — refreshes every 5–10 seconds"
      />

      {/* Overall status banner */}
      <div className={clsx(
        'flex items-center gap-3 p-4 rounded-xl border mb-6',
        healthLoading ? 'bg-surface-2 border-surface-3' :
        isOk ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
      )}>
        {healthLoading ? (
          <Skeleton className="w-5 h-5 rounded-full" />
        ) : isOk ? (
          <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" />
        ) : (
          <XCircle size={20} className="text-amber-500 flex-shrink-0" />
        )}
        <div>
          <div className={clsx('text-sm font-semibold',
            healthLoading ? 'text-ink-3' : isOk ? 'text-emerald-800' : 'text-amber-800'
          )}>
            {healthLoading ? 'Checking...' : isOk ? 'All systems operational' : 'Service degraded'}
          </div>
          {health && (
            <div className="text-xs text-ink-4 mt-0.5">
              Uptime {formatUptime(health.uptime)} · v{health.version} · Last checked {new Date(health.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Infrastructure checks */}
        <div>
          <h2 className="text-sm font-medium text-ink-2 mb-3">Infrastructure</h2>
          <div className="card divide-y divide-surface-2">
            <InfraRow
              icon={Database}
              label="PostgreSQL"
              detail="Primary database"
              status={health?.checks.database}
              loading={healthLoading}
            />
            <InfraRow
              icon={Server}
              label="Redis"
              detail="Queue broker + state"
              status={health?.checks.redis}
              loading={healthLoading}
            />
            <InfraRow
              icon={Activity}
              label="API server"
              detail={`Handling requests · port 3001`}
              status={health ? 'ok' : undefined}
              loading={healthLoading}
            />
          </div>
        </div>

        {/* Worker checks */}
        <div>
          <h2 className="text-sm font-medium text-ink-2 mb-3">Workers</h2>
          <div className="card divide-y divide-surface-2">
            <WorkerRow
              icon={Eye}
              label="Monitor worker"
              detail="Polls source channels for new videos"
              active={(queues?.monitor.active ?? 0) > 0}
              waiting={queues?.monitor.waiting ?? 0}
              loading={queuesLoading}
            />
            <WorkerRow
              icon={Scissors}
              label="Clip worker"
              detail="Downloads + AI analysis + FFmpeg encode"
              active={(queues?.clip.active ?? 0) > 0}
              waiting={queues?.clip.waiting ?? 0}
              loading={queuesLoading}
            />
            <WorkerRow
              icon={Upload}
              label="Publish worker"
              detail="Uploads to YouTube Shorts + Instagram Reels"
              active={(queues?.publish.active ?? 0) > 0}
              waiting={queues?.publish.waiting ?? 0}
              loading={queuesLoading}
            />
          </div>
        </div>
      </div>

      {/* Queue depths */}
      <h2 className="text-sm font-medium text-ink-2 mb-3">Queue depths</h2>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <QueueCard
          label="Monitor queue"
          icon={Eye}
          counts={queues?.monitor}
          loading={queuesLoading}
          color="violet"
        />
        <QueueCard
          label="Clip queue"
          icon={Scissors}
          counts={queues?.clip}
          loading={queuesLoading}
          color="teal"
        />
        <QueueCard
          label="Publish queue"
          icon={Upload}
          counts={queues?.publish}
          loading={queuesLoading}
          color="green"
        />
      </div>

      {/* Processing pipeline viz */}
      <h2 className="text-sm font-medium text-ink-2 mb-3">Pipeline</h2>
      <div className="card p-5">
        <PipelineViz queues={queues} loading={queuesLoading} />
      </div>
    </AppShell>
  )
}

// ── Sub-components ─────────────────────────────────────────

function InfraRow({
  icon: Icon, label, detail, status, loading,
}: {
  icon: React.ElementType
  label: string
  detail: string
  status?: 'ok' | 'error'
  loading: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-ink-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink-1">{label}</div>
        <div className="text-xs text-ink-4">{detail}</div>
      </div>
      {loading ? (
        <Skeleton className="w-14 h-5 rounded-full" />
      ) : status === 'ok' ? (
        <span className="badge badge-green flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
          Healthy
        </span>
      ) : status === 'error' ? (
        <span className="badge badge-red">Down</span>
      ) : (
        <span className="badge badge-gray">Unknown</span>
      )}
    </div>
  )
}

function WorkerRow({
  icon: Icon, label, detail, active, waiting, loading,
}: {
  icon: React.ElementType
  label: string
  detail: string
  active: boolean
  waiting: number
  loading: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-ink-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink-1">{label}</div>
        <div className="text-xs text-ink-4">{detail}</div>
      </div>
      {loading ? (
        <Skeleton className="w-16 h-5 rounded-full" />
      ) : active ? (
        <span className="badge badge-violet flex items-center gap-1">
          <span className="spinner w-2.5 h-2.5 border border-current border-t-transparent" />
          Processing
        </span>
      ) : waiting > 0 ? (
        <span className="badge badge-yellow">{waiting} queued</span>
      ) : (
        <span className="badge badge-gray flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-ink-4" />
          Idle
        </span>
      )}
    </div>
  )
}

function QueueCard({
  label, icon: Icon, counts, loading, color,
}: {
  label: string
  icon: React.ElementType
  counts?: QueueJobCounts
  loading: boolean
  color: 'violet' | 'teal' | 'green'
}) {
  const iconColors = {
    violet: 'bg-violet-50 text-violet-600',
    teal: 'bg-teal-50 text-teal-600',
    green: 'bg-emerald-50 text-emerald-600',
  }

  const rows = [
    { label: 'Waiting', value: counts?.waiting ?? 0, color: 'text-amber-600' },
    { label: 'Active', value: counts?.active ?? 0, color: 'text-violet-600' },
    { label: 'Completed', value: counts?.completed ?? 0, color: 'text-emerald-600' },
    { label: 'Failed', value: counts?.failed ?? 0, color: 'text-red-600' },
  ]

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center', iconColors[color])}>
          <Icon size={14} />
        </div>
        <span className="text-sm font-medium text-ink-1">{label}</span>
      </div>
      {loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-3 w-full" />)}
        </div>
      ) : (
        <div className="space-y-1">
          {rows.map(r => (
            <div key={r.label} className="flex items-center justify-between text-xs">
              <span className="text-ink-4">{r.label}</span>
              <span className={clsx('font-mono font-medium', r.value > 0 ? r.color : 'text-ink-5')}>
                {r.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PipelineViz({ queues, loading }: { queues?: { monitor: QueueJobCounts; clip: QueueJobCounts; publish: QueueJobCounts }; loading: boolean }) {
  const stages = [
    { label: 'Source monitor', sublabel: 'Detects new videos', active: (queues?.monitor.active ?? 0) > 0, waiting: queues?.monitor.waiting ?? 0 },
    { label: 'Clip generation', sublabel: 'AI + FFmpeg encode', active: (queues?.clip.active ?? 0) > 0, waiting: queues?.clip.waiting ?? 0 },
    { label: 'Publishing', sublabel: 'YouTube + Instagram', active: (queues?.publish.active ?? 0) > 0, waiting: queues?.publish.waiting ?? 0 },
  ]

  return (
    <div className="flex items-center gap-0">
      {stages.map((stage, i) => (
        <div key={stage.label} className="flex items-center flex-1">
          <div className={clsx(
            'flex-1 rounded-lg p-3 border text-center transition-colors',
            loading ? 'bg-surface-1 border-surface-3' :
            stage.active ? 'bg-violet-50 border-violet-200' :
            stage.waiting > 0 ? 'bg-amber-50 border-amber-200' :
            'bg-surface-1 border-surface-3'
          )}>
            <div className={clsx(
              'text-sm font-medium',
              stage.active ? 'text-violet-700' :
              stage.waiting > 0 ? 'text-amber-700' : 'text-ink-3'
            )}>
              {stage.label}
            </div>
            <div className="text-xs text-ink-4 mt-0.5">{stage.sublabel}</div>
            {!loading && (
              <div className="mt-2">
                {stage.active ? (
                  <span className="text-xs font-medium text-violet-600 flex items-center gap-1 justify-center">
                    <span className="spinner w-2.5 h-2.5 border border-current border-t-transparent" />
                    Processing
                  </span>
                ) : stage.waiting > 0 ? (
                  <span className="text-xs text-amber-600 font-medium">{stage.waiting} queued</span>
                ) : (
                  <span className="text-xs text-ink-5">Idle</span>
                )}
              </div>
            )}
          </div>
          {i < stages.length - 1 && (
            <div className="w-8 flex items-center justify-center flex-shrink-0">
              <div className="h-px w-full bg-surface-3" />
              <div className="text-ink-5 text-xs ml-1">→</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`
}
