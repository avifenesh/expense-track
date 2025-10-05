-- AlterTable
-- First add the column as nullable with default
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "isMutual" BOOLEAN DEFAULT false;

-- Update any NULL values to false
UPDATE "Transaction" SET "isMutual" = false WHERE "isMutual" IS NULL;

-- Now make it NOT NULL
ALTER TABLE "Transaction" ALTER COLUMN "isMutual" SET NOT NULL;
