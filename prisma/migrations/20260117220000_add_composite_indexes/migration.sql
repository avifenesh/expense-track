-- Add composite indexes for performance optimization

-- SharedExpense: composite index for owner's expenses sorted by date
CREATE INDEX IF NOT EXISTS "SharedExpense_ownerId_createdAt_idx" ON "SharedExpense"("ownerId", "createdAt");

-- RefreshToken: composite index for expired token cleanup queries
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_userId_idx" ON "RefreshToken"("expiresAt", "userId");

