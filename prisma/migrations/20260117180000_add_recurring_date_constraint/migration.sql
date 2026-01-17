-- Add CHECK constraint to ensure endMonth is after startMonth when set
-- This prevents invalid recurring templates where end date is before start date

ALTER TABLE "RecurringTemplate"
ADD CONSTRAINT "check_end_after_start"
CHECK ("endMonth" IS NULL OR "endMonth" >= "startMonth");
