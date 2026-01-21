'use client'

import { Currency } from '@prisma/client'
import { SharedExpensesList } from '@/components/dashboard/shared-expenses-list'
import { ExpensesSharedWithMe } from '@/components/dashboard/expenses-shared-with-me'
import { SettlementSummary } from '@/components/dashboard/settlement-summary'
import type {
  SharedExpenseSummary,
  ExpenseParticipationSummary,
  SettlementBalance,
  PaymentHistoryItem,
} from '@/lib/finance'

export type SharingTabProps = {
  sharedExpenses: SharedExpenseSummary[]
  expensesSharedWithMe: ExpenseParticipationSummary[]
  settlementBalances: SettlementBalance[]
  paymentHistory: PaymentHistoryItem[]
  preferredCurrency: Currency
}

export function SharingTab({
  sharedExpenses,
  expensesSharedWithMe,
  settlementBalances,
  paymentHistory,
  preferredCurrency,
}: SharingTabProps) {
  return (
    <div role="tabpanel" id="panel-sharing" aria-labelledby="tab-sharing" className="space-y-6">
      <SettlementSummary
        balances={settlementBalances}
        preferredCurrency={preferredCurrency}
        paymentHistory={paymentHistory}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <SharedExpensesList sharedExpenses={sharedExpenses} />
        <ExpensesSharedWithMe participations={expensesSharedWithMe} />
      </div>
    </div>
  )
}
