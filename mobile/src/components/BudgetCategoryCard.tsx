import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Currency } from '../types';
import { formatCurrency } from '../utils/format';

export interface BudgetCategoryCardProps {
  categoryName: string;
  categoryColor: string;
  planned: number;
  spent: number;
  currency: Currency;
  onPress?: () => void;
  testID?: string;
}

export function BudgetCategoryCard({
  categoryName,
  categoryColor,
  planned,
  spent,
  currency,
  onPress,
  testID,
}: BudgetCategoryCardProps) {
  const isOverBudget = spent > planned && planned > 0;
  const progress = planned > 0 ? Math.min(spent / planned, 1) : 0;
  const progressColor = isOverBudget ? '#ef4444' : '#38bdf8';
  const formattedSpent = formatCurrency(spent, currency);
  const formattedPlanned = formatCurrency(planned, currency);

  const content = (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <View style={styles.categoryInfo}>
          <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
          <Text style={styles.categoryName} numberOfLines={1}>
            {categoryName}
          </Text>
        </View>
        <View style={styles.amounts}>
          <Text style={[styles.spentAmount, isOverBudget && styles.overBudgetText]}>
            {formattedSpent}
          </Text>
          <Text style={styles.separator}> / </Text>
          <Text style={styles.plannedAmount}>{formattedPlanned}</Text>
        </View>
      </View>
      <View style={styles.progressContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${progress * 100}%`,
              backgroundColor: progressColor,
            },
          ]}
        />
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${categoryName}, ${formattedSpent} of ${formattedPlanned}`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    flex: 1,
  },
  amounts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  overBudgetText: {
    color: '#ef4444',
  },
  separator: {
    fontSize: 14,
    color: '#64748b',
  },
  plannedAmount: {
    fontSize: 14,
    color: '#64748b',
  },
  progressContainer: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
});
