# AutoShorts — Next.js Frontend

React/Next.js 14 frontend for the AutoShorts AI Agent. Connects to the backend API at `http://localhost:3001`.

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** (custom design tokens)
- **SWR** — data fetching with auto-refresh
- **Zustand** — auth state with localStorage persistence
- **Recharts** — weekly bar chart
- **Lucide React** — icons
- **Axios** — API client with JWT injection and 401 auto-redirect
- **date-fns** — timestamps

## Pages

| Route | Description |
|-------|-------------|
| `/auth/login` | JWT login |
| `/auth/register` | New account |
| `/dashboard` | Stats, activity feed, weekly chart, platform status |
| `/automations` | List, pause/resume, delete automations |
| `/automations/new` | Create automation with OAuth connect |
| `/clips` | Paginated generated clips with AI metadata |
| `/published` | All publications across YouTube + Instagram |
| `/logs` | Real-time system log (auto-refresh 8s) |
| `/settings` | OAuth connections, security info |

## Setup

```bash
cd autoshorts-frontend
npm install

# Copy and edit env
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001

npm run dev
```

Open http://localhost:3000.

## API wiring

Every page fetches from the live backend via SWR:

- **Dashboard stats**: `GET /api/dashboard/stats` — refreshes every 15s
- **Activity feed**: `GET /api/dashboard/activity` — refreshes every 8s
- **Weekly chart**: `GET /api/dashboard/weekly` — refreshes every 60s
- **Clips**: `GET /api/dashboard/clips?page=N` — refreshes every 30s
- **Publications**: `GET /api/dashboard/publications?page=N` — refreshes every 30s
- **Automations**: `GET /api/automations` — refreshes every 10s
- **Connections**: `GET /api/auth/connections` — refreshes every 30s

All mutating operations (create, pause, delete) use `swr/mutation` and revalidate the relevant cache keys after completion.

## Auth flow

1. User logs in → JWT stored in localStorage via Zustand persist middleware
2. Axios interceptor injects `Authorization: Bearer <token>` on every request
3. 401 responses clear the token and redirect to `/auth/login`
4. `AppShell` component checks `isAuthenticated()` on mount and redirects if not logged in

## OAuth flow

Clicking "Connect YouTube" or "Connect Instagram" opens a popup to the backend OAuth initiation route. After the user approves, the backend redirects to `/settings?connected=youtube`. The settings page detects this via `useSearchParams` and re-fetches connections.

For the new automation form, connection status is polled every 2s for up to 60s after the popup opens.
