-- AlterTable
ALTER TABLE "ExpenseParticipant" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" TEXT;

-- AlterTable
ALTER TABLE "SharedExpense" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" TEXT;

-- CreateIndex
CREATE INDEX "ExpenseParticipant_deletedAt_idx" ON "ExpenseParticipant"("deletedAt");

-- CreateIndex
CREATE INDEX "SharedExpense_deletedAt_idx" ON "SharedExpense"("deletedAt");
