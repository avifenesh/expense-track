-- Add activeAccountId field to User model
-- This stores the user's currently selected account for cross-device sync
ALTER TABLE "User" ADD COLUMN "activeAccountId" TEXT;
