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
import DateTimePicker from '@react-native-community/datetimepicker';
import type { AppStackScreenProps } from '../../navigation/types';
import {
  useAccountsStore,
  useTransactionsStore,
  useCategoriesStore,
  type TransactionType,
  type Category,
} from '../../stores';
import { formatCurrency } from '../../utils/format';
import {
  validateTransactionAmount,
  validateTransactionDescription,
  validateTransactionCategory,
  validateTransactionDate,
} from '../../lib/validation';
import type { Currency } from '../../types';

type FormErrors = {
  amount?: string;
  description?: string;
  categoryId?: string;
  date?: string;
  general?: string;
};

export function AddTransactionScreen({
  navigation,
}: AppStackScreenProps<'CreateTransaction'>) {
  const { accounts, selectedAccountId } = useAccountsStore();
  const { createTransaction } = useTransactionsStore();
  const {
    categories,
    isLoading: categoriesLoading,
    fetchCategories,
  } = useCategoriesStore();

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const currency: Currency = selectedAccount?.preferredCurrency || 'USD';

  // Form state
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch categories on mount and when type changes
  useEffect(() => {
    fetchCategories(type);
  }, [fetchCategories, type]);

  // Reset category when type changes
  useEffect(() => {
    setCategoryId(null);
    setErrors((prev) => ({ ...prev, categoryId: undefined }));
  }, [type]);

  // Filter categories by type
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === type && !c.isArchived);
  }, [categories, type]);

  const handleTypeChange = useCallback((newType: TransactionType) => {
    setType(newType);
  }, []);

  const handleAmountChange = useCallback((text: string) => {
    // Allow only numbers and decimal point
    const sanitized = text.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      return;
    }
    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) {
      return;
    }
    setAmount(sanitized);
    setErrors((prev) => ({ ...prev, amount: undefined }));
  }, []);

  const handleDescriptionChange = useCallback((text: string) => {
    setDescription(text);
    setErrors((prev) => ({ ...prev, description: undefined }));
  }, []);

  const handleCategorySelect = useCallback((id: string) => {
    setCategoryId(id);
    setErrors((prev) => ({ ...prev, categoryId: undefined }));
  }, []);

  const handleDateChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      setShowDatePicker(Platform.OS === 'ios');
      if (selectedDate) {
        setDate(selectedDate);
        setErrors((prev) => ({ ...prev, date: undefined }));
      }
    },
    []
  );

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    const amountError = validateTransactionAmount(amount);
    if (amountError) {
      newErrors.amount = amountError;
    }

    const descriptionError = validateTransactionDescription(description);
    if (descriptionError) {
      newErrors.description = descriptionError;
    }

    const categoryError = validateTransactionCategory(categoryId);
    if (categoryError) {
      newErrors.categoryId = categoryError;
    }

    const dateError = validateTransactionDate(date);
    if (dateError) {
      newErrors.date = dateError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [amount, description, categoryId, date]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    if (!selectedAccountId) {
      setErrors({ general: 'No account selected' });
      return;
    }

    if (!categoryId) {
      setErrors({ categoryId: 'Please select a category' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await createTransaction({
        accountId: selectedAccountId,
        categoryId,
        type,
        amount: parseFloat(amount),
        currency,
        date: date.toISOString().split('T')[0],
        description: description.trim() || undefined,
        isRecurring: false,
      });

      navigation.goBack();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create transaction';
      Alert.alert('Error', message);
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateForm,
    selectedAccountId,
    categoryId,
    type,
    amount,
    currency,
    date,
    description,
    createTransaction,
    navigation,
  ]);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const formatDateDisplay = useCallback((d: Date) => {
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.cancelButton}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Add Transaction</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Type</Text>
            <View style={styles.typeRow}>
              <Pressable
                style={[
                  styles.typeButton,
                  type === 'EXPENSE' && styles.typeButtonExpenseActive,
                ]}
                onPress={() => handleTypeChange('EXPENSE')}
                accessibilityRole="button"
                accessibilityLabel="Expense"
                accessibilityState={{ selected: type === 'EXPENSE' }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'EXPENSE' && styles.typeButtonTextActive,
                  ]}
                >
                  Expense
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.typeButton,
                  type === 'INCOME' && styles.typeButtonIncomeActive,
                ]}
                onPress={() => handleTypeChange('INCOME')}
                accessibilityRole="button"
                accessibilityLabel="Income"
                accessibilityState={{ selected: type === 'INCOME' }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'INCOME' && styles.typeButtonTextActive,
                  ]}
                >
                  Income
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Amount Input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Amount</Text>
            <View
              style={[styles.inputContainer, errors.amount && styles.inputError]}
            >
              <Text style={styles.currencySymbol}>
                {currency === 'USD' ? '$' : currency === 'EUR' ? '\u20AC' : '\u20AA'}
              </Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor="#64748b"
                keyboardType="decimal-pad"
                accessibilityLabel="Amount"
                accessibilityHint="Enter the transaction amount"
              />
            </View>
            {errors.amount && (
              <Text style={styles.errorText}>{errors.amount}</Text>
            )}
          </View>

          {/* Category Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Category</Text>
            {categoriesLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#38bdf8" />
              </View>
            ) : filteredCategories.length === 0 ? (
              <Text style={styles.emptyText}>
                No categories available for this type
              </Text>
            ) : (
              <View style={styles.categoriesGrid}>
                {filteredCategories.map(renderCategoryItem)}
              </View>
            )}
            {errors.categoryId && (
              <Text style={styles.errorText}>{errors.categoryId}</Text>
            )}
          </View>

          {/* Date Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Date</Text>
            <Pressable
              style={[styles.dateButton, errors.date && styles.inputError]}
              onPress={() => setShowDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Select date"
              accessibilityHint={`Current date is ${formatDateDisplay(date)}`}
            >
              <Text style={styles.dateText}>{formatDateDisplay(date)}</Text>
            </Pressable>
            {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
                themeVariant="dark"
              />
            )}
          </View>

          {/* Description Input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description (Optional)</Text>
            <TextInput
              style={[
                styles.descriptionInput,
                errors.description && styles.inputError,
              ]}
              value={description}
              onChangeText={handleDescriptionChange}
              placeholder="Enter a description"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={3}
              maxLength={200}
              accessibilityLabel="Description"
              accessibilityHint="Optional description for the transaction"
            />
            {errors.description && (
              <Text style={styles.errorText}>{errors.description}</Text>
            )}
            <Text style={styles.charCount}>{description.length}/200</Text>
          </View>

          {/* Preview */}
          {amount && categoryId && (
            <View style={styles.previewSection}>
              <Text style={styles.sectionLabel}>Preview</Text>
              <View style={styles.previewCard}>
                <Text style={styles.previewType}>
                  {type === 'EXPENSE' ? 'Expense' : 'Income'}
                </Text>
                <Text
                  style={[
                    styles.previewAmount,
                    type === 'EXPENSE'
                      ? styles.expenseAmount
                      : styles.incomeAmount,
                  ]}
                >
                  {type === 'EXPENSE' ? '-' : '+'}
                  {formatCurrency(parseFloat(amount) || 0, currency)}
                </Text>
                <Text style={styles.previewCategory}>
                  {filteredCategories.find((c) => c.id === categoryId)?.name}
                </Text>
                {description.trim() && (
                  <Text style={styles.previewDescription}>
                    {description.trim()}
                  </Text>
                )}
              </View>
            </View>
          )}

          {errors.general && (
            <View style={styles.generalErrorContainer}>
              <Text style={styles.generalErrorText}>{errors.general}</Text>
            </View>
          )}
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <Pressable
            style={[
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Save transaction"
            accessibilityState={{ disabled: isSubmitting }}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : (
              <Text style={styles.submitButtonText}>Save Transaction</Text>
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
  typeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonExpenseActive: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: '#ef4444',
  },
  typeButtonIncomeActive: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: '#22c55e',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
  },
  typeButtonTextActive: {
    color: '#fff',
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
  dateButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dateText: {
    fontSize: 16,
    color: '#fff',
  },
  descriptionInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    textAlignVertical: 'top',
    minHeight: 100,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  charCount: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 8,
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
  previewType: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  previewAmount: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  incomeAmount: {
    color: '#22c55e',
  },
  expenseAmount: {
    color: '#ef4444',
  },
  previewCategory: {
    fontSize: 16,
    color: '#fff',
  },
  previewDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
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
