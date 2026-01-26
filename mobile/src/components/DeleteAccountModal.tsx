import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface DeleteAccountModalProps {
  visible: boolean;
  userEmail: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: (email: string) => void;
}

export function DeleteAccountModal({
  visible,
  userEmail,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  const [emailInput, setEmailInput] = useState('');

  const isEmailMatch = emailInput.toLowerCase() === userEmail.toLowerCase();

  const handleClose = useCallback(() => {
    setEmailInput('');
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (isEmailMatch && !isDeleting) {
      onConfirm(emailInput);
    }
  }, [isEmailMatch, isDeleting, emailInput, onConfirm]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      testID="delete-account-modal"
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.cancelButton}
            onPress={handleClose}
            disabled={isDeleting}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            testID="delete-account-modal.cancel"
          >
            <Text style={[styles.cancelButtonText, isDeleting && styles.disabledText]}>
              Cancel
            </Text>
          </Pressable>
          <Text style={styles.title}>Delete Account</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          {/* Warning */}
          <View style={styles.warningContainer}>
            <Text style={styles.warningTitle}>This action cannot be undone</Text>
            <Text style={styles.warningText}>
              Deleting your account will permanently remove all your data including:
            </Text>
            <View style={styles.warningList}>
              <Text style={styles.warningListItem}>- All transactions</Text>
              <Text style={styles.warningListItem}>- All budgets</Text>
              <Text style={styles.warningListItem}>- All categories</Text>
              <Text style={styles.warningListItem}>- All accounts</Text>
              <Text style={styles.warningListItem}>- All holdings</Text>
              <Text style={styles.warningListItem}>- Your subscription</Text>
            </View>
          </View>

          {/* Email confirmation */}
          <View style={styles.confirmSection}>
            <Text style={styles.confirmLabel}>
              To confirm, type your email address:
            </Text>
            <Text style={styles.emailHint}>{userEmail}</Text>
            <TextInput
              style={styles.emailInput}
              value={emailInput}
              onChangeText={setEmailInput}
              placeholder="Enter your email"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!isDeleting}
              accessibilityLabel="Email confirmation input"
              testID="delete-account-modal.email-input"
            />
          </View>

          {/* Delete button */}
          <Pressable
            style={[
              styles.deleteButton,
              (!isEmailMatch || isDeleting) && styles.deleteButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isEmailMatch || isDeleting}
            accessibilityRole="button"
            accessibilityLabel="Delete my account"
            accessibilityState={{ disabled: !isEmailMatch || isDeleting }}
            testID="delete-account-modal.confirm"
          >
            {isDeleting ? (
              <ActivityIndicator color="#fff" testID="delete-account-modal.loading" />
            ) : (
              <Text style={styles.deleteButtonText}>Delete My Account</Text>
            )}
          </Pressable>
        </View>
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
  cancelButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  cancelButtonText: {
    color: '#38bdf8',
    fontSize: 16,
  },
  disabledText: {
    opacity: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  warningContainer: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#fca5a5',
    lineHeight: 20,
    marginBottom: 8,
  },
  warningList: {
    marginTop: 8,
  },
  warningListItem: {
    fontSize: 14,
    color: '#fca5a5',
    lineHeight: 22,
  },
  confirmSection: {
    marginBottom: 24,
  },
  confirmLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  emailHint: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  emailInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    backgroundColor: '#7f1d1d',
    opacity: 0.6,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
