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
  useSharingStore,
  useTransactionsStore,
  useAccountsStore,
  type SplitType,
  type ShareUser,
} from '../../stores';
import { formatCurrency } from '../../utils/format';
import {
  validateShareDescription,
  validateParticipantsList,
  validateEmail,
} from '../../lib/validation';
import {
  createSplitPreview,
  roundToTwoDecimals,
} from '../../lib/splitCalculator';
import type { Currency } from '../../types';

// ============================================
// Types
// ============================================

interface ParticipantEntry {
  email: string;
  displayName?: string | null;
  userId?: string;
  percentage: number;
  fixedAmount: number;
  isVerified: boolean;
}

type FormErrors = {
  email?: string;
  description?: string;
  participants?: string;
  split?: string;
  general?: string;
};

// ============================================
// Constants
// ============================================

const SPLIT_TYPES: { value: SplitType; label: string; description: string }[] = [
  { value: 'EQUAL', label: 'Equal', description: 'Split equally' },
  { value: 'PERCENTAGE', label: 'Percentage', description: 'By percentage' },
  { value: 'FIXED', label: 'Fixed', description: 'Fixed amounts' },
];

// ============================================
// Component
// ============================================

export function ShareExpenseScreen({
  navigation,
  route,
}: AppStackScreenProps<'ShareExpense'>) {
  const { transactionId } = route.params;

  // Stores
  const { transactions } = useTransactionsStore();
  const { accounts, activeAccountId } = useAccountsStore();
  const { createSharedExpense, lookupUser } = useSharingStore();

  // Find the transaction
  const transaction = useMemo(
    () => transactions.find((t) => t.id === transactionId),
    [transactions, transactionId]
  );

  const selectedAccount = accounts.find((a) => a.id === activeAccountId);
  const currency: Currency = selectedAccount?.preferredCurrency || 'USD';
  const totalAmount = transaction ? parseFloat(transaction.amount) : 0;

  // Form State
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Load transaction description as default
  useEffect(() => {
    if (transaction?.description) {
      setDescription(transaction.description);
    }
  }, [transaction?.description]);

  // Calculate split preview
  const splitPreview = useMemo(() => {
    return createSplitPreview(
      splitType,
      totalAmount,
      participants.map((p) => ({
        email: p.email,
        displayName: p.displayName,
        percentage: p.percentage,
        fixedAmount: p.fixedAmount,
      }))
    );
  }, [splitType, totalAmount, participants]);

  // ============================================
  // Handlers
  // ============================================

  const handleSplitTypeChange = useCallback((newType: SplitType) => {
    setSplitType(newType);
    setErrors((prev) => ({ ...prev, split: undefined }));

    // Reset participant percentages for percentage split
    if (newType === 'PERCENTAGE') {
      setParticipants((prev) => {
        const equalPercentage = prev.length > 0 ? Math.floor(100 / (prev.length + 1)) : 0;
        return prev.map((p) => ({ ...p, percentage: equalPercentage }));
      });
    }
  }, []);

  const handleDescriptionChange = useCallback((text: string) => {
    setDescription(text);
    setErrors((prev) => ({ ...prev, description: undefined }));
  }, []);

  const handleEmailInputChange = useCallback((text: string) => {
    setEmailInput(text);
    setErrors((prev) => ({ ...prev, email: undefined }));
  }, []);

  const handleLookupUser = useCallback(async () => {
    const email = emailInput.trim().toLowerCase();

    // Validate email
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors((prev) => ({ ...prev, email: emailError }));
      return;
    }

    // Check if already added
    if (participants.some((p) => p.email.toLowerCase() === email)) {
      setErrors((prev) => ({ ...prev, email: 'This user is already added' }));
      return;
    }

    setIsLookingUp(true);
    setErrors((prev) => ({ ...prev, email: undefined }));

    try {
      const user = await lookupUser(email);

      if (user) {
        addParticipant({
          email: user.email,
          displayName: user.displayName,
          userId: user.id,
          isVerified: true,
        });
      } else {
        setErrors((prev) => ({
          ...prev,
          email: 'No user found with this email address',
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to look up user';
      setErrors((prev) => ({ ...prev, email: message }));
    } finally {
      setIsLookingUp(false);
    }
  }, [emailInput, participants, lookupUser]);

  const addParticipant = useCallback(
    (user: Omit<ShareUser, 'id'> & { userId?: string; isVerified: boolean }) => {
      const newParticipant: ParticipantEntry = {
        email: user.email,
        displayName: user.displayName,
        userId: user.userId,
        percentage: splitType === 'PERCENTAGE' ? Math.floor(100 / (participants.length + 2)) : 0,
        fixedAmount: 0,
        isVerified: user.isVerified,
      };

      setParticipants((prev) => {
        const updated = [...prev, newParticipant];

        // Rebalance percentages for percentage split
        if (splitType === 'PERCENTAGE') {
          const equalPercentage = Math.floor(100 / (updated.length + 1));
          return updated.map((p) => ({ ...p, percentage: equalPercentage }));
        }

        return updated;
      });

      setEmailInput('');
      setErrors((prev) => ({ ...prev, email: undefined, participants: undefined }));
    },
    [splitType, participants.length]
  );

  const removeParticipant = useCallback(
    (email: string) => {
      setParticipants((prev) => {
        const updated = prev.filter((p) => p.email !== email);

        // Rebalance percentages for percentage split
        if (splitType === 'PERCENTAGE' && updated.length > 0) {
          const equalPercentage = Math.floor(100 / (updated.length + 1));
          return updated.map((p) => ({ ...p, percentage: equalPercentage }));
        }

        return updated;
      });
    },
    [splitType]
  );

  const updateParticipantPercentage = useCallback((email: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const clampedValue = Math.min(100, Math.max(0, numValue));

    setParticipants((prev) =>
      prev.map((p) => (p.email === email ? { ...p, percentage: clampedValue } : p))
    );
    setErrors((prev) => ({ ...prev, split: undefined }));
  }, []);

  const updateParticipantFixedAmount = useCallback((email: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const clampedValue = Math.max(0, numValue);

    setParticipants((prev) =>
      prev.map((p) =>
        p.email === email ? { ...p, fixedAmount: roundToTwoDecimals(clampedValue) } : p
      )
    );
    setErrors((prev) => ({ ...prev, split: undefined }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Validate description
    const descError = validateShareDescription(description);
    if (descError) {
      newErrors.description = descError;
    }

    // Validate participants
    const participantsError = validateParticipantsList(participants);
    if (participantsError) {
      newErrors.participants = participantsError;
    }

    // Validate split amounts
    if (!splitPreview.isValid && splitPreview.errors.length > 0) {
      newErrors.split = splitPreview.errors[0].message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [description, participants, splitPreview]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    if (!transaction) {
      setErrors((prev) => ({ ...prev, general: 'Transaction not found' }));
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const participantData = splitPreview.participantShares.map((share) => {
        const participant = participants.find((p) => p.email === share.email);
        return {
          email: share.email,
          shareAmount: share.amount,
          sharePercentage: splitType === 'PERCENTAGE' ? participant?.percentage : undefined,
        };
      });

      await createSharedExpense({
        transactionId: transaction.id,
        splitType,
        description: description.trim() || '',
        participants: participantData,
      });

      Alert.alert('Success', 'Expense shared successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to share expense';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateForm,
    transaction,
    splitPreview.participantShares,
    participants,
    splitType,
    description,
    createSharedExpense,
    navigation,
  ]);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // ============================================
  // Render Helpers
  // ============================================

  const getDisplayName = (participant: ParticipantEntry): string => {
    return participant.displayName || participant.email.split('@')[0];
  };

  // ============================================
  // Loading State
  // ============================================

  if (!transaction) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Transaction not found</Text>
          <Pressable style={styles.retryButton} onPress={handleCancel}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.cancelButton}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            testID="cancel-button"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Share Expense</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Transaction Summary */}
          <View style={styles.transactionCard}>
            <Text style={styles.transactionLabel}>Transaction</Text>
            <Text style={styles.transactionAmount}>
              {formatCurrency(totalAmount, currency)}
            </Text>
            <Text style={styles.transactionDescription}>
              {transaction.description || 'No description'}
            </Text>
            <Text style={styles.transactionCategory}>{transaction.category.name}</Text>
          </View>

          {/* Split Type Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Split Type</Text>
            <View style={styles.splitTypeRow}>
              {SPLIT_TYPES.map((type) => (
                <Pressable
                  key={type.value}
                  style={[
                    styles.splitTypeButton,
                    splitType === type.value && styles.splitTypeButtonActive,
                  ]}
                  onPress={() => handleSplitTypeChange(type.value)}
                  accessibilityRole="button"
                  accessibilityLabel={type.label}
                  accessibilityState={{ selected: splitType === type.value }}
                  testID={`split-type-${type.value.toLowerCase()}`}
                >
                  <Text
                    style={[
                      styles.splitTypeLabel,
                      splitType === type.value && styles.splitTypeLabelActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                  <Text
                    style={[
                      styles.splitTypeDescription,
                      splitType === type.value && styles.splitTypeDescriptionActive,
                    ]}
                  >
                    {type.description}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Add Participant */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Add Participants</Text>
            <View style={styles.emailInputRow}>
              <TextInput
                style={[styles.emailInput, errors.email && styles.inputError]}
                value={emailInput}
                onChangeText={handleEmailInputChange}
                placeholder="Enter email address"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Participant email"
                testID="participant-email-input"
              />
              <Pressable
                style={[
                  styles.addButton,
                  (isLookingUp || !emailInput.trim()) && styles.addButtonDisabled,
                ]}
                onPress={handleLookupUser}
                disabled={isLookingUp || !emailInput.trim()}
                accessibilityRole="button"
                accessibilityLabel="Add participant"
                testID="add-participant-button"
              >
                {isLookingUp ? (
                  <ActivityIndicator size="small" color="#0f172a" />
                ) : (
                  <Text style={styles.addButtonText}>Add</Text>
                )}
              </Pressable>
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Participants List */}
          {participants.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Participants ({participants.length})
              </Text>
              <View style={styles.participantsList}>
                {participants.map((participant) => (
                  <View key={participant.email} style={styles.participantRow}>
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantName}>
                        {getDisplayName(participant)}
                      </Text>
                      <Text style={styles.participantEmail}>{participant.email}</Text>
                    </View>

                    {/* Split input based on type */}
                    {splitType === 'PERCENTAGE' && (
                      <View style={styles.participantInputContainer}>
                        <TextInput
                          style={styles.participantInput}
                          value={participant.percentage.toString()}
                          onChangeText={(value) =>
                            updateParticipantPercentage(participant.email, value)
                          }
                          keyboardType="decimal-pad"
                          accessibilityLabel={`Percentage for ${getDisplayName(participant)}`}
                          testID={`percentage-input-${participant.email}`}
                        />
                        <Text style={styles.participantInputSuffix}>%</Text>
                      </View>
                    )}

                    {splitType === 'FIXED' && (
                      <View style={styles.participantInputContainer}>
                        <Text style={styles.currencySymbol}>$</Text>
                        <TextInput
                          style={styles.participantInput}
                          value={
                            participant.fixedAmount > 0
                              ? participant.fixedAmount.toString()
                              : ''
                          }
                          onChangeText={(value) =>
                            updateParticipantFixedAmount(participant.email, value)
                          }
                          placeholder="0.00"
                          placeholderTextColor="#64748b"
                          keyboardType="decimal-pad"
                          accessibilityLabel={`Amount for ${getDisplayName(participant)}`}
                          testID={`fixed-input-${participant.email}`}
                        />
                      </View>
                    )}

                    {splitType === 'EQUAL' && (
                      <Text style={styles.participantShareAmount}>
                        {formatCurrency(
                          splitPreview.participantShares.find(
                            (s) => s.email === participant.email
                          )?.amount ?? 0,
                          currency
                        )}
                      </Text>
                    )}

                    <Pressable
                      style={styles.removeButton}
                      onPress={() => removeParticipant(participant.email)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${getDisplayName(participant)}`}
                      testID={`remove-participant-${participant.email}`}
                    >
                      <Text style={styles.removeButtonText}>X</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              {errors.participants && (
                <Text style={styles.errorText}>{errors.participants}</Text>
              )}
              {errors.split && <Text style={styles.errorText}>{errors.split}</Text>}
            </View>
          )}

          {/* Split Preview */}
          {participants.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Split Summary</Text>
              <View style={styles.previewCard}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Your share</Text>
                  <Text style={styles.previewAmount}>
                    {formatCurrency(splitPreview.ownerShare, currency)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Others pay</Text>
                  <Text style={styles.previewAmount}>
                    {formatCurrency(splitPreview.totalParticipantAmount, currency)}
                  </Text>
                </View>
                <View style={[styles.previewRow, styles.previewTotal]}>
                  <Text style={styles.previewTotalLabel}>Total</Text>
                  <Text style={styles.previewTotalAmount}>
                    {formatCurrency(totalAmount, currency)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description (Optional)</Text>
            <TextInput
              style={[styles.descriptionInput, errors.description && styles.inputError]}
              value={description}
              onChangeText={handleDescriptionChange}
              placeholder="Add a note for participants"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={3}
              maxLength={240}
              accessibilityLabel="Description"
              testID="description-input"
            />
            {errors.description && (
              <Text style={styles.errorText}>{errors.description}</Text>
            )}
            <Text style={styles.charCount}>{description.length}/240</Text>
          </View>

          {/* General Error */}
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
              (isSubmitting || participants.length === 0) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || participants.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Share expense"
            accessibilityState={{ disabled: isSubmitting || participants.length === 0 }}
            testID="submit-share-button"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : (
              <Text style={styles.submitButtonText}>Share Expense</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  keyboardView: {
    flex: 1,
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
  transactionCard: {
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
  },
  transactionLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  transactionAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 4,
  },
  transactionDescription: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  transactionCategory: {
    fontSize: 14,
    color: '#64748b',
  },
  splitTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  splitTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  splitTypeButtonActive: {
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderColor: '#38bdf8',
  },
  splitTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 2,
  },
  splitTypeLabelActive: {
    color: '#fff',
  },
  splitTypeDescription: {
    fontSize: 11,
    color: '#64748b',
  },
  splitTypeDescriptionActive: {
    color: '#94a3b8',
  },
  emailInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emailInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  addButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  participantsList: {
    gap: 12,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
  },
  participantInfo: {
    flex: 1,
    marginRight: 12,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  participantEmail: {
    fontSize: 12,
    color: '#64748b',
  },
  participantInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  participantInput: {
    fontSize: 14,
    color: '#fff',
    paddingVertical: 8,
    minWidth: 50,
    textAlign: 'right',
  },
  participantInputSuffix: {
    fontSize: 14,
    color: '#94a3b8',
    marginLeft: 2,
  },
  currencySymbol: {
    fontSize: 14,
    color: '#94a3b8',
    marginRight: 2,
  },
  participantShareAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginRight: 8,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  previewCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  previewAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  previewTotal: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginTop: 8,
    paddingTop: 12,
  },
  previewTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  previewTotalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#38bdf8',
  },
  descriptionInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    textAlignVertical: 'top',
    minHeight: 80,
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
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 16,
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
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
});
