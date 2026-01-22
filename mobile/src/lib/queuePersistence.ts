import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';
import type { CreateTransactionInput } from '../stores/transactionsStore';

const QUEUE_STORAGE_KEY = 'balance_beacon_offline_queue';

export interface QueuedItem {
  id: string;
  data: CreateTransactionInput;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export async function loadQueue(): Promise<QueuedItem[]> {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      logger.warn('Invalid queue format in storage, returning empty array');
      return [];
    }
    return parsed;
  } catch (error) {
    logger.error('Failed to load offline queue', error);
    return [];
  }
}

export async function saveQueue(items: QueuedItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    logger.error('Failed to save offline queue', error);
    throw error;
  }
}

export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch (error) {
    logger.error('Failed to clear offline queue', error);
    throw error;
  }
}
