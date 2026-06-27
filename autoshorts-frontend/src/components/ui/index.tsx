// src/components/ui/index.tsx
'use client'
import clsx from 'clsx'
import type { AutomationStatus, ProcessingStatus, PublicationStatus, LogLevel, Platform } from '@/types'

// ── Status badge ───────────────────────────────────────────
export function StatusBadge({ status }: { status: AutomationStatus | ProcessingStatus | PublicationStatus | string }) {
  const map: Record<string, string> = {
    RUNNING:    'badge badge-green',
    PUBLISHED:  'badge badge-green',
    DONE:       'badge badge-green',
    PAUSED:     'badge badge-yellow',
    PENDING:    'badge badge-yellow',
    QUEUED:     'badge badge-blue',
    PROCESSING: 'badge badge-blue',
    UPLOADING:  'badge badge-blue',
    FAILED:     'badge badge-red',
    ERROR:      'badge badge-red',
    SKIPPED:    'badge badge-gray',
  }
  return (
    <span className={map[status] ?? 'badge badge-gray'}>
      {status === 'RUNNING' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />}
      {status === 'PROCESSING' || status === 'UPLOADING' ? (
        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      ) : null}
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}

// ── Log level badge ────────────────────────────────────────
export function LogBadge({ level }: { level: LogLevel }) {
  const map: Record<LogLevel, string> = {
    INFO:  'badge badge-blue',
    WARN:  'badge badge-yellow',
    ERROR: 'badge badge-red',
    DEBUG: 'badge badge-gray',
  }
  return <span className={map[level]}>{level}</span>
}

// ── Platform badge ─────────────────────────────────────────
export function PlatformBadge({ platform }: { platform: Platform }) {
  if (platform === 'YOUTUBE') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M23.5 6.19a3 3 0 0 0-2.11-2.12C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.39.57A3 3 0 0 0 .5 6.19 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.81 3 3 0 0 0 2.11 2.12C4.46 20.5 12 20.5 12 20.5s7.54 0 9.39-.57a3 3 0 0 0 2.11-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
        YouTube
      </span>
    )
  }
  if (platform === 'FACEBOOK') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>
        Facebook
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-pink-700 bg-pink-50 px-2 py-0.5 rounded-full">
      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
      Instagram
    </span>
  )
}

// ── Stat card ──────────────────────────────────────────────
export function StatCard({
  label, value, delta, icon: Icon, color = 'violet',
}: {
  label: string
  value: number | string
  delta?: string
  icon: React.ElementType
  color?: 'violet' | 'teal' | 'green' | 'red'
}) {
  const iconColors = {
    violet: 'bg-violet-50 text-violet-600',
    teal:   'bg-teal-50 text-teal-600',
    green:  'bg-emerald-50 text-emerald-600',
    red:    'bg-red-50 text-red-600',
  }
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-ink-3 font-medium">{label}</span>
        <div className={clsx('w-7 h-7 rounded-md flex items-center justify-center', iconColors[color])}>
          <Icon size={14} />
        </div>
      </div>
      <div className="text-2xl font-semibold text-ink-1">{value}</div>
      {delta && <div className="text-xs text-ink-4 mt-1">{delta}</div>}
    </div>
  )
}

// ── Skeleton loader ────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('bg-surface-2 rounded animate-pulse', className)} />
}

export function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────
export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon: React.ElementType
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center mb-3">
        <Icon size={22} className="text-ink-4" />
      </div>
      <div className="text-sm font-medium text-ink-2 mb-1">{title}</div>
      <div className="text-xs text-ink-4 max-w-xs">{description}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── Page header ────────────────────────────────────────────
export function PageHeader({
  title, subtitle, action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-1">{title}</h1>
        {subtitle && <p className="text-sm text-ink-3 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── Confirm dialog (simple) ────────────────────────────────
export function ConfirmDialog({
  open, title, description, onConfirm, onCancel, dangerous,
}: {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
  dangerous?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 animate-fade-in">
      <div className="card p-6 w-full max-w-sm mx-4 animate-slide-in">
        <h2 className="text-base font-semibold text-ink-1 mb-1">{title}</h2>
        <p className="text-sm text-ink-3 mb-5">{description}</p>
        <div className="flex gap-2 justify-end">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className={clsx('btn', dangerous ? 'btn-danger' : 'btn-primary')}
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
