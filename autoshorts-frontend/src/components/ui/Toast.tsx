'use client'
// src/components/ui/Toast.tsx
import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react'
import clsx from 'clsx'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const ctx: ToastContextValue = {
    toast: add,
    success: (m) => add(m, 'success'),
    error: (m) => add(m, 'error'),
    warning: (m) => add(m, 'warning'),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <ToastItem
            key={t.id}
            toast={t}
            onDismiss={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const styles: Record<ToastType, { bg: string; icon: React.ReactNode }> = {
    success: { bg: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
    error:   { bg: 'bg-red-50 border-red-200 text-red-800',             icon: <XCircle size={14} className="text-red-500" /> },
    warning: { bg: 'bg-amber-50 border-amber-200 text-amber-800',       icon: <AlertTriangle size={14} className="text-amber-500" /> },
    info:    { bg: 'bg-blue-50 border-blue-200 text-blue-800',          icon: <CheckCircle2 size={14} className="text-blue-500" /> },
  }
  const { bg, icon } = styles[toast.type]

  return (
    <div className={clsx(
      'pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-card text-sm animate-slide-in max-w-sm',
      bg
    )}>
      {icon}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0">
        <X size={13} />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
