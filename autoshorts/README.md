# AutoShorts AI Agent — Backend

Fully automated short-form video pipeline. Monitors YouTube channels, generates 9:16 vertical clips using FFmpeg, selects best segments with Claude AI, and publishes to YouTube Shorts and Instagram Reels automatically.

---

## Architecture

```
PostgreSQL ◄── Prisma ORM ◄── Express API (port 3001)
                                      │
Redis ◄── BullMQ ◄── 3 Workers ───────┘
                     │
         ┌───────────┼───────────┐
    monitorWorker  clipWorker  publishWorker
         │              │           │
    YouTube API    FFmpeg +     YouTube API +
    (detect new)   Claude AI    Instagram API
```

**Data flow per video:**
1. `monitorWorker` — polls channel → detects new video → enqueues clip job
2. `clipWorker` — downloads via yt-dlp → Claude picks best segment → FFmpeg encodes 1080×1920 MP4 → uploads to S3 → enqueues publish job
3. `publishWorker` — uploads to YouTube Shorts + Instagram Reels → stores publication record

---

## Prerequisites

- Node.js 20+
- Docker (for Postgres + Redis)
- `ffmpeg` installed: `brew install ffmpeg` / `apt install ffmpeg`
- `yt-dlp` installed: `pip install yt-dlp`

---

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd autoshorts
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `DATABASE_URL` — leave default if using docker-compose
- `REDIS_URL` — leave default if using docker-compose
- `JWT_SECRET` — any long random string
- `ENCRYPTION_KEY` — exactly 32 characters
- `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` — from Google Cloud Console
- `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` — from Meta Developer Portal
- `ANTHROPIC_API_KEY` — from console.anthropic.com

### 3. Start infrastructure

```bash
docker-compose up -d
```

### 4. Set up database

```bash
npm run db:migrate   # creates tables
npm run db:generate  # generates Prisma client
npm run db:seed      # creates demo user
```

### 5. Google OAuth setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable **YouTube Data API v3**
3. OAuth consent screen → External → Add scopes: `youtube.upload`, `youtube.readonly`
4. Credentials → OAuth 2.0 Client ID → Web application
5. Add redirect URI: `http://localhost:3001/api/auth/youtube/callback`
6. Copy Client ID and Secret to `.env`

### 6. Meta setup (Instagram + Facebook)

Instagram Reels and Facebook Reels both run through the same Meta Developer app — you only need to create **one** app and reuse its App ID/Secret for both `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` and `FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET` in `.env`.

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create app → Business type
3. Add the **Instagram Graph API** product (for Instagram Reels)
4. Add the **Facebook Login** product (for Facebook Reels) and request these permissions under App Review: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `publish_video`
5. Add both redirect URIs:
   - `http://localhost:3001/api/auth/instagram/callback`
   - `http://localhost:3001/api/auth/facebook/callback`
6. Copy the App ID and Secret to **both** the `INSTAGRAM_*` and `FACEBOOK_*` variables in `.env`

**Requirements for Facebook Reels publishing:**
- The connecting user must be an **admin of a Facebook Page** — personal profiles can't publish Reels via the API, only Pages.
- In development mode, the app can only publish to Pages owned by Meta Developer accounts added as Testers/Developers on the app. Production publishing to any Page requires Meta's App Review approval for the `publish_video` permission.
- Facebook's Reels API has no "unlisted" visibility tier. The automation's privacy setting maps as: `PUBLIC`/`UNLISTED` → published immediately, `PRIVATE` → saved as a draft in the Page's content library (not auto-published).

**Requirements for Instagram Reels publishing:**
- Requires an **Instagram Business or Creator account** linked to a Facebook Page — personal Instagram accounts aren't supported by the Graph API.
- Instagram Reels have no privacy/draft tier at all — a Reel is public the instant it publishes, regardless of the automation's privacy setting.

---

## Running

### Development (all processes)

```bash
# Terminal 1: API server
npm run dev

# Terminal 2: Monitor worker
npm run worker:monitor

# Terminal 3: Clip worker
npm run worker:clip

# Terminal 4: Publish worker
npm run worker:publish
```

### Production (Docker)

```bash
docker build -t autoshorts .
docker run --env-file .env -p 3001:3001 autoshorts
```

---

## API Reference

### Auth
| Method | Path | Body |
|--------|------|------|
| POST | `/api/auth/register` | `{ email, name, password }` |
| POST | `/api/auth/login` | `{ email, password }` |
| GET | `/api/auth/youtube` | — → returns OAuth URL |
| GET | `/api/auth/instagram` | — → returns OAuth URL |
| GET | `/api/auth/facebook` | — → returns OAuth URL |
| GET | `/api/auth/connections` | — → connected platforms |

### Automations (requires `Authorization: Bearer <token>`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/automations` | List all |
| POST | `/api/automations` | Create new |
| PATCH | `/api/automations/:id/status` | `{ status: "RUNNING" \| "PAUSED" }` |
| DELETE | `/api/automations/:id` | Delete |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/stats` | Summary counts |
| GET | `/api/dashboard/activity` | Recent log entries |
| GET | `/api/dashboard/weekly` | 7-day publish chart |
| GET | `/api/dashboard/clips` | Paginated clips |
| GET | `/api/dashboard/publications` | Paginated publications |

---

## Create your first automation

```bash
# 1. Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","name":"You","password":"yourpassword"}'

# 2. Login → get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}' | jq -r .token)

# 3. Create automation
curl -X POST http://localhost:3001/api/automations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Channel Clips",
    "sourceType": "YOUTUBE",
    "sourceUrl": "https://youtube.com/@YourChannel",
    "clipDuration": 30,
    "pollingInterval": 5,
    "publishTargets": [
      {"platform": "YOUTUBE", "privacy": "PUBLIC"},
      {"platform": "INSTAGRAM", "privacy": "PUBLIC"},
      {"platform": "FACEBOOK", "privacy": "PUBLIC"}
    ]
  }'
```

That's it. The agent runs fully automatically from here.

---

## Retry behavior

BullMQ handles all retries with exponential backoff:
- Monitor jobs: 3 attempts, 5s → 10s → 20s
- Clip jobs: 3 attempts, 10s → 20s → 40s  
- Publish jobs: 3 attempts, 30s → 60s → 120s

After 3 failures, the video/publication is marked `FAILED` in the database and visible in the dashboard.

---

## Scaling

To handle more channels, increase worker concurrency or run multiple worker processes:

```bash
# Run 4 clip workers in parallel
pm2 start npm --name "clip-worker" -i 4 -- run worker:clip
```

For Kubernetes, deploy each worker type as a separate Deployment with autoscaling on Redis queue depth.
