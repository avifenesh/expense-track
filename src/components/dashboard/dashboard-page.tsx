'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Currency } from '@prisma/client'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarRange,
  ChevronDown,
  CreditCard,
  Download,
  FileSpreadsheet,
  Gauge,
  Layers,
  LogOut,
  PiggyBank,
  RefreshCcw,
  Repeat,
  Scale,
  Settings,
  Sparkles,
  Tags,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { logoutAction, persistActiveAccountAction, refreshExchangeRatesAction } from '@/app/actions'
import { BalanceForm } from '@/components/dashboard/balance-form'
import { Sparkline } from '@/components/dashboard/sparkline'
import { StatBreakdownPanel } from '@/components/dashboard/stat-breakdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardData } from '@/lib/finance'
import { formatCurrency, formatRelativeAmount } from '@/utils/format'
import { formatMonthLabel, shiftMonth } from '@/utils/date'
import { cn } from '@/utils/cn'
import { useCsrfToken } from '@/hooks/useCsrfToken'
import { ChatWidget } from '@/components/ai/chat-widget'
import {
  BudgetsTab,
  CategoriesTab,
  OverviewTab,
  RecurringTab,
  TransactionsTab,
  SharingTab,
} from '@/components/dashboard/tabs'
import { SubscriptionBanner, type SubscriptionBannerData } from '@/components/subscription'
import { DeleteAccountDialog } from '@/components/settings/delete-account-dialog'
import { ExportDataDialog } from '@/components/settings/export-data-dialog'

type Feedback = { type: 'success' | 'error'; message: string }
type TabValue = 'overview' | 'budgets' | 'transactions' | 'recurring' | 'categories' | 'holdings' | 'sharing'

type DashboardPageProps = {
  data: DashboardData
  monthKey: string
  accountId: string
  subscription: SubscriptionBannerData | null
  userEmail: string
}

const HoldingsTab = dynamic(() => import('./holdings-tab'), {
  ssr: false,
  loading: () => <HoldingsFallback />,
})

function HoldingsFallback() {
  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <Card className="border-white/15 bg-white/10 h-fit">
        <CardHeader className="gap-1">
          <CardTitle className="text-lg font-semibold text-white">Loading holdings…</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 animate-pulse rounded-xl bg-white/5" />
        </CardContent>
      </Card>
      <Card className="border-white/15 bg-white/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Preparing data…</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
        </CardContent>
      </Card>
    </div>
  )
}

const TABS: Array<{
  value: TabValue
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { value: 'overview', label: 'Overview', icon: Gauge },
  { value: 'transactions', label: 'Transactions', icon: CreditCard },
  { value: 'budgets', label: 'Budgets', icon: FileSpreadsheet },
  { value: 'recurring', label: 'Auto-repeat', icon: Repeat },
  { value: 'categories', label: 'Labels', icon: Tags },
  { value: 'holdings', label: 'Investments', icon: TrendingUp },
  { value: 'sharing', label: 'Sharing', icon: Users },
]

const STAT_VARIANT_STYLES: Record<
  NonNullable<DashboardData['stats'][number]['variant']>,
  {
    border: string
    chip: string
    chipText: string
    icon: string
  }
> = {
  positive: {
    border: 'border-emerald-400/40',
    chip: 'bg-emerald-400/20',
    chipText: 'text-emerald-200',
    icon: 'text-emerald-200',
  },
  negative: {
    border: 'border-rose-400/40',
    chip: 'bg-rose-400/20',
    chipText: 'text-rose-200',
    icon: 'text-rose-200',
  },
  neutral: {
    border: 'border-white/15',
    chip: 'bg-white/15',
    chipText: 'text-slate-200',
    icon: 'text-slate-200',
  },
}

function resolveStatIcon(label: string) {
  const normalized = label.toLowerCase()
  if (normalized.includes('net') || normalized.includes('saved') || normalized.includes('income') || normalized.includes('inflow')) {
    return Wallet
  }
  if (normalized.includes('spend') || normalized.includes('expense') || normalized.includes('outflow')) {
    return PiggyBank
  }
  if (normalized.includes('target') || normalized.includes('goal') || normalized.includes('budget') || normalized.includes('track')) {
    return Layers
  }
  return TrendingUp
}

export function DashboardPage({ data, monthKey, accountId, subscription, userEmail }: DashboardPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const csrfToken = useCsrfToken()

  // Get user's preferred currency for formatting
  const preferredCurrency = data.preferredCurrency || Currency.USD

  const initialAccountId = accountId ?? data.accounts[0]?.id ?? ''
  const [activeAccount, setActiveAccount] = useState<string>(initialAccountId)
  const [accountFeedback, setAccountFeedback] = useState<Feedback | null>(null)
  const [showBalanceForm, setShowBalanceForm] = useState(false)
  const [activeTab, setActiveTab] = useState<TabValue>('overview')
  const [expandedStat, setExpandedStat] = useState<string | null>(null)

  const [, startPersistAccount] = useTransition()
  const [isPendingLogout, startLogout] = useTransition()
  const [isPendingRates, startRates] = useTransition()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number }>({})

  // Refs for settings menu keyboard navigation and positioning
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const settingsMenuRef = useRef<HTMLDivElement>(null)

  // Calculate menu position to keep it in viewport
  const calculateMenuPosition = useCallback(() => {
    if (!settingsButtonRef.current || !settingsMenuRef.current) return

    const buttonRect = settingsButtonRef.current.getBoundingClientRect()
    const menuHeight = settingsMenuRef.current.offsetHeight
    const viewportHeight = window.innerHeight
    const padding = 8

    // If menu would overflow bottom, position above button
    if (buttonRect.bottom + menuHeight + padding > viewportHeight) {
      setMenuPosition({ bottom: viewportHeight - buttonRect.top + padding })
    } else {
      setMenuPosition({ top: buttonRect.bottom + padding })
    }
  }, [])

  // Settings menu keyboard navigation with arrow keys and focus trap
  const handleMenuKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Get only enabled menu items (skip disabled ones)
      const menuItems = settingsMenuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])')
      if (!menuItems || menuItems.length === 0) return

      const itemCount = menuItems.length

      // Find current index among enabled items
      const currentEnabledIndex = Array.from(menuItems).findIndex(
        (item) => item === document.activeElement,
      )

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          {
            const nextIndex = currentEnabledIndex < 0 ? 0 : (currentEnabledIndex + 1) % itemCount
            ;(menuItems[nextIndex] as HTMLElement)?.focus()
          }
          break
        case 'ArrowUp':
          event.preventDefault()
          {
            const prevIndex =
              currentEnabledIndex < 0 ? itemCount - 1 : (currentEnabledIndex - 1 + itemCount) % itemCount
            ;(menuItems[prevIndex] as HTMLElement)?.focus()
          }
          break
        case 'Escape':
          event.preventDefault()
          setShowSettingsMenu(false)
          settingsButtonRef.current?.focus()
          break
        case 'Tab':
          // Close menu on Tab to prevent double focus movement
          event.preventDefault()
          setShowSettingsMenu(false)
          settingsButtonRef.current?.focus()
          break
        case 'Home':
          event.preventDefault()
          ;(menuItems[0] as HTMLElement)?.focus()
          break
        case 'End':
          event.preventDefault()
          ;(menuItems[itemCount - 1] as HTMLElement)?.focus()
          break
      }
    },
    [],
  )

  // Focus management and position calculation when menu opens
  useEffect(() => {
    if (!showSettingsMenu) return

    // Use requestAnimationFrame to ensure the menu is rendered before measuring
    const rafId = requestAnimationFrame(() => {
      calculateMenuPosition()
      // Focus first menu item when menu opens
      const firstItem = settingsMenuRef.current?.querySelector('[role="menuitem"]') as HTMLElement | null
      firstItem?.focus()
    })

    document.addEventListener('keydown', handleMenuKeyDown)

    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener('keydown', handleMenuKeyDown)
    }
  }, [showSettingsMenu, calculateMenuPosition, handleMenuKeyDown])

  const accountsOptions = useMemo(
    () => data.accounts.map((account) => ({ label: account.name, value: account.id })),
    [data.accounts],
  )

  useEffect(() => {
    if (!accountId) return
    setActiveAccount(accountId)
  }, [accountId])

  useEffect(() => {
    if (!accountFeedback) return
    const timer = window.setTimeout(() => setAccountFeedback(null), 4000)
    return () => window.clearTimeout(timer)
  }, [accountFeedback])

  const historyWithLabels = useMemo(
    () =>
      data.history.map((point) => ({
        ...point,
        label: formatMonthLabel(point.month),
      })),
    [data.history],
  )

  const { netHistory, latestHistory, netDelta, netStat } = useMemo(() => {
    const history = historyWithLabels.map((point) => point.net)
    const latest = historyWithLabels.at(-1)
    const previous = historyWithLabels.at(-2)
    const delta = latest && previous ? latest.net - previous.net : 0
    const stat = data.stats.find((s) => s.label.toLowerCase().includes('net'))
    return { netHistory: history, latestHistory: latest, netDelta: delta, netStat: stat }
  }, [historyWithLabels, data.stats])

  const handleParamUpdate = (key: string, value?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const handleMonthChange = (direction: number) => {
    const nextKey = shiftMonth(monthKey, direction)
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', nextKey)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const handleAccountSelect = (value: string) => {
    setActiveAccount(value)
    handleParamUpdate('account', value)
    const accountLabel = accountsOptions.find((option) => option.value === value)?.label ?? 'Account'
    startPersistAccount(async () => {
      const result = await persistActiveAccountAction({ accountId: value, csrfToken })
      if ('error' in result && result.error) {
        const firstErrorSet = Object.values(result.error)[0]
        const message: string =
          Array.isArray(firstErrorSet) && firstErrorSet.length > 0
            ? (firstErrorSet[0] ?? 'Unable to remember selection.')
            : 'Unable to remember selection.'
        setAccountFeedback({ type: 'error', message })
        return
      }
      setAccountFeedback({ type: 'success', message: `${accountLabel} will open by default next time.` })
    })
  }

  const handleLogout = () => {
    startLogout(async () => {
      await logoutAction()
      router.push('/login')
      router.refresh()
    })
  }

  const handleRefreshRates = () => {
    startRates(async () => {
      await refreshExchangeRatesAction({ csrfToken })
      router.refresh()
    })
  }

  const netDeltaVariant = netDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pt-14 lg:gap-6 lg:px-6 lg:pt-16">
      {/* Subscription banner */}
      {subscription && (
        <SubscriptionBanner
          subscription={subscription}
          onUpgrade={() => {
            window.open('/upgrade', '_blank')
          }}
        />
      )}

      {/* Floating top bar */}
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-slate-900/95 px-4 py-2.5 backdrop-blur-md lg:px-6 lg:py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          {/* Tab navigation */}
          <div role="tablist" aria-label="Dashboard sections" className="flex items-center gap-1 overflow-x-auto">
            {TABS.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                role="tab"
                id={`tab-${value}`}
                aria-selected={activeTab === value}
                aria-controls={`panel-${value}`}
                className={cn(
                  'h-9 gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition',
                  activeTab === value ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
                )}
                onClick={() => setActiveTab(value)}
                title={label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
            <div className="mx-1 h-5 w-px bg-white/20" />
            <Button
              type="button"
              variant="ghost"
              className="h-9 gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setShowBalanceForm((prev) => !prev)}
              title="Set balance"
            >
              <Scale className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Balance</span>
            </Button>
          </div>

          {/* Right side actions - Settings dropdown */}
          <div className="relative">
            <Button
              ref={settingsButtonRef}
              type="button"
              variant="ghost"
              className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setShowSettingsMenu((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={showSettingsMenu}
              aria-controls="settings-menu"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Account</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
            {showSettingsMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSettingsMenu(false)}
                  aria-hidden="true"
                />
                <div
                  ref={settingsMenuRef}
                  id="settings-menu"
                  role="menu"
                  aria-label="Account settings"
                  className="fixed right-4 z-50 w-48 rounded-lg border border-white/20 bg-slate-900 py-1 shadow-xl"
                  style={menuPosition.bottom ? { bottom: menuPosition.bottom } : { top: menuPosition.top }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                    onClick={() => {
                      setShowSettingsMenu(false)
                      setShowExportDialog(true)
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Export my data
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                    onClick={() => {
                      setShowSettingsMenu(false)
                      handleLogout()
                    }}
                    disabled={isPendingLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    {isPendingLogout ? 'Signing out...' : 'Sign out'}
                  </button>
                  <div className="my-1 h-px bg-white/10" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-400 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:outline-none"
                    onClick={() => {
                      setShowSettingsMenu(false)
                      setShowDeleteDialog(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete account
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-xl lg:p-6">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_transparent_55%)]"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Month selector */}
              <div className="inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-white/10 px-1.5 py-0.5 backdrop-blur">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-6 w-6 rounded-full text-white/90 transition hover:bg-white/20"
                  onClick={() => handleMonthChange(-1)}
                >
                  <ArrowLeft className="h-3 w-3" />
                </Button>
                <div className="flex items-center gap-1 px-1.5 text-xs font-medium text-white">
                  <CalendarRange className="h-3 w-3" />
                  {formatMonthLabel(monthKey)}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-6 w-6 rounded-full text-white/90 transition hover:bg-white/20"
                  onClick={() => handleMonthChange(1)}
                >
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Financial clarity
              </span>
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Balance Beacon</h1>
              <p className="text-sm leading-relaxed text-slate-200/80">
                Track personal spending and shared plans with insights that highlight what changed and where to focus
                your next dollar.
              </p>
            </div>
            {netStat && (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                <TrendingUp className="h-3.5 w-3.5" />
                {formatRelativeAmount(netStat.amount)} net flow
              </span>
            )}
          </div>

          <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl bg-white/10 p-5 backdrop-blur lg:max-w-sm">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-200/80">
              <span>Cashflow snapshot</span>
              <RefreshCcw className="h-4 w-4 opacity-70" />
            </div>
            <div className="h-28 w-full">
              <Sparkline
                values={netHistory}
                strokeClassName="stroke-white"
                fillClassName="fill-white/15"
                ariaLabel="Net cashflow snapshot"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-100/80">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-200/70">Income this month</p>
                <p className="text-lg font-semibold text-white">
                  {formatCurrency(latestHistory?.income ?? 0, preferredCurrency)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-200/70">Spending this month</p>
                <p className="text-lg font-semibold text-white">
                  {formatCurrency(latestHistory?.expense ?? 0, preferredCurrency)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-200/70">Change vs last month</p>
                <p className={cn('text-lg font-semibold', netDeltaVariant)}>
                  {formatRelativeAmount(netDelta, preferredCurrency)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Compact stat cards at the bottom of header */}
        <div className="relative z-10 mt-5 grid grid-cols-1 gap-2 min-[375px]:grid-cols-2 md:grid-cols-4">
          {data.stats.map((stat) => {
            const variantKey = stat.variant ?? 'neutral'
            const styles = STAT_VARIANT_STYLES[variantKey]
            const Icon = resolveStatIcon(stat.label)
            const isExpanded = expandedStat === stat.label
            const hasBreakdown = !!stat.breakdown
            return (
              <button
                key={stat.label}
                type="button"
                onClick={() => hasBreakdown && setExpandedStat(isExpanded ? null : stat.label)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border bg-white/5 px-3 py-2 backdrop-blur transition text-left',
                  hasBreakdown && 'cursor-pointer hover:bg-white/10',
                  !hasBreakdown && 'cursor-default',
                  styles.border,
                  isExpanded && 'ring-1 ring-white/30',
                )}
                aria-expanded={hasBreakdown ? isExpanded : undefined}
              >
                <span className={cn('inline-flex shrink-0 items-center justify-center rounded-lg p-1.5', styles.chip)}>
                  <Icon className={cn('h-3.5 w-3.5', styles.icon)} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-300">
                    {stat.label}
                  </p>
                  <p className="truncate text-sm font-semibold text-white">
                    {formatCurrency(stat.amount, preferredCurrency)}
                  </p>
                </div>
                {hasBreakdown && (
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform',
                      isExpanded && 'rotate-180',
                    )}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Stat breakdown panel */}
        {expandedStat &&
          (() => {
            const stat = data.stats.find((s) => s.label === expandedStat)
            if (!stat?.breakdown) return null

            return (
              <div className="relative z-10 mt-2 rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
                    {expandedStat} breakdown
                  </p>
                  <button
                    type="button"
                    onClick={() => setExpandedStat(null)}
                    className="text-xs text-slate-400 hover:text-white transition"
                    aria-label="Close breakdown"
                  >
                    Close
                  </button>
                </div>
                <StatBreakdownPanel breakdown={stat.breakdown} currency={preferredCurrency} />
              </div>
            )
          })()}

        {/* Exchange rate refresh - compact */}
        {data.exchangeRateLastUpdate && (
          <div className="relative z-10 mt-3 flex items-center justify-end gap-2 text-xs text-slate-400">
            <span>
              Rates:{' '}
              {new Date(data.exchangeRateLastUpdate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <Button
              type="button"
              variant="ghost"
              className="h-6 px-2 text-xs text-slate-300 hover:bg-white/10"
              onClick={handleRefreshRates}
              disabled={isPendingRates}
              title="Refresh exchange rates"
            >
              <RefreshCcw className={cn('h-3 w-3', isPendingRates && 'animate-spin')} />
            </Button>
          </div>
        )}
      </header>

      {/* Balance form - shown when Balance button clicked */}
      {showBalanceForm && (
        <BalanceForm
          activeAccount={activeAccount}
          monthKey={monthKey}
          preferredCurrency={preferredCurrency}
          currentNet={data.stats.find((s) => s.label === 'Net this month')?.amount ?? 0}
          onClose={() => setShowBalanceForm(false)}
        />
      )}

      <section className="space-y-6">
        {activeTab === 'overview' && (
          <OverviewTab
            history={data.history}
            comparison={data.comparison}
            budgets={data.budgets}
            transactionRequests={data.transactionRequests}
            activeAccount={activeAccount}
            preferredCurrency={preferredCurrency}
            onNavigateToBudgets={() => setActiveTab('budgets')}
          />
        )}

        {activeTab === 'budgets' && (
          <BudgetsTab
            budgets={data.budgets}
            accounts={data.accounts}
            categories={data.categories}
            activeAccount={activeAccount}
            monthKey={monthKey}
            preferredCurrency={preferredCurrency}
            monthlyIncomeGoal={data.monthlyIncomeGoal}
            actualIncome={data.actualIncome}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsTab
            transactions={data.transactions}
            transactionRequests={data.transactionRequests}
            accounts={data.accounts}
            categories={data.categories}
            activeAccount={activeAccount}
            monthKey={monthKey}
            preferredCurrency={preferredCurrency}
          />
        )}
        {activeTab === 'recurring' && (
          <RecurringTab
            recurringTemplates={data.recurringTemplates}
            accounts={data.accounts}
            categories={data.categories}
            activeAccount={activeAccount}
            monthKey={monthKey}
            preferredCurrency={preferredCurrency}
          />
        )}

        {activeTab === 'categories' && <CategoriesTab categories={data.categories} />}

        {/* Holdings Tab */}
        {activeTab === 'holdings' && (
          <Suspense fallback={<HoldingsFallback />}>
            <HoldingsTab
              activeAccount={activeAccount}
              accountsOptions={accountsOptions}
              categories={data.categories}
              preferredCurrency={preferredCurrency}
              onSelectAccount={handleAccountSelect}
            />
          </Suspense>
        )}

        {/* Sharing Tab */}
        {activeTab === 'sharing' && (
          <SharingTab
            sharedExpenses={data.sharedExpenses || []}
            expensesSharedWithMe={data.expensesSharedWithMe || []}
            settlementBalances={data.settlementBalances || []}
            preferredCurrency={preferredCurrency}
          />
        )}
      </section>

      {/* AI Chat Widget */}
      {process.env.NEXT_PUBLIC_AI_ENABLED !== 'false' && (
        <ChatWidget accountId={accountId} monthKey={monthKey} preferredCurrency={preferredCurrency} />
      )}

      {/* Floating scroll-to-top button */}
      <Button
        type="button"
        variant="secondary"
        className="fixed bottom-6 left-6 h-10 w-10 rounded-full shadow-lg"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        title="Scroll to top"
      >
        <ArrowUp className="h-5 w-5" />
      </Button>

      {/* Export Data Dialog */}
      {showExportDialog && <ExportDataDialog onClose={() => setShowExportDialog(false)} />}

      {/* Delete Account Dialog */}
      {showDeleteDialog && <DeleteAccountDialog userEmail={userEmail} onClose={() => setShowDeleteDialog(false)} />}
    </div>
  )
}
