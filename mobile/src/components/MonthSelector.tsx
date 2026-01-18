import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatMonthLabel, shiftMonth } from '../utils/date';

interface MonthSelectorProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  disabled?: boolean;
}

export function MonthSelector({
  selectedMonth,
  onMonthChange,
  disabled = false,
}: MonthSelectorProps) {
  const handlePrevious = () => {
    if (!disabled) {
      onMonthChange(shiftMonth(selectedMonth, -1));
    }
  };

  const handleNext = () => {
    if (!disabled) {
      onMonthChange(shiftMonth(selectedMonth, 1));
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePrevious}
        disabled={disabled}
        style={[styles.button, disabled && styles.buttonDisabled]}
        accessibilityLabel="Previous month"
        accessibilityRole="button"
      >
        <Text style={[styles.buttonText, disabled && styles.textDisabled]}>
          {'<'}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.monthLabel, disabled && styles.textDisabled]}>
        {formatMonthLabel(selectedMonth)}
      </Text>

      <TouchableOpacity
        onPress={handleNext}
        disabled={disabled}
        style={[styles.button, disabled && styles.buttonDisabled]}
        accessibilityLabel="Next month"
        accessibilityRole="button"
      >
        <Text style={[styles.buttonText, disabled && styles.textDisabled]}>
          {'>'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#38bdf8',
    fontSize: 20,
    fontWeight: '600',
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    minWidth: 150,
    textAlign: 'center',
  },
  textDisabled: {
    color: '#64748b',
  },
});
