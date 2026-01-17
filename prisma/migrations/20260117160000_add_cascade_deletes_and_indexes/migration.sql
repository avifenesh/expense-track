-- AlterTable: Add cascade delete and indexes

-- Drop existing foreign keys to recreate with CASCADE
ALTER TABLE "Budget" DROP CONSTRAINT IF EXISTS "Budget_accountId_fkey";
ALTER TABLE "Budget" DROP CONSTRAINT IF EXISTS "Budget_categoryId_fkey";

ALTER TABLE "Holding" DROP CONSTRAINT IF EXISTS "Holding_accountId_fkey";
ALTER TABLE "Holding" DROP CONSTRAINT IF EXISTS "Holding_categoryId_fkey";

ALTER TABLE "RecurringTemplate" DROP CONSTRAINT IF EXISTS "RecurringTemplate_accountId_fkey";
ALTER TABLE "RecurringTemplate" DROP CONSTRAINT IF EXISTS "RecurringTemplate_categoryId_fkey";

ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_accountId_fkey";
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_categoryId_fkey";

ALTER TABLE "TransactionRequest" DROP CONSTRAINT IF EXISTS "TransactionRequest_categoryId_fkey";
ALTER TABLE "TransactionRequest" DROP CONSTRAINT IF EXISTS "TransactionRequest_fromId_fkey";
ALTER TABLE "TransactionRequest" DROP CONSTRAINT IF EXISTS "TransactionRequest_toId_fkey";

-- Recreate foreign keys with CASCADE
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Holding" ADD CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringTemplate" ADD CONSTRAINT "RecurringTemplate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringTemplate" ADD CONSTRAINT "RecurringTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransactionRequest" ADD CONSTRAINT "TransactionRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionRequest" ADD CONSTRAINT "TransactionRequest_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionRequest" ADD CONSTRAINT "TransactionRequest_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add new indexes
CREATE INDEX IF NOT EXISTS "Budget_accountId_month_idx" ON "Budget"("accountId", "month");
CREATE INDEX IF NOT EXISTS "ExpenseParticipant_userId_status_idx" ON "ExpenseParticipant"("userId", "status");
CREATE INDEX IF NOT EXISTS "Transaction_date_idx" ON "Transaction"("date");
CREATE INDEX IF NOT EXISTS "TransactionRequest_toId_idx" ON "TransactionRequest"("toId");
