-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('UNCONNECTED', 'INVITE_PENDING', 'CONNECTED', 'REPLIED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('PROFILE_VISIT', 'INVITE', 'MESSAGE', 'EMAIL', 'CHECK_REPLY', 'AI_PERSONALIZE');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "linkedinCookie" TEXT,
    "proxyIp" TEXT,
    "dailyInviteLimit" INTEGER NOT NULL DEFAULT 30,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedinUrl" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "jobTitle" TEXT,
    "company" TEXT,
    "email" TEXT,
    "country" TEXT,
    "gender" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "LeadStatus" NOT NULL DEFAULT 'UNCONNECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "workflowJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignLead" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "currentStepId" TEXT NOT NULL,
    "nextActionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "personalization" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_userId_linkedinUrl_key" ON "Lead"("userId", "linkedinUrl");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignLead_campaignId_leadId_key" ON "CampaignLead"("campaignId", "leadId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLead" ADD CONSTRAINT "CampaignLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLead" ADD CONSTRAINT "CampaignLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
