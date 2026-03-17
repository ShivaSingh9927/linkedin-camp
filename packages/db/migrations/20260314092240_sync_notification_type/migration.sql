/*
  Warnings:

  - The values [UNCONNECTED,INVITE_PENDING] on the enum `LeadStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `updatedAt` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `workflowJson` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `CampaignLead` table. All the data in the column will be lost.
  - You are about to drop the column `currentStepId` on the `CampaignLead` table. All the data in the column will be lost.
  - You are about to drop the column `nextActionDate` on the `CampaignLead` table. All the data in the column will be lost.
  - You are about to drop the column `personalization` on the `CampaignLead` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `CampaignLead` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `jobTitle` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `dailyInviteLimit` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `proxyIp` on the `User` table. All the data in the column will be lost.
  - The `tier` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `ActionLog` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `workflow` to the `Campaign` table without a default value. This is not possible if the table is not empty.
  - Made the column `passwordHash` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ProxyTier" AS ENUM ('ECONOMY', 'RESIDENTIAL');

-- AlterEnum
BEGIN;
CREATE TYPE "LeadStatus_new" AS ENUM ('IMPORTED', 'PENDING', 'CONNECTED', 'REPLIED', 'BOUNCED');
ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Lead" ALTER COLUMN "status" TYPE "LeadStatus_new" USING ("status"::text::"LeadStatus_new");
ALTER TABLE "CampaignLead" ALTER COLUMN "status" TYPE "LeadStatus_new" USING ("status"::text::"LeadStatus_new");
ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";
DROP TYPE "LeadStatus_old";
ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'IMPORTED';
COMMIT;

-- DropForeignKey
ALTER TABLE "ActionLog" DROP CONSTRAINT "ActionLog_leadId_fkey";

-- DropForeignKey
ALTER TABLE "ActionLog" DROP CONSTRAINT "ActionLog_userId_fkey";

-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "updatedAt",
DROP COLUMN "workflowJson",
ADD COLUMN     "workflow" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "CampaignLead" DROP COLUMN "createdAt",
DROP COLUMN "currentStepId",
DROP COLUMN "nextActionDate",
DROP COLUMN "personalization",
DROP COLUMN "updatedAt",
ADD COLUMN     "lastActionAt" TIMESTAMP(3),
ADD COLUMN     "status" "LeadStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "stepIndex" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "country",
DROP COLUMN "email",
DROP COLUMN "gender",
DROP COLUMN "jobTitle",
DROP COLUMN "tags",
DROP COLUMN "updatedAt",
ADD COLUMN     "headline" TEXT,
ADD COLUMN     "location" TEXT,
ALTER COLUMN "status" SET DEFAULT 'IMPORTED';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "dailyInviteLimit",
DROP COLUMN "proxyIp",
ADD COLUMN     "cloudWorkerActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastCloudActionAt" TIMESTAMP(3),
ADD COLUMN     "persistentSessionPath" TEXT,
ADD COLUMN     "proxyId" TEXT,
ALTER COLUMN "passwordHash" SET NOT NULL,
DROP COLUMN "tier",
ADD COLUMN     "tier" "PlanTier" NOT NULL DEFAULT 'FREE';

-- DropTable
DROP TABLE "ActionLog";

-- DropEnum
DROP TYPE "ActionStatus";

-- DropEnum
DROP TYPE "ActionType";

-- DropEnum
DROP TYPE "SubscriptionTier";

-- CreateTable
CREATE TABLE "WorkerLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT,
    "leadId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "meta" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proxy" (
    "id" TEXT NOT NULL,
    "proxyIp" TEXT NOT NULL,
    "proxyHost" TEXT NOT NULL,
    "proxyPort" INTEGER NOT NULL,
    "proxyUsername" TEXT,
    "proxyPassword" TEXT,
    "proxyCountry" TEXT,
    "tierClass" "ProxyTier" NOT NULL DEFAULT 'ECONOMY',
    "maxUsers" INTEGER NOT NULL DEFAULT 15,
    "isAssigned" BOOLEAN NOT NULL DEFAULT false,
    "lockedUntil" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "bannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proxy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "Proxy_proxyIp_key" ON "Proxy"("proxyIp");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "Proxy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerLog" ADD CONSTRAINT "WorkerLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerLog" ADD CONSTRAINT "WorkerLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
