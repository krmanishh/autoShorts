// src/app/settings/page.tsx
'use client'
import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Settings, CheckCircle2, XCircle, ExternalLink, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui'
import { useConnections } from '@/hooks/useData'
import { authApi } from '@/lib/api'
import { formatDistanceToNow, parseISO } from 'date-fns'

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const { data: connections, mutate: refreshConnections, isLoading } = useConnections()

  // Handle OAuth callback redirect
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    if (connected || error) refreshConnections()
  }, [searchParams, refreshConnections])

  const ytConn = connections?.find(c => c.platform === 'YOUTUBE')
  const igConn = connections?.find(c => c.platform === 'INSTAGRAM')
  const fbConn = connections?.find(c => c.platform === 'FACEBOOK')

  async function connectYouTube() {
    try {
      const url = await authApi.youtubeAuthUrl()
      window.open(url, '_blank', 'width=600,height=700,noopener')
      let i = 0
      const poll = setInterval(async () => {
        await refreshConnections()
        if (++i > 60) clearInterval(poll)
      }, 2000)
    } catch (err) {
      console.error('Failed to get YouTube OAuth URL', err)
    }
  }

  async function connectInstagram() {
    try {
      const url = await authApi.instagramAuthUrl()
      window.open(url, '_blank', 'width=600,height=700,noopener')
      let i = 0
      const poll = setInterval(async () => {
        await refreshConnections()
        if (++i > 60) clearInterval(poll)
      }, 2000)
    } catch (err) {
      console.error('Failed to get Instagram OAuth URL', err)
    }
  }

  async function connectFacebook() {
    try {
      const url = await authApi.facebookAuthUrl()
      window.open(url, '_blank', 'width=600,height=700,noopener')
      let i = 0
      const poll = setInterval(async () => {
        await refreshConnections()
        if (++i > 60) clearInterval(poll)
      }, 2000)
    } catch (err) {
      console.error('Failed to get Facebook OAuth URL', err)
    }
  }

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Manage connected accounts and defaults" />

      {/* Success / error banners from OAuth redirect */}
      {searchParams.get('connected') && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 size={15} />
          {(() => {
            const c = searchParams.get('connected')
            const label = c === 'youtube' ? 'YouTube' : c === 'instagram' ? 'Instagram' : 'Facebook'
            return `${label} account connected successfully.`
          })()}
        </div>
      )}
      {searchParams.get('error') && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2 text-sm text-red-700">
          <XCircle size={15} />
          Connection failed. Please try again.
        </div>
      )}

      <div className="space-y-4 max-w-2xl">
        {/* OAuth connections */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-2">
            <div>
              <h2 className="text-sm font-semibold text-ink-1">Platform connections</h2>
              <p className="text-xs text-ink-4 mt-0.5">Connect accounts to enable automatic publishing</p>
            </div>
            <button className="btn text-xs" onClick={() => refreshConnections()}>
              <RefreshCw size={11} /> Refresh
            </button>
          </div>

          <div className="space-y-3">
            <ConnectionRow
              platform="YOUTUBE"
              label="YouTube Shorts"
              description="Upload vertical clips as YouTube Shorts automatically"
              icon={
                <div className="w-9 h-9 rounded-lg bg-red-500 flex items-center justify-center text-white">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M23.5 6.19a3 3 0 0 0-2.11-2.12C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.39.57A3 3 0 0 0 .5 6.19 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.81 3 3 0 0 0 2.11 2.12C4.46 20.5 12 20.5 12 20.5s7.54 0 9.39-.57a3 3 0 0 0 2.11-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
                </div>
              }
              connection={ytConn}
              onConnect={connectYouTube}
              isLoading={isLoading}
            />
            <ConnectionRow
              platform="INSTAGRAM"
              label="Instagram Reels"
              description="Publish vertical clips as Instagram Reels (requires Business account)"
              icon={
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 flex items-center justify-center text-white">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </div>
              }
              connection={igConn}
              onConnect={connectInstagram}
              isLoading={isLoading}
            />
            <ConnectionRow
              platform="FACEBOOK"
              label="Facebook Reels"
              description="Publish vertical clips as Facebook Reels (requires Page admin access)"
              icon={
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>
                </div>
              }
              connection={fbConn}
              onConnect={connectFacebook}
              isLoading={isLoading}
            />
          </div>
        </section>

        {/* Info */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-ink-1 mb-4 pb-3 border-b border-surface-2">Security notes</h2>
          <ul className="space-y-2 text-xs text-ink-3">
            <li className="flex items-start gap-2"><CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" /> OAuth tokens are encrypted at rest using AES-256-GCM before being stored in the database.</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" /> YouTube tokens are automatically refreshed when they expire — no action needed.</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" /> Instagram and Facebook long-lived tokens last ~60 days. Reconnect before expiry to avoid interruptions.</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" /> Revoking access in Google or Meta settings immediately stops the agent from publishing.</li>
          </ul>
        </section>
      </div>
    </AppShell>
  )
}

function ConnectionRow({
  label, description, icon, connection, onConnect, isLoading,
}: {
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK'
  label: string
  description: string
  icon: React.ReactNode
  connection?: { platformUsername: string | null; expiresAt: string | null; updatedAt: string }
  onConnect: () => void
  isLoading: boolean
}) {
  return (
    <div className="flex items-center gap-3 p-3 border border-surface-3 rounded-lg">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink-1">{label}</div>
        <div className="text-xs text-ink-4 mt-0.5">
          {connection
            ? `@${connection.platformUsername ?? 'unknown'} · Connected ${formatDistanceToNow(parseISO(connection.updatedAt), { addSuffix: true })}`
            : description}
        </div>
        {connection?.expiresAt && new Date(connection.expiresAt) < new Date(Date.now() + 7 * 86400000) && (
          <div className="text-xs text-amber-600 mt-0.5">⚠ Token expires soon — reconnect to avoid interruptions</div>
        )}
      </div>
      {connection ? (
        <div className="flex items-center gap-2">
          <span className="badge badge-green text-xs flex items-center gap-1">
            <CheckCircle2 size={10} /> Connected
          </span>
          <button className="btn text-xs" onClick={onConnect}>
            <RefreshCw size={11} /> Reconnect
          </button>
        </div>
      ) : (
        <button className="btn btn-primary text-xs" onClick={onConnect} disabled={isLoading}>
          <ExternalLink size={11} /> Connect
        </button>
      )}
    </div>
  )
}
