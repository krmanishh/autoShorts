// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/auth/login', '/auth/register']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes and Next.js internals
  if (
    PUBLIC_ROUTES.some(r => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Check for auth token in cookie (set client-side via localStorage — so
  // middleware can't fully verify JWT here; the AppShell client component
  // handles redirect for unauthenticated users after hydration.
  // This middleware just handles hard refreshes via a lightweight cookie.)
  const token = request.cookies.get('as_token')?.value
  if (!token && pathname !== '/') {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
