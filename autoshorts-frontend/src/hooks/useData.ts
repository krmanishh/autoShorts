// src/hooks/useData.ts
import useSWR, { mutate as globalMutate } from 'swr'
import useSWRMutation from 'swr/mutation'
import { automationsApi, dashboardApi, authApi } from '@/lib/api'
import type { CreateAutomationPayload, OAuthConnection } from '@/types'

const fetcher = (fn: () => Promise<unknown>) => fn()

// Shared defaults for hooks that DO need live polling:
// - only while the tab is actually visible/focused
// - refetch when the user comes back to the tab
// - don't keep hammering the API if it's offline/erroring
const livePollOptions = {
  revalidateOnFocus: true,
  refreshWhenHidden: false,
  refreshWhenOffline: false,
}

// ── Dashboard ──────────────────────────────────────────────
// Stats only need to be fresh when you're looking at the dashboard,
// and don't change second-to-second — fetch on load/focus, no fixed poll.
export function useStats() {
  return useSWR('dashboard/stats', () => dashboardApi.stats(), {
    revalidateOnFocus: true,
  })
}

// Activity feed is the one place where "live" actually matters (it's a log),
// so keep a modest poll, but only while the tab is visible.
export function useActivity(limit = 20) {
  return useSWR(['dashboard/activity', limit], () => dashboardApi.activity(limit), {
    refreshInterval: 15_000,
    ...livePollOptions,
  })
}

// Weekly chart data changes at most once a day — fetch once, refresh on focus.
export function useWeekly() {
  return useSWR('dashboard/weekly', () => dashboardApi.weekly(), {
    revalidateOnFocus: true,
  })
}

// Clip/publication lists: fetch on load + when the page regains focus.
// The user can pull-to-refresh / re-navigate if they want the latest.
export function useClips(page = 1) {
  return useSWR(['dashboard/clips', page], () => dashboardApi.clips(page), {
    revalidateOnFocus: true,
  })
}

export function usePublications(page = 1) {
  return useSWR(['dashboard/publications', page], () => dashboardApi.publications(page), {
    revalidateOnFocus: true,
  })
}

// ── Automations ────────────────────────────────────────────
// The automations list doesn't change unless the user (or a worker) acts on
// it. Fetch on mount/focus, and we manually revalidate after any mutation.
export function useAutomations() {
  return useSWR('automations', () => automationsApi.list(), {
    revalidateOnFocus: true,
  })
}

export function useCreateAutomation() {
  return useSWRMutation('automations', async (_key: string, { arg }: { arg: CreateAutomationPayload }) => {
    const result = await automationsApi.create(arg)
    await globalMutate('automations')
    return result
  })
}

export function useToggleAutomation() {
  return useSWRMutation(
    'automations',
    async (_key: string, { arg }: { arg: { id: string; status: 'RUNNING' | 'PAUSED' } }) => {
      const result = await automationsApi.setStatus(arg.id, arg.status)
      await globalMutate('automations')
      return result
    }
  )
}

export function useDeleteAutomation() {
  return useSWRMutation(
    'automations',
    async (_key: string, { arg }: { arg: string }) => {
      await automationsApi.delete(arg)
      await globalMutate('automations')
    }
  )
}

// ── OAuth connections ──────────────────────────────────────
// No background polling at all by default — connections only change when
// the user explicitly goes through a "Connect" flow. That flow drives its
// own short-lived, backed-off polling (see automations/new/page.tsx) by
// calling `mutate()` itself rather than relying on a global interval.
export function useConnections() {
  return useSWR<OAuthConnection[]>('auth/connections', () => authApi.connections(), {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  })
}

// ── Queue status ───────────────────────────────────────────
// This is genuinely "live" data worth polling (active job counts), but
// only while the user is actually looking at the status page and the tab
// is visible.
export function useQueueStatus() {
  return useSWR('queues/status', () => dashboardApi.queueStatus(), {
    refreshInterval: 10_000,
    ...livePollOptions,
  })
}

// ── System health ──────────────────────────────────────────
// Same idea as queue status — useful as a live indicator, but no need to
// poll every 10s; back it off and pause when hidden.
export function useHealth() {
  return useSWR('health', () => dashboardApi.health(), {
    refreshInterval: 20_000,
    ...livePollOptions,
  })
}