-- AlterTable
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
