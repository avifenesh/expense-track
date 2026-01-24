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
  type Transaction,
} from '../../stores';
import {
  MonthSelector,
  TransactionListItem,
  BudgetProgressCard,
  SyncStatusBadge,
} from '../../components';
import { getMonthKey } from '../../utils/date';
import { formatCurrency } from '../../utils/format';
import type { Currency } from '../../types';

const RECENT_TRANSACTIONS_LIMIT = 5;

export function DashboardScreen({ navigation }: MainTabScreenProps<'Dashboard'>) {
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Select only STATE values, not functions, to prevent re-render loops
  // Functions are accessed via getState() within callbacks to avoid subscription issues
  const accounts = useAccountsStore((state) => state.accounts);
  const activeAccountId = useAccountsStore((state) => state.activeAccountId);
  const accountsLoading = useAccountsStore((state) => state.isLoading);
  const accountsError = useAccountsStore((state) => state.error);

  const transactions = useTransactionsStore((state) => state.transactions);
  const transactionsLoading = useTransactionsStore((state) => state.isLoading);
  const transactionsError = useTransactionsStore((state) => state.error);

  const budgets = useBudgetsStore((state) => state.budgets);
  const budgetsLoading = useBudgetsStore((state) => state.isLoading);
  const budgetsError = useBudgetsStore((state) => state.error);

  const selectedAccount = accounts.find((a) => a.id === activeAccountId);
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

  // Initial load - fetch accounts (runs once on mount)
  // Access store actions via getState() to avoid subscription issues
  useEffect(() => {
    useAccountsStore.getState().fetchAccounts();
  }, []);

  // When account or month changes, update filters and fetch data
  // Access store actions via getState() to avoid subscription issues
  useEffect(() => {
    if (activeAccountId) {
      const transactionsStore = useTransactionsStore.getState();
      const budgetsStore = useBudgetsStore.getState();

      transactionsStore.setFilters({ accountId: activeAccountId, month: selectedMonth });
      budgetsStore.setFilters({ accountId: activeAccountId });
      budgetsStore.setSelectedMonth(selectedMonth);
      transactionsStore.fetchTransactions();
      budgetsStore.fetchBudgets();
    }
  }, [activeAccountId, selectedMonth]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await useAccountsStore.getState().fetchAccounts();
    if (activeAccountId) {
      await Promise.all([
        useTransactionsStore.getState().fetchTransactions(),
        useBudgetsStore.getState().fetchBudgets(),
      ]);
    }
    setIsRefreshing(false);
  }, [activeAccountId]);

  const handleMonthChange = useCallback((month: string) => {
    setSelectedMonth(month);
  }, []);

  const handleAddTransaction = useCallback(() => {
    navigation.navigate('CreateTransaction');
  }, [navigation]);

  const handleTransactionPress = useCallback((transaction: Transaction) => {
    navigation.navigate('EditTransaction', { transactionId: transaction.id });
  }, [navigation]);

  const isLoading =
    accountsLoading || (activeAccountId && (transactionsLoading || budgetsLoading));
  const error = accountsError || transactionsError || budgetsError;

  // Loading state (initial load only)
  if (accountsLoading && accounts.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="dashboard.loadingScreen">
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" testID="dashboard.loadingIndicator" />
          <Text style={styles.loadingText} testID="dashboard.loadingText">Loading your finances...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !isRefreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="dashboard.errorScreen">
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle} testID="dashboard.errorTitle">Something went wrong</Text>
          <Text style={styles.errorText} testID="dashboard.errorText">{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh} testID="dashboard.retryButton">
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // No accounts state
  if (!activeAccountId && accounts.length === 0 && !accountsLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="dashboard.emptyScreen">
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle} testID="dashboard.emptyTitle">No Accounts Found</Text>
          <Text style={styles.emptyText} testID="dashboard.emptyText">
            Create an account to start tracking your finances.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="dashboard.screen">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        testID="dashboard.scrollView"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#38bdf8"
            colors={['#38bdf8']}
            testID="dashboard.refreshControl"
          />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title} testID="dashboard.title">Dashboard</Text>
            <Text style={styles.subtitle} testID="dashboard.subtitle">Your financial overview</Text>
          </View>
          <SyncStatusBadge testID="dashboard.syncStatusBadge" />
        </View>

        <MonthSelector
          selectedMonth={selectedMonth}
          onMonthChange={handleMonthChange}
          disabled={!!isLoading}
          testID="dashboard.monthSelector"
        />

        <BudgetProgressCard
          totalPlanned={totalBudget}
          totalSpent={totalExpenses}
          currency={currency}
          testID="dashboard.budgetProgressCard"
        />

        <View style={styles.statsRow} testID="dashboard.statsRow">
          <View style={[styles.statCard, styles.incomeCard]} testID="dashboard.incomeCard">
            <Text style={styles.statLabel} testID="dashboard.incomeLabel">Income</Text>
            <Text style={[styles.statAmount, styles.incomeAmount]} testID="dashboard.incomeAmount">
              +{formatCurrency(totalIncome, currency)}
            </Text>
          </View>
          <View style={[styles.statCard, styles.expenseCard]} testID="dashboard.expenseCard">
            <Text style={styles.statLabel} testID="dashboard.expenseLabel">Expenses</Text>
            <Text style={[styles.statAmount, styles.expenseAmount]} testID="dashboard.expenseAmount">
              -{formatCurrency(totalExpenses, currency)}
            </Text>
          </View>
        </View>

        <View style={styles.section} testID="dashboard.recentTransactionsSection">
          <Text style={styles.sectionTitle} testID="dashboard.recentTransactionsTitle">Recent Transactions</Text>
          {transactionsLoading && transactions.length === 0 ? (
            <View style={styles.loadingContainer} testID="dashboard.transactionsLoading">
              <ActivityIndicator size="small" color="#38bdf8" />
            </View>
          ) : recentTransactions.length === 0 ? (
            <View style={styles.emptyContainer} testID="dashboard.transactionsEmpty">
              <Text style={styles.emptyText}>No transactions this month</Text>
            </View>
          ) : (
            <View testID="dashboard.transactionsList">
              {recentTransactions.map((transaction, index) => (
                <TransactionListItem
                  key={transaction.id}
                  transaction={transaction}
                  onPress={handleTransactionPress}
                  testID={`dashboard.transaction.${index}`}
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
        testID="dashboard.addTransactionFab"
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
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
