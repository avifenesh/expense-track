import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Transaction } from '../stores';
import { formatCurrency } from '../utils/format';
import { formatDateShort } from '../utils/date';

interface TransactionListItemProps {
  transaction: Transaction;
  onPress?: (transaction: Transaction) => void;
}

export function TransactionListItem({
  transaction,
  onPress,
}: TransactionListItemProps) {
  const isIncome = transaction.type === 'INCOME';
  const amountColor = isIncome ? '#22c55e' : '#ef4444';
  const amountPrefix = isIncome ? '+' : '-';
  const categoryColor = transaction.category?.color || '#64748b';

  const handlePress = () => {
    onPress?.(transaction);
  };

  const content = (
    <View style={styles.container}>
      <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
      <View style={styles.details}>
        <Text style={styles.description} numberOfLines={1}>
          {transaction.description || transaction.category?.name || 'Transaction'}
        </Text>
        <Text style={styles.dateText}>{formatDateShort(transaction.date)}</Text>
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>
        {amountPrefix}{formatCurrency(transaction.amount, transaction.currency)}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${transaction.description || transaction.category?.name}, ${amountPrefix}${formatCurrency(transaction.amount, transaction.currency)}`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 8,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  details: {
    flex: 1,
    marginRight: 12,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
  },
});
