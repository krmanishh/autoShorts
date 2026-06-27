// src/app/automations/new/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2, ExternalLink, Youtube, Instagram, Info } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useCreateAutomation, useConnections } from '@/hooks/useData'
import { authApi } from '@/lib/api'
import type { SourceType, Platform, Privacy } from '@/types'
import clsx from 'clsx'

const DURATIONS = [
  { value: 10, label: '10 sec' },
  { value: 15, label: '15 sec' },
  { value: 30, label: '30 sec' },
  { value: 45, label: '45 sec' },
  { value: 60, label: '60 sec' },
]

const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'VIMEO',   label: 'Vimeo' },
  { value: 'RSS',     label: 'RSS Feed' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'CUSTOM',  label: 'Custom URL' },
]

const INTERVALS = [
  { value: 5,  label: 'Every 5 min' },
  { value: 15, label: 'Every 15 min' },
  { value: 30, label: 'Every 30 min' },
]

export default function NewAutomationPage() {
  const router = useRouter()
  const { trigger: createAutomation, isMutating } = useCreateAutomation()
  const { data: connections, mutate: refreshConnections } = useConnections()

  const [name, setName] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>('YOUTUBE')
  const [sourceUrl, setSourceUrl] = useState('')
  const [channelName, setChannelName] = useState('')
  const [clipDuration, setClipDuration] = useState(30)
  const [pollingInterval, setPollingInterval] = useState(5)
  const [ytPrivacy] = useState<Privacy>('PUBLIC')
  const [igPrivacy] = useState<Privacy>('PUBLIC')
  const [fbPrivacy] = useState<Privacy>('PUBLIC')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])
  const [error, setError] = useState('')
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null)

  const ytConnected = connections?.some(c => c.platform === 'YOUTUBE')
  const igConnected = connections?.some(c => c.platform === 'INSTAGRAM')
  const fbConnected = connections?.some(c => c.platform === 'FACEBOOK')
  const ytConn = connections?.find(c => c.platform === 'YOUTUBE')
  const igConn = connections?.find(c => c.platform === 'INSTAGRAM')
  const fbConn = connections?.find(c => c.platform === 'FACEBOOK')

  function togglePlatform(p: Platform) {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  async function connectPlatform(p: Platform) {
    setConnectingPlatform(p)
    try {
      // Get the OAuth URL from the authenticated API endpoint
      // The backend creates a secure server-side nonce — no JWT in the URL
      const urlFn =
        p === 'YOUTUBE' ? authApi.youtubeAuthUrl :
        p === 'INSTAGRAM' ? authApi.instagramAuthUrl :
        authApi.facebookAuthUrl
      const url = await urlFn()
      const popup = window.open(url, '_blank', 'width=600,height=700,noopener')

      // Poll connections until it appears (up to ~2 min), with backoff to avoid
      // hammering the rate-limited /api/auth endpoint
      let attempts = 0
      const maxAttempts = 24
      const poll = async () => {
        attempts++
        const fresh = await refreshConnections() // use the *returned* fresh data, not the stale closure
        const found = fresh?.some(c => c.platform === p)
        if (found) {
          if (!selectedPlatforms.includes(p)) {
            setSelectedPlatforms(prev => [...prev, p])
          }
          return
        }
        if (attempts >= maxAttempts) return
        const delay = attempts < 5 ? 3000 : 10000 // back off over time
        setTimeout(poll, delay)
      }
      setTimeout(poll, 3000)
    } catch (err) {
      console.error('Failed to get OAuth URL', err)
    } finally {
      setConnectingPlatform(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!sourceUrl.trim()) return setError('Source URL is required')
    if (!selectedPlatforms.length) return setError('Select at least one publishing platform')

    const publishTargets = selectedPlatforms.map(p => ({
      platform: p,
      privacy: p === 'YOUTUBE' ? ytPrivacy : p === 'INSTAGRAM' ? igPrivacy : fbPrivacy,
    }))

    try {
      await createAutomation({
        name: name || `${sourceType} → ${selectedPlatforms.join(' + ')}`,
        sourceType,
        sourceUrl: sourceUrl.trim(),
        channelName: channelName || undefined,
        clipDuration,
        pollingInterval,
        publishTargets,
      })
      router.push('/automations')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Failed to create automation')
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/automations" className="btn text-xs">
            <ArrowLeft size={13} /> Back
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-ink-1">New automation</h1>
            <p className="text-sm text-ink-3 mt-0.5">Configure once — runs forever</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Source */}
          <Section title="Content source" step={1}>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5">Automation name <span className="text-ink-4 font-normal">(optional)</span></label>
              <input className="field" placeholder="e.g. MrBeast Tech → Shorts"
                value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1.5">Platform</label>
                <select className="field" value={sourceType} onChange={e => setSourceType(e.target.value as SourceType)}>
                  {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1.5">Check frequency</label>
                <select className="field" value={pollingInterval} onChange={e => setPollingInterval(Number(e.target.value))}>
                  {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5">Channel URL</label>
              <input className="field" type="url"
                placeholder="https://youtube.com/@channelname"
                value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} required />
              <p className="text-xs text-ink-4 mt-1">
                {sourceType === 'YOUTUBE' ? 'Accepts @handle, /channel/ID, or /c/name formats' : 'Full URL to the content source'}
              </p>
            </div>
          </Section>

          {/* Clip duration */}
          <Section title="Clip duration" step={2}>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-2">How long should each Short be?</label>
              <div className="flex gap-2">
                {DURATIONS.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setClipDuration(d.value)}
                    className={clsx(
                      'px-3.5 py-2 rounded text-sm font-medium border transition-colors',
                      clipDuration === d.value
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'bg-white border-surface-3 text-ink-2 hover:bg-surface-1'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-start gap-1.5 text-xs text-ink-4 bg-violet-50 border border-violet-100 rounded p-2.5">
                <Info size={12} className="text-violet-400 flex-shrink-0 mt-0.5" />
                Claude AI analyzes the video and picks the most engaging {clipDuration}s segment. Falls back to the first {clipDuration}s if unavailable.
              </div>
            </div>
          </Section>

          {/* Publishing platforms */}
          <Section title="Publishing platforms" step={3}>
            <p className="text-xs text-ink-4 -mt-1 mb-3">Connect accounts and select where to publish. At least one required.</p>
            <div className="space-y-2">
              <PlatformConnectRow
                platform="YOUTUBE"
                label="YouTube Shorts"
                description="Publish as YouTube Shorts (vertical, ≤60s)"
                icon={<div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center text-white"><svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M23.5 6.19a3 3 0 0 0-2.11-2.12C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.39.57A3 3 0 0 0 .5 6.19 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.81 3 3 0 0 0 2.11 2.12C4.46 20.5 12 20.5 12 20.5s7.54 0 9.39-.57a3 3 0 0 0 2.11-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg></div>}
                connected={!!ytConnected}
                username={ytConn?.platformUsername ?? null}
                selected={selectedPlatforms.includes('YOUTUBE')}
                connecting={connectingPlatform === 'YOUTUBE'}
                onConnect={() => connectPlatform('YOUTUBE')}
                onToggle={() => togglePlatform('YOUTUBE')}
              />
              <PlatformConnectRow
                platform="INSTAGRAM"
                label="Instagram Reels"
                description="Publish as Instagram Reels (requires Business account)"
                icon={<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 flex items-center justify-center text-white"><svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></div>}
                connected={!!igConnected}
                username={igConn?.platformUsername ?? null}
                selected={selectedPlatforms.includes('INSTAGRAM')}
                connecting={connectingPlatform === 'INSTAGRAM'}
                onConnect={() => connectPlatform('INSTAGRAM')}
                onToggle={() => togglePlatform('INSTAGRAM')}
              />
              <PlatformConnectRow
                platform="FACEBOOK"
                label="Facebook Reels"
                description="Publish to a connected Facebook Page (requires Page admin access)"
                icon={<div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white"><svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg></div>}
                connected={!!fbConnected}
                username={fbConn?.platformUsername ?? null}
                selected={selectedPlatforms.includes('FACEBOOK')}
                connecting={connectingPlatform === 'FACEBOOK'}
                onConnect={() => connectPlatform('FACEBOOK')}
                onToggle={() => togglePlatform('FACEBOOK')}
              />
            </div>
          </Section>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-2 pt-2">
            <Link href="/automations" className="btn flex-1 justify-center">Cancel</Link>
            <button type="submit" disabled={isMutating} className="btn btn-primary flex-1 justify-center">
              {isMutating ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : 'Launch automation'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}

function Section({ title, step, children }: { title: string; step: number; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-surface-2">
        <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-2xs font-semibold flex items-center justify-center flex-shrink-0">{step}</span>
        <span className="text-sm font-semibold text-ink-1">{title}</span>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function PlatformConnectRow({
  platform, label, description, icon,
  connected, username, selected, connecting,
  onConnect, onToggle,
}: {
  platform: Platform; label: string; description: string; icon: React.ReactNode
  connected: boolean; username: string | null; selected: boolean; connecting: boolean
  onConnect: () => void; onToggle: () => void
}) {
  return (
    <div className={clsx(
      'border rounded-lg p-3 transition-colors',
      selected ? 'border-violet-300 bg-violet-50/50' : 'border-surface-3 bg-white'
    )}>
      <div className="flex items-center gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-ink-1">{label}</div>
          <div className="text-xs text-ink-4">
            {connected && username ? `@${username} · Connected` : description}
          </div>
        </div>
        {connected ? (
          <button
            type="button"
            onClick={onToggle}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors',
              selected
                ? 'bg-violet-600 border-violet-600 text-white'
                : 'bg-white border-surface-3 text-ink-2 hover:bg-surface-1'
            )}
          >
            {selected && <Check size={11} />}
            {selected ? 'Selected' : 'Select'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={connecting}
            className="btn text-xs"
          >
            {connecting ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
            Connect
          </button>
        )}
      </div>
    </div>
  )
}