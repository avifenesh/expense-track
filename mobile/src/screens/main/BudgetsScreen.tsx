import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MainTabScreenProps } from '../../navigation/types';
import {
  useAccountsStore,
  useTransactionsStore,
  useBudgetsStore,
  useCategoriesStore,
} from '../../stores';
import {
  MonthSelector,
  BudgetProgressCard,
  BudgetCategoryCard,
  EmptyState,
} from '../../components';
import { getMonthKey } from '../../utils/date';
import type { Currency } from '../../types';

export function BudgetsScreen(_props: MainTabScreenProps<'Budgets'>) {
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

  const {
    categories,
    isLoading: categoriesLoading,
    error: categoriesError,
    fetchCategories,
  } = useCategoriesStore();

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const currency: Currency = selectedAccount?.preferredCurrency || 'USD';

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    transactions
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        const current = map.get(t.categoryId) || 0;
        map.set(t.categoryId, current + parseFloat(t.amount));
      });
    return map;
  }, [transactions]);

  const totalPlanned = useMemo(
    () => budgets.reduce((sum, b) => sum + parseFloat(b.planned), 0),
    [budgets]
  );

  const totalSpent = useMemo(() => {
    const budgetedCategoryIds = new Set(budgets.map((b) => b.categoryId));
    let sum = 0;
    spentByCategory.forEach((spent, categoryId) => {
      if (budgetedCategoryIds.has(categoryId)) {
        sum += spent;
      }
    });
    return sum;
  }, [budgets, spentByCategory]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, typeof categories[0]>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (selectedAccountId) {
      setTransactionFilters({ accountId: selectedAccountId, month: selectedMonth });
      setBudgetFilters({ accountId: selectedAccountId });
      setBudgetSelectedMonth(selectedMonth);

      fetchCategories('EXPENSE');
      fetchBudgets();
      fetchTransactions();
    }
  }, [
    selectedAccountId,
    selectedMonth,
    setTransactionFilters,
    setBudgetFilters,
    setBudgetSelectedMonth,
    fetchCategories,
    fetchBudgets,
    fetchTransactions,
  ]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAccounts();
    if (selectedAccountId) {
      await Promise.all([
        fetchCategories('EXPENSE'),
        fetchBudgets(),
        fetchTransactions(),
      ]);
    }
    setIsRefreshing(false);
  }, [fetchAccounts, fetchCategories, fetchBudgets, fetchTransactions, selectedAccountId]);

  const handleMonthChange = useCallback((month: string) => {
    setSelectedMonth(month);
  }, []);

  const isLoading =
    accountsLoading ||
    (selectedAccountId && (transactionsLoading || budgetsLoading || categoriesLoading));
  const error = accountsError || transactionsError || budgetsError || categoriesError;

  // Loading state (initial load only)
  if (accountsLoading && accounts.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Loading budgets...</Text>
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
            Create an account to start tracking your budgets.
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
        <Text style={styles.title}>Budgets</Text>
        <Text style={styles.subtitle}>Track your spending by category</Text>

        <MonthSelector
          selectedMonth={selectedMonth}
          onMonthChange={handleMonthChange}
          disabled={!!isLoading}
        />

        <BudgetProgressCard
          totalPlanned={totalPlanned}
          totalSpent={totalSpent}
          currency={currency}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Budgets</Text>
          {budgetsLoading && budgets.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#38bdf8" />
            </View>
          ) : budgets.length === 0 ? (
            <EmptyState
              title="No budgets set"
              message="Set up budgets to track your spending by category."
              style={styles.emptyState}
            />
          ) : (
            <View>
              {budgets.map((budget) => {
                const category = categoryMap.get(budget.categoryId) || budget.category;
                const spent = spentByCategory.get(budget.categoryId) || 0;
                return (
                  <BudgetCategoryCard
                    key={budget.id}
                    categoryName={category?.name || 'Unknown'}
                    categoryColor={category?.color || '#64748b'}
                    planned={parseFloat(budget.planned)}
                    spent={spent}
                    currency={currency}
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
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
  emptyState: {
    paddingVertical: 32,
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
});
