-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerificationExpires" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerificationToken_key" ON "User"("emailVerificationToken");
