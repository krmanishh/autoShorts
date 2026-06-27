// src/app/layout.tsx
import type { Metadata } from 'next'
import { SWRProvider } from '@/components/layout/SWRProvider'
import { ToastProvider } from '@/components/ui/Toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'AutoShorts — AI Video Agent',
  description: 'Automatically turn long-form videos into viral Shorts and Reels.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-surface-1 text-ink-1">
        <SWRProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </SWRProvider>
      </body>
    </html>
  )
}
