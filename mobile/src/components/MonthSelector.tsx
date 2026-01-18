import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import {
  formatMonthLabel,
  shiftMonth,
  getMonthKey,
  isMonthBefore,
  isMonthAfter,
  getYearFromMonthKey,
  getMonthFromMonthKey,
} from '../utils/date';

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const COLORS = {
  background: '#1e293b',
  primary: '#38bdf8',
  text: '#fff',
  textDisabled: '#64748b',
  modalBackground: '#0f172a',
  modalOverlay: 'rgba(0,0,0,0.7)',
  itemBorder: 'rgba(255,255,255,0.1)',
  selectedBackground: 'rgba(56,189,248,0.1)',
};

interface MonthSelectorProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  disabled?: boolean;
  minMonth?: string;
  maxMonth?: string;
  allowFutureMonths?: boolean;
  yearRange?: number;
  testID?: string;
}

export function MonthSelector({
  selectedMonth,
  onMonthChange,
  disabled = false,
  minMonth,
  maxMonth,
  allowFutureMonths = false,
  yearRange = 5,
  testID,
}: MonthSelectorProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(
    getYearFromMonthKey(selectedMonth)
  );

  const effectiveMaxMonth = useMemo(() => {
    if (allowFutureMonths && !maxMonth) {
      return undefined;
    }
    return maxMonth || getMonthKey(new Date());
  }, [allowFutureMonths, maxMonth]);

  const isPrevDisabled = useMemo(() => {
    if (disabled) return true;
    if (!minMonth) return false;
    const prevMonth = shiftMonth(selectedMonth, -1);
    return isMonthBefore(prevMonth, minMonth);
  }, [disabled, minMonth, selectedMonth]);

  const isNextDisabled = useMemo(() => {
    if (disabled) return true;
    if (!effectiveMaxMonth) return false;
    const nextMonth = shiftMonth(selectedMonth, 1);
    return isMonthAfter(nextMonth, effectiveMaxMonth);
  }, [disabled, effectiveMaxMonth, selectedMonth]);

  const { minYear, maxYear } = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let min = currentYear - yearRange;
    let max = currentYear;

    if (minMonth) {
      min = Math.max(min, getYearFromMonthKey(minMonth));
    }
    if (effectiveMaxMonth) {
      max = Math.max(max, getYearFromMonthKey(effectiveMaxMonth));
    }
    if (allowFutureMonths && !maxMonth) {
      max = currentYear + yearRange;
    }

    return { minYear: min, maxYear: max };
  }, [yearRange, minMonth, effectiveMaxMonth, allowFutureMonths, maxMonth]);

  const handlePrevious = () => {
    if (!isPrevDisabled) {
      onMonthChange(shiftMonth(selectedMonth, -1));
    }
  };

  const handleNext = () => {
    if (!isNextDisabled) {
      onMonthChange(shiftMonth(selectedMonth, 1));
    }
  };

  const openModal = () => {
    if (!disabled) {
      setPickerYear(getYearFromMonthKey(selectedMonth));
      setIsModalVisible(true);
    }
  };

  const closeModal = () => {
    setIsModalVisible(false);
  };

  const handleYearPrevious = () => {
    if (pickerYear > minYear) {
      setPickerYear(pickerYear - 1);
    }
  };

  const handleYearNext = () => {
    if (pickerYear < maxYear) {
      setPickerYear(pickerYear + 1);
    }
  };

  const handleMonthSelect = (monthIndex: number) => {
    const newMonth = `${pickerYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    onMonthChange(newMonth);
    closeModal();
  };

  const isMonthDisabled = (monthIndex: number): boolean => {
    const monthKey = `${pickerYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    if (minMonth && isMonthBefore(monthKey, minMonth)) {
      return true;
    }
    if (effectiveMaxMonth && isMonthAfter(monthKey, effectiveMaxMonth)) {
      return true;
    }
    return false;
  };

  const isMonthSelected = (monthIndex: number): boolean => {
    const selectedYear = getYearFromMonthKey(selectedMonth);
    const selectedMonthNum = getMonthFromMonthKey(selectedMonth);
    return pickerYear === selectedYear && monthIndex + 1 === selectedMonthNum;
  };

  const renderMonthGrid = () => {
    const rows = [];
    for (let row = 0; row < 3; row++) {
      const monthsInRow = [];
      for (let col = 0; col < 4; col++) {
        const monthIndex = row * 4 + col;
        const monthDisabled = isMonthDisabled(monthIndex);
        const monthSelected = isMonthSelected(monthIndex);

        monthsInRow.push(
          <Pressable
            key={monthIndex}
            style={[
              styles.monthGridItem,
              monthSelected && styles.monthGridItemSelected,
              monthDisabled && styles.monthGridItemDisabled,
            ]}
            onPress={() => !monthDisabled && handleMonthSelect(monthIndex)}
            disabled={monthDisabled}
            testID={testID ? `${testID}-month-${monthIndex}` : undefined}
            accessibilityRole="button"
            accessibilityLabel={`${MONTH_NAMES[monthIndex]} ${pickerYear}`}
            accessibilityState={{ selected: monthSelected, disabled: monthDisabled }}
          >
            <Text
              style={[
                styles.monthGridText,
                monthSelected && styles.monthGridTextSelected,
                monthDisabled && styles.monthGridTextDisabled,
              ]}
            >
              {MONTH_NAMES[monthIndex]}
            </Text>
          </Pressable>
        );
      }
      rows.push(
        <View key={row} style={styles.monthGridRow}>
          {monthsInRow}
        </View>
      );
    }
    return rows;
  };

  return (
    <View style={styles.container} testID={testID}>
      <TouchableOpacity
        onPress={handlePrevious}
        disabled={isPrevDisabled}
        style={[styles.button, isPrevDisabled && styles.buttonDisabled]}
        accessibilityLabel="Previous month"
        accessibilityRole="button"
        accessibilityState={{ disabled: isPrevDisabled }}
        testID={testID ? `${testID}-prev` : undefined}
      >
        <Text
          style={[styles.buttonText, isPrevDisabled && styles.textDisabled]}
        >
          {'<'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={openModal}
        disabled={disabled}
        style={styles.labelContainer}
        accessibilityRole="button"
        accessibilityLabel={`Select month: ${formatMonthLabel(selectedMonth)}`}
        accessibilityHint="Opens month picker"
        accessibilityState={{ disabled }}
        testID={testID ? `${testID}-label` : undefined}
      >
        <Text style={[styles.monthLabel, disabled && styles.textDisabled]}>
          {formatMonthLabel(selectedMonth)}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleNext}
        disabled={isNextDisabled}
        style={[styles.button, isNextDisabled && styles.buttonDisabled]}
        accessibilityLabel="Next month"
        accessibilityRole="button"
        accessibilityState={{ disabled: isNextDisabled }}
        testID={testID ? `${testID}-next` : undefined}
      >
        <Text
          style={[styles.buttonText, isNextDisabled && styles.textDisabled]}
        >
          {'>'}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
        testID={testID ? `${testID}-modal` : undefined}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Month</Text>
              <Pressable
                onPress={closeModal}
                hitSlop={8}
                testID={testID ? `${testID}-close` : undefined}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.closeButton}>X</Text>
              </Pressable>
            </View>

            <View style={styles.yearSelector}>
              <TouchableOpacity
                onPress={handleYearPrevious}
                disabled={pickerYear <= minYear}
                style={[
                  styles.yearButton,
                  pickerYear <= minYear && styles.yearButtonDisabled,
                ]}
                accessibilityLabel="Previous year"
                accessibilityRole="button"
                accessibilityState={{ disabled: pickerYear <= minYear }}
                testID={testID ? `${testID}-year-prev` : undefined}
              >
                <Text
                  style={[
                    styles.yearButtonText,
                    pickerYear <= minYear && styles.textDisabled,
                  ]}
                >
                  {'<'}
                </Text>
              </TouchableOpacity>

              <Text
                style={styles.yearText}
                accessibilityLabel={`Year ${pickerYear}`}
                testID={testID ? `${testID}-year` : undefined}
              >
                {pickerYear}
              </Text>

              <TouchableOpacity
                onPress={handleYearNext}
                disabled={pickerYear >= maxYear}
                style={[
                  styles.yearButton,
                  pickerYear >= maxYear && styles.yearButtonDisabled,
                ]}
                accessibilityLabel="Next year"
                accessibilityRole="button"
                accessibilityState={{ disabled: pickerYear >= maxYear }}
                testID={testID ? `${testID}-year-next` : undefined}
              >
                <Text
                  style={[
                    styles.yearButtonText,
                    pickerYear >= maxYear && styles.textDisabled,
                  ]}
                >
                  {'>'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.monthGrid}>{renderMonthGrid()}</View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '600',
  },
  labelContainer: {
    minWidth: 150,
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  textDisabled: {
    color: COLORS.textDisabled,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.modalOverlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.modalBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.itemBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    fontSize: 18,
    color: COLORS.textDisabled,
    padding: 4,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 24,
  },
  yearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearButtonDisabled: {
    opacity: 0.5,
  },
  yearButtonText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '600',
  },
  yearText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    minWidth: 80,
    textAlign: 'center',
  },
  monthGrid: {
    padding: 16,
  },
  monthGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  monthGridItem: {
    width: 70,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthGridItemSelected: {
    backgroundColor: COLORS.selectedBackground,
  },
  monthGridItemDisabled: {
    opacity: 0.5,
  },
  monthGridText: {
    fontSize: 16,
    color: COLORS.text,
  },
  monthGridTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  monthGridTextDisabled: {
    color: COLORS.textDisabled,
  },
});
