import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores';
import { COLORS } from '../constants/colors';

const PRICING_URL = 'https://balancebeacon.com/pricing';

/**
 * PaywallScreen - Shown when user's subscription has expired.
 * Provides options to subscribe or sign out.
 */
export function PaywallScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSubscribe = async () => {
    try {
      const canOpen = await Linking.canOpenURL(PRICING_URL);
      if (canOpen) {
        await Linking.openURL(PRICING_URL);
      } else {
        Alert.alert(
          'Unable to Open Link',
          'Please visit balancebeacon.com/pricing in your browser to subscribe.',
          [{ text: 'OK' }]
        );
      }
    } catch {
      Alert.alert(
        'Unable to Open Link',
        'Please visit balancebeacon.com/pricing in your browser to subscribe.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await useAuthStore.getState().logout();
    } catch {
      // Logout errors are silently handled - the user will still be logged out locally
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="paywall.screen">
      <View style={styles.content} testID="paywall.content">
        <View style={styles.iconContainer} testID="paywall.iconContainer">
          <Text style={styles.icon}>!</Text>
        </View>

        <Text style={styles.title} testID="paywall.title">
          Subscription Expired
        </Text>

        <Text style={styles.subtitle} testID="paywall.subtitle">
          Your subscription has ended. Subscribe to continue tracking your finances.
        </Text>

        <View style={styles.infoBox} testID="paywall.infoBox">
          <Text style={styles.infoTitle}>What you get:</Text>
          <Text style={styles.infoText}>
            {'\u2022'} Unlimited expense tracking{'\n'}
            {'\u2022'} Budget management{'\n'}
            {'\u2022'} Multi-currency support{'\n'}
            {'\u2022'} Expense sharing{'\n'}
            {'\u2022'} Sync across all devices
          </Text>
          <Text style={styles.priceText}>Just $3/month</Text>
        </View>

        <Pressable
          style={styles.subscribeButton}
          onPress={handleSubscribe}
          testID="paywall.subscribeButton"
        >
          <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
        </Pressable>

        <Pressable
          style={[styles.signOutButton, isSigningOut && styles.buttonDisabled]}
          onPress={handleSignOut}
          disabled={isSigningOut}
          testID="paywall.signOutButton"
        >
          {isSigningOut ? (
            <ActivityIndicator
              size="small"
              color={COLORS.text.tertiary}
              testID="paywall.signOutLoading"
            />
          ) : (
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.screen,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.error,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.text.tertiary,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  infoBox: {
    width: '100%',
    padding: 24,
    backgroundColor: COLORS.background.input,
    borderRadius: 16,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.text.tertiary,
    lineHeight: 24,
    marginBottom: 16,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
  },
  subscribeButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  subscribeButtonText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border.default,
    minHeight: 52,
    justifyContent: 'center',
  },
  signOutButtonText: {
    color: COLORS.text.tertiary,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
