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

function isValidCachedSubscription(value: unknown): value is CachedSubscription {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.status === 'string' &&
    typeof obj.isActive === 'boolean' &&
    typeof obj.canAccessApp === 'boolean' &&
    (obj.trialEndsAt === null || typeof obj.trialEndsAt === 'string') &&
    (obj.currentPeriodEnd === null || typeof obj.currentPeriodEnd === 'string') &&
    (obj.daysRemaining === null || typeof obj.daysRemaining === 'number') &&
    typeof obj.cachedAt === 'number'
  );
}

export async function loadSubscription(): Promise<CachedSubscription | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const parsed: unknown = JSON.parse(stored);
    if (!isValidCachedSubscription(parsed)) {
      logger.warn('Invalid subscription format in storage, returning null');
      return null;
    }
    return parsed;
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
