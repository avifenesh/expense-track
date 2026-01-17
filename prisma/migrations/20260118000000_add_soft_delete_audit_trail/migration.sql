-- Add soft delete audit trail fields to Account
ALTER TABLE "Account" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Account" ADD COLUMN "deletedBy" TEXT;
CREATE INDEX "Account_deletedAt_idx" ON "Account"("deletedAt");

-- Add soft delete audit trail fields to Budget
ALTER TABLE "Budget" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Budget" ADD COLUMN "deletedBy" TEXT;
CREATE INDEX "Budget_deletedAt_idx" ON "Budget"("deletedAt");

-- Add soft delete audit trail fields to Holding
ALTER TABLE "Holding" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Holding" ADD COLUMN "deletedBy" TEXT;
CREATE INDEX "Holding_deletedAt_idx" ON "Holding"("deletedAt");

-- Add soft delete audit trail fields to RecurringTemplate
ALTER TABLE "RecurringTemplate" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "RecurringTemplate" ADD COLUMN "deletedBy" TEXT;
CREATE INDEX "RecurringTemplate_deletedAt_idx" ON "RecurringTemplate"("deletedAt");

-- Add soft delete audit trail fields to Transaction
ALTER TABLE "Transaction" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "deletedBy" TEXT;
CREATE INDEX "Transaction_deletedAt_idx" ON "Transaction"("deletedAt");
