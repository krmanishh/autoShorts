// src/db/seed.ts
import 'dotenv/config'
import { prisma } from './client'
import { createHash } from 'crypto'

async function main() {
  console.log('Seeding database...')

  const passwordHash = createHash('sha256')
    .update('password123' + process.env.JWT_SECRET)
    .digest('hex')

  const user = await prisma.user.upsert({
    where: { email: 'demo@autoshorts.ai' },
    update: {},
    create: {
      email: 'demo@autoshorts.ai',
      name: 'Demo User',
      passwordHash,
    },
  })

  console.log(`User: ${user.email} (password: password123)`)

  const automation = await prisma.automation.upsert({
    where: { id: 'seed-automation-1' },
    update: {},
    create: {
      id: 'seed-automation-1',
      userId: user.id,
      name: 'MrBeast Tech → Shorts & Reels',
      sourceType: 'YOUTUBE',
      sourceUrl: 'https://youtube.com/@MrBeastTech',
      channelName: 'MrBeast Tech',
      clipDuration: 30,
      pollingInterval: 5,
      status: 'RUNNING',
      publishTargets: {
        create: [
          { platform: 'YOUTUBE', privacy: 'PUBLIC' },
          { platform: 'INSTAGRAM', privacy: 'PUBLIC' },
        ],
      },
    },
  })

  console.log(`Automation: ${automation.name}`)
  console.log('Seed complete.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
