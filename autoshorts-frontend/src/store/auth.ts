// src/store/auth.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem('as_token', token)
        // Also set a cookie so Next.js middleware can detect auth on hard refresh
        document.cookie = `as_token=${token}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`
        set({ token, user })
      },
      clearAuth: () => {
        localStorage.removeItem('as_token')
        document.cookie = 'as_token=; path=/; max-age=0'
        set({ token: null, user: null })
      },
      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'autoshorts-auth',
      partialize: (s) => ({ token: s.token, user: s.user }),
    }
  )
)
