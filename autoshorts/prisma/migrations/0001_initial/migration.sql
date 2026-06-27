-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('RUNNING', 'PAUSED', 'ERROR');
CREATE TYPE "SourceType" AS ENUM ('YOUTUBE', 'VIMEO', 'RSS', 'WEBSITE', 'CUSTOM');
CREATE TYPE "Platform" AS ENUM ('YOUTUBE', 'INSTAGRAM');
CREATE TYPE "Privacy" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'DONE', 'FAILED', 'SKIPPED');
CREATE TYPE "PublicationStatus" AS ENUM ('PENDING', 'UPLOADING', 'PUBLISHED', 'FAILED');
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR', 'DEBUG');

-- CreateTable: users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateTable: automations
CREATE TABLE "automations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AutomationStatus" NOT NULL DEFAULT 'RUNNING',
    "sourceType" "SourceType" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "channelName" TEXT,
    "clipDuration" INTEGER NOT NULL,
    "pollingInterval" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: oauth_tokens
CREATE TABLE "oauth_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "platformUserId" TEXT,
    "platformUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_tokens_userId_platform_key" ON "oauth_tokens"("userId", "platform");

-- CreateTable: publish_targets
CREATE TABLE "publish_targets" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "privacy" "Privacy" NOT NULL DEFAULT 'PUBLIC',
    CONSTRAINT "publish_targets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "publish_targets_automationId_platform_key" ON "publish_targets"("automationId", "platform");

-- CreateTable: source_videos
CREATE TABLE "source_videos" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "videoUrl" TEXT,
    "duration" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "source_videos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "source_videos_automationId_externalId_key" ON "source_videos"("automationId", "externalId");

-- CreateTable: generated_clips
CREATE TABLE "generated_clips" (
    "id" TEXT NOT NULL,
    "sourceVideoId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "outputPath" TEXT,
    "outputUrl" TEXT,
    "fileSize" INTEGER,
    "aiScore" DOUBLE PRECISION,
    "aiSegmentReason" TEXT,
    "title" TEXT,
    "caption" TEXT,
    "hashtags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generated_clips_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "generated_clips_sourceVideoId_key" ON "generated_clips"("sourceVideoId");

-- CreateTable: publications
CREATE TABLE "publications" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'PENDING',
    "platformVideoId" TEXT,
    "platformUrl" TEXT,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: system_logs
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "automationId" TEXT,
    "level" "LogLevel" NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- Indexes for common queries
CREATE INDEX "system_logs_automationId_createdAt_idx" ON "system_logs"("automationId", "createdAt" DESC);
CREATE INDEX "source_videos_automationId_processingStatus_idx" ON "source_videos"("automationId", "processingStatus");
CREATE INDEX "publications_clipId_platform_idx" ON "publications"("clipId", "platform");

-- Foreign Keys
ALTER TABLE "automations" ADD CONSTRAINT "automations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publish_targets" ADD CONSTRAINT "publish_targets_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_videos" ADD CONSTRAINT "source_videos_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_clips" ADD CONSTRAINT "generated_clips_sourceVideoId_fkey" FOREIGN KEY ("sourceVideoId") REFERENCES "source_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publications" ADD CONSTRAINT "publications_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "generated_clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
