'use client'
// src/components/layout/SWRProvider.tsx
import { SWRConfig } from 'swr'

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Global error handler — don't crash on 401 (handled by axios interceptor)
        onError: (error) => {
          if (error?.response?.status === 401) return
          console.error('[SWR]', error)
        },
        // Revalidate when window regains focus
        revalidateOnFocus: true,
        // Retry failed requests up to 3 times
        errorRetryCount: 3,
        // Dedupe requests made within 2s
        dedupingInterval: 2000,
      }}
    >
      {children}
    </SWRConfig>
  )
}
