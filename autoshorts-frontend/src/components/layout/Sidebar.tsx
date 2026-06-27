// src/components/layout/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Zap, Plus, Scissors, Upload,
  Terminal, Settings, LogOut, Activity,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useAutomations } from '@/hooks/useData'
import clsx from 'clsx'

const nav = [
  { label: 'Dashboard',      href: '/dashboard',    icon: LayoutDashboard },
  { label: 'Automations',    href: '/automations',  icon: Zap },
  { label: 'New automation', href: '/automations/new', icon: Plus },
]
const output = [
  { label: 'Clips',          href: '/clips',        icon: Scissors },
  { label: 'Published',      href: '/published',    icon: Upload },
]
const system = [
  { label: 'Logs',           href: '/logs',         icon: Terminal },
  { label: 'Status',         href: '/status',       icon: Activity },
  { label: 'Settings',       href: '/settings',     icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()
  const { data: automations } = useAutomations()

  const running = automations?.filter((a) => a.status === 'RUNNING').length ?? 0

  function logout() {
    clearAuth()
    router.push('/auth/login')
  }

  return (
    <aside className="w-[220px] flex-shrink-0 h-screen flex flex-col bg-white border-r border-surface-3 sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-surface-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-ink-1 leading-none">AutoShorts</div>
            <div className="text-2xs text-ink-4 mt-0.5">AI Agent</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-5">
        <NavSection label="Workspace" items={nav} pathname={pathname}
          badge={{ href: '/automations', count: automations?.length ?? 0 }} />
        <NavSection label="Output" items={output} pathname={pathname} />
        <NavSection label="System" items={system} pathname={pathname} />
      </nav>

      {/* Footer */}
      <div className="border-t border-surface-3 p-3 space-y-1">
        {/* Agent status */}
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-ink-3">
          <span className={clsx(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            running > 0 ? 'bg-emerald-500 animate-pulse-dot' : 'bg-ink-5'
          )} />
          {running > 0 ? `${running} automation${running > 1 ? 's' : ''} running` : 'No automations running'}
        </div>
        {/* User */}
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-1 text-left transition-colors group"
        >
          <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-2xs font-semibold flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-ink-2 truncate">{user?.name ?? 'User'}</div>
          </div>
          <LogOut size={13} className="text-ink-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
    </aside>
  )
}

function NavSection({
  label, items, pathname, badge,
}: {
  label: string
  items: typeof nav
  pathname: string
  badge?: { href: string; count: number }
}) {
  return (
    <div>
      <div className="px-2 pb-1 text-2xs font-semibold text-ink-4 uppercase tracking-wider">{label}</div>
      {items.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href) && href !== '/automations/new')
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors',
              active
                ? 'bg-violet-50 text-violet-700 font-medium'
                : 'text-ink-3 hover:bg-surface-1 hover:text-ink-1'
            )}
          >
            <Icon size={15} className="flex-shrink-0" />
            <span className="flex-1">{label}</span>
            {badge?.href === href && badge.count > 0 && (
              <span className="text-2xs font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                {badge.count}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
