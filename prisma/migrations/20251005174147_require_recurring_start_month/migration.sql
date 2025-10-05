/*
  Warnings:

  - Made the column `startMonth` on table `RecurringTemplate` required. This step will fail if there are existing NULL values in that column.

*/
-- Set startMonth to createdAt month for existing NULL values
UPDATE "RecurringTemplate"
SET "startMonth" = DATE_TRUNC('month', "createdAt")
WHERE "startMonth" IS NULL;

-- AlterTable
ALTER TABLE "RecurringTemplate" ALTER COLUMN "startMonth" SET NOT NULL;
