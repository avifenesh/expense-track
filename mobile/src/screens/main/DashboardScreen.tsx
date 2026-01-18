import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MainTabScreenProps } from '../../navigation/types';
import {
  useAccountsStore,
  useTransactionsStore,
  useBudgetsStore,
} from '../../stores';
import {
  MonthSelector,
  TransactionListItem,
  BudgetProgressCard,
} from '../../components';
import { getMonthKey } from '../../utils/date';
import { formatCurrency } from '../../utils/format';
import type { Currency } from '../../types';

const RECENT_TRANSACTIONS_LIMIT = 5;

export function DashboardScreen({ navigation }: MainTabScreenProps<'Dashboard'>) {
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    accounts,
    selectedAccountId,
    isLoading: accountsLoading,
    error: accountsError,
    fetchAccounts,
  } = useAccountsStore();

  const {
    transactions,
    isLoading: transactionsLoading,
    error: transactionsError,
    setFilters: setTransactionFilters,
    fetchTransactions,
  } = useTransactionsStore();

  const {
    budgets,
    isLoading: budgetsLoading,
    error: budgetsError,
    setFilters: setBudgetFilters,
    setSelectedMonth: setBudgetSelectedMonth,
    fetchBudgets,
  } = useBudgetsStore();

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const currency: Currency = selectedAccount?.preferredCurrency || 'USD';

  // Calculate totals from transactions (memoized for performance)
  const totalIncome = useMemo(
    () => transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0),
    [transactions]
  );

  const totalExpenses = useMemo(
    () => transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0),
    [transactions]
  );

  const totalBudget = useMemo(
    () => budgets.reduce((sum, b) => sum + parseFloat(b.planned), 0),
    [budgets]
  );

  const recentTransactions = transactions.slice(0, RECENT_TRANSACTIONS_LIMIT);

  // Initial load - fetch accounts
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // When account or month changes, update filters and fetch data in one effect
  // This prevents race conditions between setting filters and fetching data
  useEffect(() => {
    if (selectedAccountId) {
      setTransactionFilters({ accountId: selectedAccountId, month: selectedMonth });
      setBudgetFilters({ accountId: selectedAccountId });
      setBudgetSelectedMonth(selectedMonth);
      fetchTransactions();
      fetchBudgets();
    }
  }, [
    selectedAccountId,
    selectedMonth,
    setTransactionFilters,
    setBudgetFilters,
    setBudgetSelectedMonth,
    fetchTransactions,
    fetchBudgets,
  ]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAccounts();
    if (selectedAccountId) {
      await Promise.all([fetchTransactions(), fetchBudgets()]);
    }
    setIsRefreshing(false);
  }, [fetchAccounts, fetchTransactions, fetchBudgets, selectedAccountId]);

  const handleMonthChange = useCallback((month: string) => {
    setSelectedMonth(month);
  }, []);

  const handleAddTransaction = useCallback(() => {
    navigation.navigate('CreateTransaction');
  }, [navigation]);

  const isLoading =
    accountsLoading || (selectedAccountId && (transactionsLoading || budgetsLoading));
  const error = accountsError || transactionsError || budgetsError;

  // Loading state (initial load only)
  if (accountsLoading && accounts.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Loading your finances...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !isRefreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // No accounts state
  if (!selectedAccountId && accounts.length === 0 && !accountsLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>No Accounts Found</Text>
          <Text style={styles.emptyText}>
            Create an account to start tracking your finances.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#38bdf8"
            colors={['#38bdf8']}
          />
        }
      >
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Your financial overview</Text>

        <MonthSelector
          selectedMonth={selectedMonth}
          onMonthChange={handleMonthChange}
          disabled={!!isLoading}
        />

        <BudgetProgressCard
          totalPlanned={totalBudget}
          totalSpent={totalExpenses}
          currency={currency}
        />

        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.incomeCard]}>
            <Text style={styles.statLabel}>Income</Text>
            <Text style={[styles.statAmount, styles.incomeAmount]}>
              +{formatCurrency(totalIncome, currency)}
            </Text>
          </View>
          <View style={[styles.statCard, styles.expenseCard]}>
            <Text style={styles.statLabel}>Expenses</Text>
            <Text style={[styles.statAmount, styles.expenseAmount]}>
              -{formatCurrency(totalExpenses, currency)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {transactionsLoading && transactions.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#38bdf8" />
            </View>
          ) : recentTransactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No transactions this month</Text>
            </View>
          ) : (
            <View>
              {recentTransactions.map((transaction) => (
                <TransactionListItem
                  key={transaction.id}
                  transaction={transaction}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB for adding transactions */}
      <Pressable
        style={styles.fab}
        onPress={handleAddTransaction}
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
  },
  incomeCard: {
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  expenseCard: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  statLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  statAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  incomeAmount: {
    color: '#22c55e',
  },
  expenseAmount: {
    color: '#ef4444',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 8,
  },
  errorText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 36,
  },
});
