-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "defaultIncomeGoal" DECIMAL(12,2),
ADD COLUMN     "defaultIncomeGoalCurrency" "Currency";

-- CreateTable
CREATE TABLE "MonthlyIncomeGoal" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyIncomeGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyIncomeGoal_accountId_month_idx" ON "MonthlyIncomeGoal"("accountId", "month");

-- CreateIndex
CREATE INDEX "MonthlyIncomeGoal_deletedAt_idx" ON "MonthlyIncomeGoal"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyIncomeGoal_accountId_month_key" ON "MonthlyIncomeGoal"("accountId", "month");

-- AddForeignKey
ALTER TABLE "MonthlyIncomeGoal" ADD CONSTRAINT "MonthlyIncomeGoal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
