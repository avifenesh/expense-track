-- Make isMutual NOT NULL
UPDATE "Transaction" SET "isMutual" = false WHERE "isMutual" IS NULL;
ALTER TABLE "Transaction" ALTER COLUMN "isMutual" SET NOT NULL;
ALTER TABLE "Transaction" ALTER COLUMN "isMutual" SET DEFAULT false;
