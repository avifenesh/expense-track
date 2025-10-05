-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "isMutual" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "averageCost" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockPrice" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "changePercent" DECIMAL(8,4),
    "volume" BIGINT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'alphavantage',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Holding_accountId_idx" ON "Holding"("accountId");

-- CreateIndex
CREATE INDEX "Holding_categoryId_idx" ON "Holding"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_accountId_categoryId_symbol_key" ON "Holding"("accountId", "categoryId", "symbol");

-- CreateIndex
CREATE INDEX "StockPrice_symbol_fetchedAt_idx" ON "StockPrice"("symbol", "fetchedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "StockPrice_symbol_fetchedAt_key" ON "StockPrice"("symbol", "fetchedAt");

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
