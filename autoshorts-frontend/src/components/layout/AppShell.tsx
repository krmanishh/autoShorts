// src/components/layout/AppShell.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { Sidebar } from './Sidebar'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !isAuthenticated()) router.replace('/auth/login')
  }, [mounted, isAuthenticated, router])

  // Render nothing until after the client has mounted and rehydrated the
  // auth store from localStorage. This guarantees the server-rendered HTML
  // (which never has a token) matches the client's first render too,
  // avoiding a hydration mismatch. The auth check itself only happens once
  // mounted, in the effect above.
  if (!mounted || !isAuthenticated()) return null

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-surface-1">
        <div className="max-w-6xl mx-auto p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}