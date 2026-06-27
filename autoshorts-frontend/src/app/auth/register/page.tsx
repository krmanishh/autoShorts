// src/app/auth/register/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/lib/api'

export default function RegisterPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await authApi.register(email, name, password)
      setAuth(data.token, data.user)
      router.push('/automations/new')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-lg font-semibold text-ink-1">AutoShorts</span>
        </div>

        <div className="card p-6">
          <h1 className="text-base font-semibold text-ink-1 mb-1">Create account</h1>
          <p className="text-sm text-ink-3 mb-5">Set up your automation agent in minutes</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5">Name</label>
              <input type="text" className="field" placeholder="Your name"
                value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5">Email</label>
              <input type="email" className="field" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5">Password</label>
              <input type="password" className="field" placeholder="Min 8 characters"
                value={password} onChange={(e) => setPassword(e.target.value)}
                minLength={8} required />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? <span className="spinner" /> : 'Create account'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-surface-2 text-center text-sm text-ink-3">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-violet-600 hover:underline font-medium">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
