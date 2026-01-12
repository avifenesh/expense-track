import type { DashboardAccount, SelectOption } from '@/components/dashboard/tabs/types'

export function createAccountOptions(accounts: DashboardAccount[]): SelectOption[] {
  return accounts.map((account) => ({ label: account.name, value: account.id }))
}
