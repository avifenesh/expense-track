-- CreateIndex
CREATE INDEX "RecurringTemplate_accountId_idx" ON "RecurringTemplate"("accountId");

-- CreateIndex
CREATE INDEX "RecurringTemplate_accountId_isActive_idx" ON "RecurringTemplate"("accountId", "isActive");
