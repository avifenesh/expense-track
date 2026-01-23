import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppStackScreenProps } from '../../navigation/types';
import {
  useAccountsStore,
  useBudgetsStore,
  useCategoriesStore,
  type Category,
} from '../../stores';
import { MonthSelector } from '../../components';
import { formatCurrency } from '../../utils/format';
import { getMonthKey } from '../../utils/date';
import {
  validateBudgetAmount,
  validateBudgetCategory,
} from '../../lib/validation';
import type { Currency } from '../../types';

type FormErrors = {
  amount?: string;
  categoryId?: string;
  general?: string;
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  ILS: '₪',
};

export function AddBudgetScreen({
  navigation,
  route,
}: AppStackScreenProps<'CreateBudget'>) {
  const { accounts, activeAccountId } = useAccountsStore();
  const { budgets, createOrUpdateBudget } = useBudgetsStore();
  const {
    categories,
    isLoading: categoriesLoading,
    fetchCategories,
  } = useCategoriesStore();

  const selectedAccount = accounts.find((a) => a.id === activeAccountId);
  const currency: Currency = selectedAccount?.preferredCurrency || 'USD';

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(
    route.params?.initialMonth || getMonthKey()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    fetchCategories('EXPENSE');
  }, [fetchCategories]);

  const availableCategories = useMemo(() => {
    const existingBudgetCategoryIds = new Set(
      budgets
        .filter((b) => b.month.slice(0, 7) === selectedMonth)
        .map((b) => b.categoryId)
    );

    return categories.filter(
      (c) =>
        c.type === 'EXPENSE' &&
        !c.isArchived &&
        !existingBudgetCategoryIds.has(c.id)
    );
  }, [categories, budgets, selectedMonth]);

  useEffect(() => {
    if (categoryId && !availableCategories.find((c) => c.id === categoryId)) {
      setCategoryId(null);
    }
  }, [availableCategories, categoryId]);

  const handleAmountChange = useCallback((text: string) => {
    const sanitized = text.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      return;
    }
    if (parts[1] && parts[1].length > 2) {
      return;
    }
    setAmount(sanitized);
    setErrors((prev) => ({ ...prev, amount: undefined }));
  }, []);

  const handleCategorySelect = useCallback((id: string) => {
    setCategoryId(id);
    setErrors((prev) => ({ ...prev, categoryId: undefined }));
  }, []);

  const handleMonthChange = useCallback((month: string) => {
    setSelectedMonth(month);
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    const amountError = validateBudgetAmount(amount);
    if (amountError) {
      newErrors.amount = amountError;
    }

    const categoryError = validateBudgetCategory(categoryId);
    if (categoryError) {
      newErrors.categoryId = categoryError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [amount, categoryId]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    if (!activeAccountId) {
      setErrors((prev) => ({ ...prev, general: 'No account selected' }));
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await createOrUpdateBudget({
        accountId: activeAccountId,
        categoryId: categoryId!,
        monthKey: selectedMonth,
        planned: parseFloat(amount),
        currency,
      });

      navigation.goBack();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create budget';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateForm,
    activeAccountId,
    categoryId,
    selectedMonth,
    amount,
    currency,
    createOrUpdateBudget,
    navigation,
  ]);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const renderCategoryItem = useCallback(
    (category: Category) => {
      const isSelected = categoryId === category.id;
      return (
        <Pressable
          key={category.id}
          style={[
            styles.categoryChip,
            isSelected && styles.categoryChipSelected,
            { borderColor: category.color },
          ]}
          onPress={() => handleCategorySelect(category.id)}
          accessibilityRole="button"
          accessibilityLabel={`Select ${category.name} category`}
          accessibilityState={{ selected: isSelected }}
          testID={`addBudget.category.${category.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
        >
          <View
            style={[styles.categoryDot, { backgroundColor: category.color }]}
          />
          <Text
            style={[
              styles.categoryChipText,
              isSelected && styles.categoryChipTextSelected,
            ]}
          >
            {category.name}
          </Text>
        </Pressable>
      );
    },
    [categoryId, handleCategorySelect]
  );

  const selectedCategory = availableCategories.find((c) => c.id === categoryId);

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="addBudget.screen">
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header} testID="addBudget.header">
          <Pressable
            style={styles.cancelButton}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            testID="addBudget.cancelButton"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title} testID="addBudget.title">Add Budget</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          testID="addBudget.scrollView"
        >
          <View style={styles.section} testID="addBudget.monthSection">
            <Text style={styles.sectionLabel}>Month</Text>
            <MonthSelector
              selectedMonth={selectedMonth}
              onMonthChange={handleMonthChange}
              allowFutureMonths={true}
              testID="addBudget.monthSelector"
            />
          </View>

          <View style={styles.section} testID="addBudget.amountSection">
            <Text style={styles.sectionLabel}>Budget Amount</Text>
            <View
              style={[styles.inputContainer, errors.amount && styles.inputError]}
            >
              <Text style={styles.currencySymbol}>
                {CURRENCY_SYMBOLS[currency]}
              </Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor="#64748b"
                keyboardType="decimal-pad"
                accessibilityLabel="Budget amount"
                accessibilityHint="Enter the budget amount for this category"
                testID="addBudget.amountInput"
              />
            </View>
            {errors.amount && (
              <Text style={styles.errorText} testID="addBudget.amountError">{errors.amount}</Text>
            )}
          </View>

          <View style={styles.section} testID="addBudget.categorySection">
            <Text style={styles.sectionLabel}>Category</Text>
            {categoriesLoading ? (
              <View style={styles.loadingContainer} testID="addBudget.categoryLoading">
                <ActivityIndicator size="small" color="#38bdf8" />
              </View>
            ) : availableCategories.length === 0 ? (
              <Text style={styles.emptyText} testID="addBudget.categoryEmpty">
                No categories available. All expense categories already have budgets for this month.
              </Text>
            ) : (
              <View style={styles.categoriesGrid} testID="addBudget.categoryGrid">
                {availableCategories.map(renderCategoryItem)}
              </View>
            )}
            {errors.categoryId && (
              <Text style={styles.errorText} testID="addBudget.categoryError">{errors.categoryId}</Text>
            )}
          </View>

          {amount && categoryId && selectedCategory && (
            <View style={styles.previewSection} testID="addBudget.previewSection">
              <Text style={styles.sectionLabel}>Preview</Text>
              <View style={styles.previewCard}>
                <View style={styles.previewRow}>
                  <View
                    style={[
                      styles.previewCategoryDot,
                      { backgroundColor: selectedCategory.color },
                    ]}
                  />
                  <Text style={styles.previewCategory}>
                    {selectedCategory.name}
                  </Text>
                </View>
                <Text style={styles.previewAmount}>
                  {formatCurrency(parseFloat(amount) || 0, currency)}
                </Text>
                <Text style={styles.previewMonth}>
                  Budget for {selectedMonth}
                </Text>
              </View>
            </View>
          )}

          {errors.general && (
            <View style={styles.generalErrorContainer} testID="addBudget.generalErrorContainer">
              <Text style={styles.generalErrorText} testID="addBudget.generalError">{errors.general}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer} testID="addBudget.footer">
          <Pressable
            style={[
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Save budget"
            accessibilityState={{ disabled: isSubmitting }}
            testID="addBudget.submitButton"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#0f172a" testID="addBudget.submitLoading" />
            ) : (
              <Text style={styles.submitButtonText}>Save Budget</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  keyboardView: {
    flex: 1,
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
  cancelButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  cancelButtonText: {
    color: '#38bdf8',
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 16,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: '#94a3b8',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    paddingVertical: 16,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipSelected: {
    backgroundColor: 'rgba(56,189,248,0.15)',
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  categoryChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 8,
  },
  previewSection: {
    marginBottom: 24,
  },
  previewCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewCategoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  previewCategory: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  previewAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 4,
  },
  previewMonth: {
    fontSize: 14,
    color: '#94a3b8',
  },
  generalErrorContainer: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  generalErrorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    padding: 24,
    paddingBottom: 32,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  submitButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
});
