import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MainTabScreenProps } from '../../navigation/types';
import {
  useTransactionsStore,
  useAccountsStore,
  type Transaction,
} from '../../stores';
import {
  TransactionListItem,
  DateSectionHeader,
  EmptyState,
  SyncStatusBadge,
} from '../../components';
import { getDateKey, formatDateHeader } from '../../utils/date';

type FilterType = 'all' | 'INCOME' | 'EXPENSE';

interface DateSection {
  title: string;
  data: Transaction[];
}

function groupTransactionsByDate(transactions: Transaction[]): DateSection[] {
  const groups = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const dateKey = getDateKey(tx.date);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(tx);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, data]) => ({
      title: formatDateHeader(dateKey),
      data,
    }));
}

export function TransactionsScreen({ navigation }: MainTabScreenProps<'Transactions'>) {
  const [filterType, setFilterType] = useState<FilterType>('all');

  // Select only STATE values, not functions, to prevent re-render loops
  // Functions are accessed via getState() within callbacks to avoid subscription issues
  const transactions = useTransactionsStore((state) => state.transactions);
  const isLoading = useTransactionsStore((state) => state.isLoading);
  const error = useTransactionsStore((state) => state.error);
  const hasMore = useTransactionsStore((state) => state.hasMore);

  const accounts = useAccountsStore((state) => state.accounts);
  const activeAccountId = useAccountsStore((state) => state.activeAccountId);
  const isLoadingAccounts = useAccountsStore((state) => state.isLoading);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initial load - fetch accounts if needed (runs once on mount)
  useEffect(() => {
    async function init() {
      if (useAccountsStore.getState().accounts.length === 0) {
        await useAccountsStore.getState().fetchAccounts();
      }
    }
    init();
  }, []);

  // When account changes, update filters and fetch transactions
  useEffect(() => {
    async function loadTransactions() {
      if (activeAccountId) {
        const store = useTransactionsStore.getState();
        store.setFilters({ accountId: activeAccountId });
        await store.fetchTransactions(true);
      }
    }
    loadTransactions();
  }, [activeAccountId]);

  const handleFilterChange = useCallback(
    async (type: FilterType) => {
      const accountId = activeAccountId || accounts[0]?.id;
      if (!accountId) {
        return;
      }
      setFilterType(type);
      const store = useTransactionsStore.getState();
      store.setFilters({
        accountId,
        type: type === 'all' ? undefined : type,
      });
      await store.fetchTransactions(true);
    },
    [activeAccountId, accounts]
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await useTransactionsStore.getState().fetchTransactions(true);
    setIsRefreshing(false);
  }, []);

  const handleEndReached = useCallback(() => {
    const store = useTransactionsStore.getState();
    if (store.hasMore && !store.isLoading) {
      store.fetchMoreTransactions();
    }
  }, []);

  const handleTransactionPress = useCallback((transaction: Transaction) => {
    navigation.navigate('EditTransaction', { transactionId: transaction.id });
  }, [navigation]);

  const handleAddTransaction = useCallback(() => {
    navigation.navigate('CreateTransaction');
  }, [navigation]);

  const sections = useMemo(() => groupTransactionsByDate(transactions), [transactions]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: DateSection }) => (
      <DateSectionHeader title={section.title} />
    ),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionListItem transaction={item} onPress={handleTransactionPress} />
    ),
    [handleTransactionPress]
  );

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  const renderFooter = useCallback(() => {
    if (!hasMore || !isLoading) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#38bdf8" />
      </View>
    );
  }, [hasMore, isLoading]);

  const renderEmpty = useCallback(() => {
    if (isLoading || isLoadingAccounts) {
      return (
        <View style={styles.centerContainer} testID="transactions.loadingState">
          <ActivityIndicator size="large" color="#38bdf8" testID="transactions.loadingIndicator" />
        </View>
      );
    }

    if (error) {
      return (
        <EmptyState
          title="Unable to load transactions"
          message={error}
          style={styles.emptyState}
          testID="transactions.errorState"
        />
      );
    }

    if (accounts.length === 0) {
      return (
        <EmptyState
          title="No accounts found"
          message="Create an account to start tracking transactions."
          style={styles.emptyState}
          testID="transactions.noAccountsState"
        />
      );
    }

    const filterMessage =
      filterType === 'INCOME'
        ? 'No income transactions found.'
        : filterType === 'EXPENSE'
          ? 'No expense transactions found.'
          : 'No transactions yet. Add your first transaction to get started.';

    return (
      <EmptyState
        title="No transactions"
        message={filterMessage}
        style={styles.emptyState}
        testID="transactions.emptyState"
      />
    );
  }, [isLoading, isLoadingAccounts, error, accounts.length, filterType]);

  const isActiveFilter = (type: FilterType) => filterType === type;

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="transactions.screen">
      <View style={styles.header} testID="transactions.header">
        <View style={styles.headerLeft}>
          <Text style={styles.title} testID="transactions.title">Transactions</Text>
          <SyncStatusBadge style={styles.syncBadge} testID="transactions.syncStatusBadge" />
        </View>
        <Pressable
          style={styles.addButton}
          onPress={handleAddTransaction}
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
          testID="transactions.addButton"
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow} testID="transactions.filterRow">
        <Pressable
          style={[styles.filterChip, isActiveFilter('all') && styles.filterChipActive]}
          onPress={() => handleFilterChange('all')}
          testID="transactions.filter.all"
        >
          <Text style={[styles.filterText, isActiveFilter('all') && styles.filterTextActive]}>
            All
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterChip, isActiveFilter('INCOME') && styles.filterChipActive]}
          onPress={() => handleFilterChange('INCOME')}
          testID="transactions.filter.income"
        >
          <Text style={[styles.filterText, isActiveFilter('INCOME') && styles.filterTextActive]}>
            Income
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterChip, isActiveFilter('EXPENSE') && styles.filterChipActive]}
          onPress={() => handleFilterChange('EXPENSE')}
          testID="transactions.filter.expense"
        >
          <Text style={[styles.filterText, isActiveFilter('EXPENSE') && styles.filterTextActive]}>
            Expenses
          </Text>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#38bdf8"
            colors={['#38bdf8']}
          />
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        testID="transactions.list"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  syncBadge: {
    marginLeft: 8,
  },
  addButton: {
    backgroundColor: '#38bdf8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  filterChipActive: {
    backgroundColor: '#38bdf8',
  },
  filterText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  filterTextActive: {
    color: '#0f172a',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyState: {
    paddingTop: 60,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
