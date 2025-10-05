-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'ILS');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "preferredCurrency" "Currency";

-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "RecurringTemplate" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'USD';

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "baseCurrency" "Currency" NOT NULL,
    "targetCurrency" "Currency" NOT NULL,
    "rate" DECIMAL(12,6) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeRate_fetchedAt_idx" ON "ExchangeRate"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_baseCurrency_targetCurrency_date_key" ON "ExchangeRate"("baseCurrency", "targetCurrency", "date");
