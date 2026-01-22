import { create } from 'zustand';
import { registerStoreReset } from './storeRegistry';
import { loadQueue, saveQueue, clearQueue, QueuedItem } from '../lib/queuePersistence';
import { apiPost, apiGet, ApiError } from '../services/api';
import { useAuthStore } from './authStore';
import { useTransactionsStore } from './transactionsStore';
import { logger } from '../lib/logger';
import type { CreateTransactionInput, Transaction } from './transactionsStore';

export type { QueuedItem } from '../lib/queuePersistence';

const MAX_RETRIES = 3;

interface OfflineQueueState {
  items: QueuedItem[];
  isSyncing: boolean;
  syncError: string | null;
  lastSyncAttempt: string | null;
}

interface OfflineQueueActions {
  addToQueue: (data: CreateTransactionInput) => Promise<string>;
  removeFromQueue: (id: string) => Promise<void>;
  processQueue: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  getQueueCount: () => number;
  reset: () => void;
}

export type OfflineQueueStore = OfflineQueueState & OfflineQueueActions;

const initialState: OfflineQueueState = {
  items: [],
  isSyncing: false,
  syncError: null,
  lastSyncAttempt: null,
};

function generateId(): string {
  return `pending_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const useOfflineQueueStore = create<OfflineQueueStore>((set, get) => ({
  ...initialState,

  addToQueue: async (data: CreateTransactionInput) => {
    const id = generateId();
    const queueItem: QueuedItem = {
      id,
      data,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    const previousItems = get().items;
    const newItems = [...previousItems, queueItem];
    set({ items: newItems, syncError: null });

    try {
      await saveQueue(newItems);
      logger.info('Transaction queued for offline sync', { id });
      return id;
    } catch (error) {
      logger.error('Failed to persist queue item', error);
      // Revert in-memory state to keep it consistent with persistent storage
      set({ items: previousItems });
      throw error;
    }
  },

  removeFromQueue: async (id: string) => {
    const newItems = get().items.filter((item) => item.id !== id);
    set({ items: newItems });

    try {
      await saveQueue(newItems);
    } catch (error) {
      logger.error('Failed to persist queue removal', error);
    }
  },

  processQueue: async () => {
    const { items, isSyncing } = get();

    if (isSyncing || items.length === 0) {
      return;
    }

    set({ isSyncing: true, syncError: null, lastSyncAttempt: new Date().toISOString() });
    logger.info('Starting offline queue sync', { count: items.length });

    const accessToken = useAuthStore.getState().accessToken;

    if (!accessToken) {
      logger.warn('Cannot sync queue: not authenticated');
      set({ isSyncing: false, syncError: 'Not authenticated' });
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const updatedItems: QueuedItem[] = [];

    for (const item of items) {
      try {
        const { id: serverId } = await apiPost<{ id: string }>(
          '/transactions',
          item.data,
          accessToken
        );

        const transaction = await apiGet<Transaction>(`/transactions/${serverId}`, accessToken);

        // Replace pending transaction in transactionsStore with synced transaction
        useTransactionsStore.getState().replacePendingTransaction(item.id, transaction);

        successCount++;
        logger.info('Synced offline transaction', { queueId: item.id, serverId });
        // Don't add to updatedItems - item is successfully synced and removed
      } catch (error) {
        failCount++;
        const errorMessage = error instanceof ApiError ? error.message : 'Sync failed';

        const updatedItem: QueuedItem = {
          ...item,
          retryCount: item.retryCount + 1,
          lastError: errorMessage,
        };

        if (updatedItem.retryCount >= MAX_RETRIES) {
          logger.warn('Transaction exceeded max retries, removing from queue', {
            id: item.id,
            retries: updatedItem.retryCount,
          });
          // Don't add to updatedItems - remove from queue after max retries
        } else {
          // Keep in queue for retry
          updatedItems.push(updatedItem);
        }

        logger.error('Failed to sync offline transaction', error, { id: item.id });
      }
    }

    // Single state update after processing all items
    const hasErrors = updatedItems.some((item) => item.lastError);
    set({
      items: updatedItems,
      isSyncing: false,
      syncError: hasErrors ? `${failCount} transaction(s) failed to sync` : null,
    });

    // Persist updated queue
    try {
      await saveQueue(updatedItems);
    } catch (saveError) {
      logger.error('Failed to persist queue after sync', saveError);
    }

    logger.info('Offline queue sync completed', {
      success: successCount,
      failed: failCount,
      remaining: updatedItems.length,
    });
  },

  loadFromStorage: async () => {
    try {
      const items = await loadQueue();
      set({ items });
      logger.info('Loaded offline queue from storage', { count: items.length });
    } catch (error) {
      logger.error('Failed to load offline queue', error);
    }
  },

  getQueueCount: () => {
    return get().items.length;
  },

  reset: () => {
    clearQueue().catch((error) => {
      logger.error('Failed to clear queue on reset', error);
    });
    set({ ...initialState });
  },
}));

registerStoreReset(() => useOfflineQueueStore.getState().reset());
