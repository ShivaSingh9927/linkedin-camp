-- Team collaboration Phase 1: make teams sellable (seat-based, Business-only).
-- Team gains an effective tier + purchased-seat count (mirrored from the owner's
-- subscription by the Razorpay webhook, then fanned out to members). The bare
-- ownerId string becomes a real FK to User. A Subscription can now attach to a
-- Team (the seat-based subscription the owner pays for).

-- AlterTable: Team gains tier + seat count
ALTER TABLE "Team" ADD COLUMN "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE';
ALTER TABLE "Team" ADD COLUMN "seatsPurchased" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: Subscription can belong to a Team
ALTER TABLE "Subscription" ADD COLUMN "teamId" TEXT;

-- CreateIndex: one subscription per team
CREATE UNIQUE INDEX "Subscription_teamId_key" ON "Subscription"("teamId");

-- AddForeignKey: Team.ownerId → User (was a bare string)
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Subscription.teamId → Team
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
