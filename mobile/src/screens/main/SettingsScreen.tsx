import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MainTabScreenProps } from '../../navigation/types';
import { APP_NAME, APP_VERSION } from '../../constants';
import { useAuth } from '../../contexts';
import { getBiometricTypeLabel } from '../../services/biometric';

export function SettingsScreen(_props: MainTabScreenProps<'Settings'>) {
  const {
    logout,
    biometricCapability,
    isBiometricEnabled,
    enableBiometric,
    disableBiometric,
  } = useAuth();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleToggleBiometric = async () => {
    setBiometricError(null);
    setIsBiometricLoading(true);
    try {
      if (isBiometricEnabled) {
        await disableBiometric();
      } else {
        await enableBiometric();
      }
    } catch (err) {
      if (err instanceof Error) {
        setBiometricError(err.message);
      } else {
        setBiometricError('Failed to update biometric settings');
      }
    } finally {
      setIsBiometricLoading(false);
    }
  };

  const biometricLabel = biometricCapability
    ? getBiometricTypeLabel(biometricCapability.biometricType)
    : 'Biometric';

  const showBiometricOption = biometricCapability?.isAvailable;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuGroup}>
            <Pressable style={styles.menuItem}>
              <Text style={styles.menuText}>Profile</Text>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
            <Pressable style={styles.menuItem}>
              <Text style={styles.menuText}>Currency</Text>
              <Text style={styles.menuValue}>USD</Text>
            </Pressable>
            <Pressable style={styles.menuItem}>
              <Text style={styles.menuText}>Accounts</Text>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
            <Pressable style={styles.menuItem}>
              <Text style={styles.menuText}>Categories</Text>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
          </View>
        </View>

        {showBiometricOption && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>
            <View style={styles.menuGroup}>
              <View style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <Text style={styles.menuText}>{biometricLabel}</Text>
                  <Text style={styles.menuSubtext}>Quick unlock with {biometricLabel}</Text>
                </View>
                {isBiometricLoading ? (
                  <ActivityIndicator color="#38bdf8" testID="biometric-loading" />
                ) : (
                  <Switch
                    value={isBiometricEnabled}
                    onValueChange={handleToggleBiometric}
                    trackColor={{ false: '#475569', true: '#38bdf8' }}
                    thumbColor={isBiometricEnabled ? '#fff' : '#94a3b8'}
                    testID="biometric-switch"
                  />
                )}
              </View>
            </View>
            {biometricError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{biometricError}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <View style={styles.menuGroup}>
            <Pressable style={styles.menuItem}>
              <Text style={styles.menuText}>Export Data</Text>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
            <Pressable style={styles.menuItem}>
              <Text style={[styles.menuText, styles.dangerText]}>Delete Account</Text>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.menuGroup}>
            <Pressable style={styles.menuItem}>
              <Text style={styles.menuText}>Privacy Policy</Text>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
            <Pressable style={styles.menuItem}>
              <Text style={styles.menuText}>Terms of Service</Text>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
            <View style={styles.menuItem}>
              <Text style={styles.menuText}>Version</Text>
              <Text style={styles.menuValue}>{APP_VERSION}</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
          onPress={handleLogout}
          disabled={isLoggingOut}
          testID="logout-button"
        >
          {isLoggingOut ? (
            <ActivityIndicator color="#ef4444" />
          ) : (
            <Text style={styles.logoutText}>Sign Out</Text>
          )}
        </Pressable>

        <Text style={styles.appName}>{APP_NAME}</Text>
      </ScrollView>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  menuGroup: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  menuItemLeft: {
    flex: 1,
  },
  menuText: {
    fontSize: 16,
    color: '#fff',
  },
  menuSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  menuValue: {
    fontSize: 16,
    color: '#64748b',
  },
  menuArrow: {
    fontSize: 20,
    color: '#64748b',
  },
  dangerText: {
    color: '#ef4444',
  },
  errorContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  logoutButton: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  appName: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
  },
});
