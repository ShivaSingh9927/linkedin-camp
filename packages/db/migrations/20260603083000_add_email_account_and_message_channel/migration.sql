-- Add Message.channel + subject + messageId so email sends can be
-- distinguished from LinkedIn DMs in the audit/inbox.
ALTER TABLE "Message"
    ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'linkedin',
    ADD COLUMN "subject" TEXT,
    ADD COLUMN "messageId" TEXT;

CREATE INDEX "Message_userId_channel_sentAt_idx" ON "Message"("userId", "channel", "sentAt");

-- Per-user outgoing email account. One row per user; password is
-- AES-256-GCM encrypted with CRM_ENCRYPTION_KEY before write.
CREATE TABLE "EmailAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'smtp',
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "oauthRefreshToken" TEXT,
    "oauthAccessToken" TEXT,
    "oauthExpiresAt" TIMESTAMP(3),
    "lastSendAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailAccount_userId_key" ON "EmailAccount"("userId");

ALTER TABLE "EmailAccount"
    ADD CONSTRAINT "EmailAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
