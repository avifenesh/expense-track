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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MainTabScreenProps } from '../../navigation/types';
import { useSharingStore, useTransactionsStore, useAccountsStore } from '../../stores';
import { EmptyState, TransactionPickerModal } from '../../components';
import { formatCurrency } from '../../utils/format';
import type { Currency } from '../../types';
import type {
  SharedExpense,
  SharedWithMeParticipation,
  SettlementBalance,
  ShareParticipant,
} from '../../stores/sharingStore';

function getDisplayName(user: { email: string; displayName?: string | null }): string {
  return user.displayName || user.email.split('@')[0];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

interface BalanceSummaryProps {
  balances: SettlementBalance[];
}

function BalanceSummary({ balances }: BalanceSummaryProps) {
  const totalOwed = balances.reduce((sum, b) => sum + parseFloat(b.theyOwe), 0);
  const totalOwe = balances.reduce((sum, b) => sum + parseFloat(b.youOwe), 0);
  const netBalance = totalOwed - totalOwe;

  const primaryCurrency: Currency = balances[0]?.currency || 'USD';

  const isPositive = netBalance >= 0;
  const balanceText = isPositive
    ? `+${formatCurrency(netBalance, primaryCurrency)}`
    : `-${formatCurrency(Math.abs(netBalance), primaryCurrency)}`;

  const subtext = isPositive
    ? netBalance === 0
      ? 'All settled up'
      : 'You are owed overall'
    : 'You owe overall';

  return (
    <View style={styles.balanceCard}>
      <Text style={styles.balanceLabel}>Net Balance</Text>
      <Text
        style={[
          styles.balanceAmount,
          isPositive ? styles.positiveBalance : styles.negativeBalance,
        ]}
      >
        {balanceText}
      </Text>
      <Text style={styles.balanceSubtext}>{subtext}</Text>
    </View>
  );
}

interface SharedWithMeCardProps {
  participation: SharedWithMeParticipation;
}

function SharedWithMeCard({ participation }: SharedWithMeCardProps) {
  const { sharedExpense } = participation;
  const ownerName = getDisplayName(sharedExpense.owner);
  const amount = formatCurrency(participation.shareAmount, sharedExpense.currency);
  const isPending = participation.status === 'PENDING';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {sharedExpense.description || sharedExpense.transaction.description || 'Shared expense'}
        </Text>
        <View style={[styles.statusBadge, isPending ? styles.pendingBadge : styles.paidBadge]}>
          <Text style={[styles.statusText, isPending ? styles.pendingText : styles.paidText]}>
            {participation.status}
          </Text>
        </View>
      </View>
      <Text style={styles.cardSubtitle}>
        From {ownerName} - {formatDate(sharedExpense.createdAt)}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.categoryText}>{sharedExpense.transaction.category.name}</Text>
        <Text style={[styles.amountText, styles.negativeAmount]}>You owe {amount}</Text>
      </View>
    </View>
  );
}

interface SharedByMeCardProps {
  expense: SharedExpense;
  onMarkPaid: (participantId: string) => void;
  loadingParticipantId: string | null;
}

function SharedByMeCard({ expense, onMarkPaid, loadingParticipantId }: SharedByMeCardProps) {
  const totalOwed = formatCurrency(expense.totalOwed, expense.currency);
  const pendingParticipants = expense.participants.filter((p) => p.status === 'PENDING');
  const paidParticipants = expense.participants.filter((p) => p.status === 'PAID');

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {expense.description || expense.transaction.description || 'Shared expense'}
        </Text>
        {expense.allSettled ? (
          <View style={[styles.statusBadge, styles.paidBadge]}>
            <Text style={[styles.statusText, styles.paidText]}>SETTLED</Text>
          </View>
        ) : (
          <Text style={styles.owedAmount}>{totalOwed} owed</Text>
        )}
      </View>
      <Text style={styles.cardSubtitle}>
        {expense.transaction.category.name} - {formatDate(expense.createdAt)}
      </Text>

      {pendingParticipants.length > 0 && (
        <View style={styles.participantsList}>
          {pendingParticipants.map((p) => (
            <ParticipantRow
              key={p.id}
              participant={p}
              currency={expense.currency}
              onMarkPaid={onMarkPaid}
              isLoading={loadingParticipantId === p.id}
            />
          ))}
        </View>
      )}

      {paidParticipants.length > 0 && (
        <View style={styles.participantsList}>
          {paidParticipants.map((p) => (
            <ParticipantRow key={p.id} participant={p} currency={expense.currency} isPaid />
          ))}
        </View>
      )}
    </View>
  );
}

interface ParticipantRowProps {
  participant: ShareParticipant;
  currency: Currency;
  isPaid?: boolean;
  isLoading?: boolean;
  onMarkPaid?: (participantId: string) => void;
}

function ParticipantRow({ participant, currency, isPaid, isLoading, onMarkPaid }: ParticipantRowProps) {
  const name = getDisplayName(participant.participant);
  const amount = formatCurrency(participant.shareAmount, currency);

  return (
    <View style={styles.participantRow}>
      <View style={styles.participantInfo}>
        <Text style={[styles.participantName, isPaid && styles.paidParticipant]}>{name}</Text>
        <Text style={[styles.participantAmount, isPaid && styles.paidParticipant]}>{amount}</Text>
      </View>
      {isPaid ? (
        <Text style={styles.paidLabel}>Paid</Text>
      ) : onMarkPaid ? (
        <TouchableOpacity
          style={[styles.markPaidButton, isLoading && styles.markPaidButtonDisabled]}
          onPress={() => onMarkPaid(participant.id)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#38bdf8" />
          ) : (
            <Text style={styles.markPaidText}>Mark Paid</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function SharingScreen({ navigation }: MainTabScreenProps<'Sharing'>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  const {
    sharedByMe,
    sharedWithMe,
    settlementBalances,
    isLoading,
    error,
    fetchSharing,
    markParticipantPaid,
    clearError,
  } = useSharingStore();

  const { fetchTransactions, filters, setFilters } = useTransactionsStore();
  const { activeAccountId } = useAccountsStore();

  useEffect(() => {
    fetchSharing();
  }, [fetchSharing]);

  // Ensure transactions are loaded for picker
  useEffect(() => {
    if (activeAccountId && activeAccountId !== filters.accountId) {
      setFilters({ accountId: activeAccountId });
    }
  }, [activeAccountId, filters.accountId, setFilters]);

  useEffect(() => {
    if (filters.accountId) {
      fetchTransactions();
    }
  }, [filters.accountId, fetchTransactions]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchSharing();
    setIsRefreshing(false);
  }, [fetchSharing]);

  const handleMarkPaid = useCallback(
    async (participantId: string) => {
      if (markingPaidId) return;
      setMarkingPaidId(participantId);
      try {
        await markParticipantPaid(participantId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to mark as paid';
        Alert.alert('Error', message);
      } finally {
        setMarkingPaidId(null);
      }
    },
    [markParticipantPaid, markingPaidId]
  );

  const handleSharePress = useCallback(() => {
    setIsPickerVisible(true);
  }, []);

  const handleTransactionSelect = useCallback(
    (transactionId: string) => {
      setIsPickerVisible(false);
      navigation.navigate('ShareExpense', { transactionId });
    },
    [navigation]
  );

  const handlePickerClose = useCallback(() => {
    setIsPickerVisible(false);
  }, []);

  const pendingSharedWithMe = useMemo(
    () => sharedWithMe.filter((p) => p.status === 'PENDING'),
    [sharedWithMe]
  );

  const sortedSharedByMe = useMemo(
    () =>
      [...sharedByMe].sort((a, b) => {
        if (a.allSettled !== b.allSettled) {
          return a.allSettled ? 1 : -1;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [sharedByMe]
  );

  const hasNoData = sharedByMe.length === 0 && sharedWithMe.length === 0;

  if (isLoading && hasNoData && !isRefreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Loading sharing data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !isRefreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              clearError();
              fetchSharing();
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
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
        <View style={styles.header}>
          <Text style={styles.title}>Sharing</Text>
          <Pressable
            style={styles.addButton}
            onPress={handleSharePress}
            accessibilityRole="button"
            accessibilityLabel="Share an expense"
            testID="share-expense-button"
          >
            <Text style={styles.addButtonText}>+ Share</Text>
          </Pressable>
        </View>

        <BalanceSummary balances={settlementBalances} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared With You</Text>
          {isLoading && pendingSharedWithMe.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#38bdf8" />
            </View>
          ) : pendingSharedWithMe.length === 0 ? (
            <EmptyState
              title="No pending expenses"
              message="When someone shares an expense with you, it will appear here."
              style={styles.emptyState}
            />
          ) : (
            <View>
              {pendingSharedWithMe.map((participation) => (
                <SharedWithMeCard key={participation.id} participation={participation} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>You Shared</Text>
          {isLoading && sortedSharedByMe.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#38bdf8" />
            </View>
          ) : sortedSharedByMe.length === 0 ? (
            <EmptyState
              title="No shared expenses"
              message="Share an expense to split costs with friends."
              style={styles.emptyState}
            />
          ) : (
            <View>
              {sortedSharedByMe.map((expense) => (
                <SharedByMeCard
                  key={expense.id}
                  expense={expense}
                  onMarkPaid={handleMarkPaid}
                  loadingParticipantId={markingPaidId}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <TransactionPickerModal
        visible={isPickerVisible}
        onClose={handlePickerClose}
        onSelect={handleTransactionSelect}
      />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
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
  balanceCard: {
    padding: 24,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 4,
  },
  positiveBalance: {
    color: '#22c55e',
  },
  negativeBalance: {
    color: '#ef4444',
  },
  balanceSubtext: {
    fontSize: 14,
    color: '#64748b',
  },
  section: {
    marginBottom: 24,
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
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 13,
    color: '#64748b',
  },
  amountText: {
    fontSize: 15,
    fontWeight: '600',
  },
  negativeAmount: {
    color: '#ef4444',
  },
  owedAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pendingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  paidBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pendingText: {
    color: '#f59e0b',
  },
  paidText: {
    color: '#22c55e',
  },
  participantsList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  participantInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginRight: 12,
  },
  participantName: {
    fontSize: 14,
    color: '#e2e8f0',
  },
  participantAmount: {
    fontSize: 14,
    color: '#94a3b8',
  },
  paidParticipant: {
    color: '#64748b',
    textDecorationLine: 'line-through',
  },
  paidLabel: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '500',
  },
  markPaidButton: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  markPaidButtonDisabled: {
    opacity: 0.6,
  },
  markPaidText: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '600',
  },
});
