import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { AppStackScreenProps } from '../../navigation/types'
import { useAuthStore } from '../../stores'
import { updateProfile, updateCurrency, getProfile } from '../../services/auth'
import { ApiError } from '../../services/api'

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'ILS', label: 'Israeli Shekel (ILS)' },
] as const

export function ProfileScreen({ navigation }: AppStackScreenProps<'Profile'>) {
  const user = useAuthStore((state) => state.user)
  const accessToken = useAuthStore((state) => state.accessToken)
  const updateUser = useAuthStore((state) => state.updateUser)

  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [selectedCurrency, setSelectedCurrency] = useState('USD')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [displayNameError, setDisplayNameError] = useState<string | null>(null)

  // Track if values have changed
  const [initialDisplayName, setInitialDisplayName] = useState(user?.displayName || '')
  const [initialCurrency, setInitialCurrency] = useState('USD')

  useEffect(() => {
    // Fetch current profile to get preferredCurrency
    const fetchProfile = async () => {
      if (!accessToken) {
        setIsLoading(false)
        return
      }

      try {
        const profile = await getProfile(accessToken)
        setDisplayName(profile.displayName || '')
        setInitialDisplayName(profile.displayName || '')
        setSelectedCurrency(profile.preferredCurrency || 'USD')
        setInitialCurrency(profile.preferredCurrency || 'USD')
      } catch (err) {
        // Fall back to auth store data if profile fetch fails
        if (user?.displayName) {
          setDisplayName(user.displayName)
          setInitialDisplayName(user.displayName)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [accessToken, user?.displayName])

  const hasChanges = displayName.trim() !== initialDisplayName || selectedCurrency !== initialCurrency

  const validateDisplayName = (value: string): boolean => {
    const trimmed = value.trim()
    if (!trimmed) {
      setDisplayNameError('Display name is required')
      return false
    }
    if (trimmed.length > 100) {
      setDisplayNameError('Display name must be 100 characters or less')
      return false
    }
    setDisplayNameError(null)
    return true
  }

  const handleSave = async () => {
    setError(null)
    setSuccessMessage(null)

    if (!validateDisplayName(displayName)) {
      return
    }

    if (!accessToken) {
      setError('Not authenticated')
      return
    }

    setIsSaving(true)

    try {
      const nameChanged = displayName.trim() !== initialDisplayName
      const currencyChanged = selectedCurrency !== initialCurrency

      // Update display name if changed
      if (nameChanged) {
        const result = await updateProfile({ displayName: displayName.trim() }, accessToken)
        updateUser({ displayName: result.displayName })
        setInitialDisplayName(result.displayName)
      }

      // Update currency if changed
      if (currencyChanged) {
        await updateCurrency(selectedCurrency, accessToken)
        setInitialCurrency(selectedCurrency)
      }

      setSuccessMessage('Profile updated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to update profile. Please try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    navigation.goBack()
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="profile.screen">
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleCancel} style={styles.cancelButton} testID="profile.cancelButton">
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Profile</Text>
            <Pressable
              onPress={handleSave}
              style={[styles.saveButton, (!hasChanges || isSaving || isLoading) && styles.saveButtonDisabled]}
              disabled={!hasChanges || isSaving || isLoading}
              testID="profile.saveButton"
            >
              {isSaving ? (
                <ActivityIndicator color="#38bdf8" size="small" />
              ) : (
                <Text style={[styles.saveText, (!hasChanges || isSaving) && styles.saveTextDisabled]}>Save</Text>
              )}
            </Pressable>
          </View>

          {/* Success/Error Messages */}
          {successMessage && (
            <View style={styles.successContainer} testID="profile.successMessage">
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer} testID="profile.errorMessage">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {isLoading ? (
            <View style={styles.loadingContainer} testID="profile.loading">
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
          ) : (
            <>
              {/* Email (Read-only) */}
              <View style={styles.section}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText} testID="profile.email">
                    {user?.email || ''}
                  </Text>
                </View>
                <Text style={styles.helperText}>Email cannot be changed</Text>
              </View>

              {/* Display Name (Editable) */}
              <View style={styles.section}>
                <Text style={styles.label}>Display Name</Text>
                <TextInput
                  style={[styles.input, displayNameError && styles.inputError]}
                  value={displayName}
                  onChangeText={(text) => {
                    setDisplayName(text)
                    if (displayNameError) validateDisplayName(text)
                  }}
                  onBlur={() => validateDisplayName(displayName)}
                  placeholder="Enter your display name"
                  placeholderTextColor="#64748b"
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={100}
                  testID="profile.displayNameInput"
                />
                {displayNameError && <Text style={styles.fieldError}>{displayNameError}</Text>}
              </View>

              {/* Currency Picker */}
              <View style={styles.section}>
                <Text style={styles.label}>Preferred Currency</Text>
                <View style={styles.currencyOptions}>
                  {CURRENCIES.map((currency) => (
                    <Pressable
                      key={currency.code}
                      style={[
                        styles.currencyOption,
                        selectedCurrency === currency.code && styles.currencyOptionSelected,
                      ]}
                      onPress={() => setSelectedCurrency(currency.code)}
                      testID={`profile.currency.${currency.code}`}
                    >
                      <Text
                        style={[styles.currencyText, selectedCurrency === currency.code && styles.currencyTextSelected]}
                      >
                        {currency.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  saveButton: {
    padding: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#38bdf8',
  },
  saveTextDisabled: {
    color: '#64748b',
  },
  successContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    color: '#22c55e',
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 12,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  fieldError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  readOnlyField: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    opacity: 0.7,
  },
  readOnlyText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  currencyOptions: {
    gap: 8,
  },
  currencyOption: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  currencyOptionSelected: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  currencyText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  currencyTextSelected: {
    color: '#38bdf8',
    fontWeight: '600',
  },
})
