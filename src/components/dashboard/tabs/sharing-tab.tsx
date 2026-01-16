'use client'

import { Currency } from '@prisma/client'
import { SharedExpensesList } from '@/components/dashboard/shared-expenses-list'
import { ExpensesSharedWithMe } from '@/components/dashboard/expenses-shared-with-me'
import { SettlementSummary } from '@/components/dashboard/settlement-summary'
import type { SharedExpenseSummary, ExpenseParticipationSummary, SettlementBalance } from '@/lib/finance'

export type SharingTabProps = {
  sharedExpenses: SharedExpenseSummary[]
  expensesSharedWithMe: ExpenseParticipationSummary[]
  settlementBalances: SettlementBalance[]
  preferredCurrency: Currency
}

export function SharingTab({
  sharedExpenses,
  expensesSharedWithMe,
  settlementBalances,
  preferredCurrency,
}: SharingTabProps) {
  return (
    <div role="tabpanel" id="panel-sharing" aria-labelledby="tab-sharing" className="space-y-6">
      <SettlementSummary balances={settlementBalances} preferredCurrency={preferredCurrency} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SharedExpensesList sharedExpenses={sharedExpenses} preferredCurrency={preferredCurrency} />
        <ExpensesSharedWithMe participations={expensesSharedWithMe} preferredCurrency={preferredCurrency} />
      </div>
    </div>
  )
}
