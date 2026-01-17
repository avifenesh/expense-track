-- Add CHECK constraint to ensure endMonth is after startMonth when set
-- This prevents invalid recurring templates where end date is before start date

-- Data cleanup: ensure existing rows satisfy the new constraint
-- Any template with endMonth < startMonth is made open-ended by nulling endMonth
UPDATE "RecurringTemplate"
SET "endMonth" = NULL
WHERE "endMonth" IS NOT NULL
  AND "startMonth" IS NOT NULL
  AND "endMonth" < "startMonth";

ALTER TABLE "RecurringTemplate"
ADD CONSTRAINT "check_end_after_start"
CHECK ("endMonth" IS NULL OR "endMonth" >= "startMonth");
