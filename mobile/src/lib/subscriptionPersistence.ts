import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';
import type { SubscriptionStatus } from '../services/subscription';

const STORAGE_KEY = 'balance_beacon_subscription';

export interface CachedSubscription {
  status: SubscriptionStatus;
  isActive: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  daysRemaining: number | null;
  canAccessApp: boolean;
  cachedAt: number;
}

export async function loadSubscription(): Promise<CachedSubscription | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || !parsed.status) {
      logger.warn('Invalid subscription format in storage, returning null');
      return null;
    }
    return parsed as CachedSubscription;
  } catch (error) {
    logger.error('Failed to load subscription cache', error);
    return null;
  }
}

export async function saveSubscription(subscription: CachedSubscription): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(subscription));
  } catch (error) {
    logger.error('Failed to save subscription cache', error);
    throw error;
  }
}

export async function clearSubscription(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    logger.error('Failed to clear subscription cache', error);
    throw error;
  }
}
