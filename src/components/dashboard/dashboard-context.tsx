'use client'

import { createContext, useContext, ReactNode } from 'react'
import { Currency } from '@prisma/client'

type Account = {
  id: string
  name: string
}

type Category = {
  id: string
  name: string
  isArchived: boolean
}

export interface DashboardContextValue {
  activeAccount: string
  setActiveAccount: (accountId: string) => void
  monthKey: string
  preferredCurrency: Currency
  accounts: Account[]
  categories: Category[]
  csrfToken: string
  refreshData: () => void
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext)
  if (!ctx) {
    throw new Error('useDashboard must be used within a DashboardProvider')
  }
  return ctx
}

export function useDashboardOptional(): DashboardContextValue | null {
  return useContext(DashboardContext)
}

type DashboardProviderProps = {
  children: ReactNode
  value: DashboardContextValue
}

export function DashboardProvider({ children, value }: DashboardProviderProps) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}
