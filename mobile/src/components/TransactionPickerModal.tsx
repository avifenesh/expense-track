import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTransactionsStore, useSharingStore, useAccountsStore } from '../stores';
import type { Transaction } from '../stores/transactionsStore';
import { formatCurrency } from '../utils/format';
import type { Currency } from '../types';

interface TransactionPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (transactionId: string) => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TransactionPickerModal({
  visible,
  onClose,
  onSelect,
}: TransactionPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const { transactions, isLoading } = useTransactionsStore();
  const { sharedByMe } = useSharingStore();
  const { accounts, activeAccountId } = useAccountsStore();

  const selectedAccount = accounts.find((a) => a.id === activeAccountId);
  const currency: Currency = selectedAccount?.preferredCurrency || 'USD';

  // Get IDs of transactions that are already shared
  const sharedTransactionIds = useMemo(() => {
    return new Set(sharedByMe.map((expense) => expense.transactionId));
  }, [sharedByMe]);

  // Filter transactions: EXPENSE type only, not already shared
  const availableTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Only expenses can be shared
      if (t.type !== 'EXPENSE') {
        return false;
      }

      // Exclude already shared transactions
      if (sharedTransactionIds.has(t.id)) {
        return false;
      }

      // Apply search filter if present
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesDescription = t.description?.toLowerCase().includes(query);
        const matchesCategory = t.category.name.toLowerCase().includes(query);
        const matchesAmount = t.amount.includes(query);

        return matchesDescription || matchesCategory || matchesAmount;
      }

      return true;
    });
  }, [transactions, sharedTransactionIds, searchQuery]);

  const handleSelect = useCallback(
    (transaction: Transaction) => {
      onSelect(transaction.id);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleClose = useCallback(() => {
    setSearchQuery('');
    onClose();
  }, [onClose]);

  const renderTransaction = useCallback(
    ({ item }: { item: Transaction }) => {
      const amount = parseFloat(item.amount);

      return (
        <Pressable
          style={styles.transactionItem}
          onPress={() => handleSelect(item)}
          accessibilityRole="button"
          accessibilityLabel={`Select ${item.description || item.category.name} for ${formatCurrency(amount, currency)}`}
          testID={`transaction-item-${item.id}`}
        >
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDescription} numberOfLines={1}>
              {item.description || item.category.name}
            </Text>
            <View style={styles.transactionMeta}>
              <Text style={styles.transactionCategory}>{item.category.name}</Text>
              <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
            </View>
          </View>
          <Text style={styles.transactionAmount}>
            {formatCurrency(amount, currency)}
          </Text>
        </Pressable>
      );
    },
    [handleSelect, currency]
  );

  const renderEmptyState = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.emptyText}>Loading transactions...</Text>
        </View>
      );
    }

    if (searchQuery.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No matches found</Text>
          <Text style={styles.emptyText}>
            Try adjusting your search query
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No expenses to share</Text>
        <Text style={styles.emptyText}>
          All your expenses have already been shared, or you have no expense transactions yet.
        </Text>
      </View>
    );
  }, [isLoading, searchQuery]);

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.title}>Select Transaction</Text>
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID="close-modal-button"
          >
            <Text style={styles.closeButtonText}>Cancel</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by description, category, or amount"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Search transactions"
            testID="search-input"
          />
        </View>

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Only expense transactions that haven't been shared are shown
          </Text>
        </View>

        {/* Transaction List */}
        <FlatList
          data={availableTransactions}
          renderItem={renderTransaction}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      </SafeAreaView>
    </Modal>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerSpacer: {
    width: 60,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    paddingVertical: 8,
    paddingLeft: 16,
  },
  closeButtonText: {
    color: '#38bdf8',
    fontSize: 16,
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
  },
  infoBanner: {
    backgroundColor: 'rgba(56,189,248,0.1)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56,189,248,0.2)',
  },
  infoBannerText: {
    fontSize: 12,
    color: '#38bdf8',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  transactionInfo: {
    flex: 1,
    marginRight: 12,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transactionCategory: {
    fontSize: 13,
    color: '#94a3b8',
  },
  transactionDate: {
    fontSize: 13,
    color: '#64748b',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
});
