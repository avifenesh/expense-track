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
  type Category,
} from '../../stores';
import {
  MonthSelector,
  BudgetProgressCard,
  BudgetCategoryCard,
  EmptyState,
} from '../../components';
import { getMonthKey } from '../../utils/date';
import type { Currency } from '../../types';

export function BudgetsScreen({ navigation }: MainTabScreenProps<'Budgets'>) {
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    accounts,
    activeAccountId,
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

  const selectedAccount = accounts.find((a) => a.id === activeAccountId);
  const currency: Currency = selectedAccount?.preferredCurrency || 'USD';

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    transactions
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        const current = map.get(t.categoryId) || 0;
        map.set(t.categoryId, current + (parseFloat(t.amount) || 0));
      });
    return map;
  }, [transactions]);

  const totalPlanned = useMemo(
    () => budgets.reduce((sum, b) => sum + (parseFloat(b.planned) || 0), 0),
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
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (activeAccountId) {
      setTransactionFilters({ accountId: activeAccountId, month: selectedMonth });
      setBudgetFilters({ accountId: activeAccountId });
      setBudgetSelectedMonth(selectedMonth);

      fetchCategories('EXPENSE');
      fetchBudgets();
      fetchTransactions();
    }
  }, [
    activeAccountId,
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
    const currentAccountId = useAccountsStore.getState().activeAccountId;

    if (currentAccountId) {
      setTransactionFilters({ accountId: currentAccountId, month: selectedMonth });
      setBudgetFilters({ accountId: currentAccountId });
      setBudgetSelectedMonth(selectedMonth);

      await Promise.all([
        fetchCategories('EXPENSE'),
        fetchBudgets(),
        fetchTransactions(),
      ]);
    }
    setIsRefreshing(false);
  }, [
    fetchAccounts,
    fetchCategories,
    fetchBudgets,
    fetchTransactions,
    selectedMonth,
    setTransactionFilters,
    setBudgetFilters,
    setBudgetSelectedMonth,
  ]);

  const handleMonthChange = useCallback((month: string) => {
    setSelectedMonth(month);
  }, []);

  const handleAddBudget = useCallback(() => {
    navigation.navigate('CreateBudget', { initialMonth: selectedMonth });
  }, [navigation, selectedMonth]);

  const isLoading =
    accountsLoading ||
    (activeAccountId && (transactionsLoading || budgetsLoading || categoriesLoading));
  const error = accountsError || transactionsError || budgetsError || categoriesError;

  if (accountsLoading && accounts.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="budgets.loadingScreen">
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" testID="budgets.loadingIndicator" />
          <Text style={styles.loadingText}>Loading budgets...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !isRefreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="budgets.errorScreen">
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle} testID="budgets.errorTitle">Something went wrong</Text>
          <Text style={styles.errorText} testID="budgets.errorText">{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh} testID="budgets.retryButton">
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // No accounts state
  if (!activeAccountId && accounts.length === 0 && !accountsLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="budgets.noAccountsScreen">
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
    <SafeAreaView style={styles.container} edges={['top']} testID="budgets.screen">
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
        testID="budgets.scrollView"
      >
        <Text style={styles.title} testID="budgets.title">Budgets</Text>
        <Text style={styles.subtitle} testID="budgets.subtitle">Track your spending by category</Text>

        <MonthSelector
          selectedMonth={selectedMonth}
          onMonthChange={handleMonthChange}
          disabled={!!isLoading}
          testID="budgets.monthSelector"
        />

        <BudgetProgressCard
          totalPlanned={totalPlanned}
          totalSpent={totalSpent}
          currency={currency}
          testID="budgets.progressCard"
        />

        <View style={styles.section} testID="budgets.categorySection">
          <Text style={styles.sectionTitle} testID="budgets.categoryTitle">Category Budgets</Text>
          {budgetsLoading && budgets.length === 0 ? (
            <View style={styles.loadingContainer} testID="budgets.categoryLoading">
              <ActivityIndicator size="small" color="#38bdf8" />
            </View>
          ) : budgets.length === 0 ? (
            <EmptyState
              title="No budgets set"
              message="Set up budgets to track your spending by category."
              style={styles.emptyState}
              testID="budgets.emptyState"
            />
          ) : (
            <View testID="budgets.categoryList">
              {budgets.map((budget, index) => {
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
                    testID={`budgets.categoryCard.${index}`}
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={handleAddBudget}
        accessibilityRole="button"
        accessibilityLabel="Add budget"
        testID="budgets.addButton"
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: '#0f172a',
    fontWeight: '600',
  },
});
