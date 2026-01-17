-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "paddleCustomerId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "paddleSubscriptionId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "paddlePriceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_paddleSubscriptionId_key" ON "Subscription"("paddleSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_paddleSubscriptionId_idx" ON "Subscription"("paddleSubscriptionId");
