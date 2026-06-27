// src/app/automations/page.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Play, Pause, Trash2, Zap, ExternalLink } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, StatusBadge, EmptyState, ConfirmDialog } from '@/components/ui'
import { useAutomations, useToggleAutomation, useDeleteAutomation } from '@/hooks/useData'
import { useToast } from '@/components/ui/Toast'
import { formatDistanceToNow, parseISO } from 'date-fns'
import type { Automation } from '@/types'

const DURATION_LABELS: Record<number, string> = {
  10: '10s', 15: '15s', 30: '30s', 45: '45s', 60: '60s',
}

export default function AutomationsPage() {
  const { data: automations, isLoading } = useAutomations()
  const { trigger: toggleStatus } = useToggleAutomation()
  const { trigger: deleteAutomation } = useDeleteAutomation()
  const { success, error } = useToast()
  const [deleteTarget, setDeleteTarget] = useState<Automation | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function handleToggle(a: Automation) {
    setTogglingId(a.id)
    try {
      const newStatus = a.status === 'RUNNING' ? 'PAUSED' : 'RUNNING'
      await toggleStatus({ id: a.id, status: newStatus })
      success(`Automation ${newStatus === 'RUNNING' ? 'resumed' : 'paused'}`)
    } catch {
      error('Failed to update automation status')
    }
    setTogglingId(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteAutomation(deleteTarget.id)
      success(`"${deleteTarget.name}" deleted`)
    } catch {
      error('Failed to delete automation')
    }
    setDeleteTarget(null)
  }

  return (
    <AppShell>
      <PageHeader
        title="Automations"
        subtitle={`${automations?.length ?? 0} automation${automations?.length !== 1 ? 's' : ''} configured`}
        action={
          <Link href="/automations/new" className="btn btn-primary">
            <Plus size={14} /> New automation
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-surface-2 rounded w-48 mb-2" />
              <div className="h-3 bg-surface-2 rounded w-72" />
            </div>
          ))}
        </div>
      ) : !automations?.length ? (
        <EmptyState
          icon={Zap}
          title="No automations yet"
          description="Create your first automation to start turning videos into Shorts and Reels automatically."
          action={
            <Link href="/automations/new" className="btn btn-primary">
              <Plus size={14} /> Create automation
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {automations.map((a) => (
            <AutomationCard
              key={a.id}
              automation={a}
              toggling={togglingId === a.id}
              onToggle={() => handleToggle(a)}
              onDelete={() => setDeleteTarget(a)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This will stop monitoring the source and remove all associated data. This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        dangerous
      />
    </AppShell>
  )
}

function AutomationCard({
  automation: a, toggling, onToggle, onDelete,
}: {
  automation: Automation
  toggling: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const platforms = a.publishTargets.map(t => t.platform)

  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
          <Zap size={16} className="text-violet-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-base font-medium text-ink-1">{a.name}</span>
            <StatusBadge status={a.status} />
          </div>
          <div className="text-xs text-ink-4 flex items-center gap-1">
            <span className="bg-surface-2 px-1.5 py-0.5 rounded text-ink-3">{a.sourceType}</span>
            <span className="truncate max-w-xs">{a.sourceUrl}</span>
            <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-ink-4 hover:text-violet-600 flex-shrink-0">
              <ExternalLink size={11} />
            </a>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-ink-4">
            <span>Clip: <span className="text-ink-2 font-medium">{DURATION_LABELS[a.clipDuration]}</span></span>
            <span>Polls every <span className="text-ink-2 font-medium">{a.pollingInterval}m</span></span>
            <span>→ {platforms.join(' + ')}</span>
            {a.lastCheckedAt && (
              <span>Checked {formatDistanceToNow(parseISO(a.lastCheckedAt), { addSuffix: true })}</span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-6 flex-shrink-0 text-center">
          {[
            { label: 'Found', value: a.stats.videosFound },
            { label: 'Clips', value: a.stats.clipsGenerated },
            { label: 'Published', value: a.stats.published },
            { label: 'Failed', value: a.stats.failed },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-lg font-semibold text-ink-1">{value}</div>
              <div className="text-2xs text-ink-4">{label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            className="btn text-xs gap-1"
            onClick={onToggle}
            disabled={toggling}
          >
            {toggling ? (
              <span className="spinner" />
            ) : a.status === 'RUNNING' ? (
              <><Pause size={12} /> Pause</>
            ) : (
              <><Play size={12} /> Resume</>
            )}
          </button>
          <button
            className="btn text-xs text-red-600 hover:bg-red-50 border-red-100"
            onClick={onDelete}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
