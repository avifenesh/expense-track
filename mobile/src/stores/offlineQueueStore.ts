import { create } from 'zustand';
import { registerStoreReset } from './storeRegistry';
import { loadQueue, saveQueue, clearQueue, QueuedItem } from '../lib/queuePersistence';
import { apiPost, apiGet, ApiError } from '../services/api';
import { useAuthStore } from './authStore';
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

    const newItems = [...get().items, queueItem];
    set({ items: newItems, syncError: null });

    try {
      await saveQueue(newItems);
      logger.info('Transaction queued for offline sync', { id });
    } catch (error) {
      logger.error('Failed to persist queue item', error);
    }

    return id;
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

    for (const item of [...items]) {
      try {
        const { id: serverId } = await apiPost<{ id: string }>(
          '/transactions',
          item.data,
          accessToken
        );

        await apiGet<Transaction>(`/transactions/${serverId}`, accessToken);

        await get().removeFromQueue(item.id);
        successCount++;
        logger.info('Synced offline transaction', { queueId: item.id, serverId });
      } catch (error) {
        failCount++;
        const errorMessage = error instanceof ApiError ? error.message : 'Sync failed';

        const updatedItem: QueuedItem = {
          ...item,
          retryCount: item.retryCount + 1,
          lastError: errorMessage,
        };

        if (updatedItem.retryCount >= MAX_RETRIES) {
          logger.warn('Transaction exceeded max retries', {
            id: item.id,
            retries: updatedItem.retryCount,
          });
        }

        const currentItems = get().items;
        const newItems = currentItems.map((i) => (i.id === item.id ? updatedItem : i));
        set({ items: newItems });

        try {
          await saveQueue(newItems);
        } catch (saveError) {
          logger.error('Failed to persist retry count', saveError);
        }

        logger.error('Failed to sync offline transaction', error, { id: item.id });
      }
    }

    const remainingItems = get().items;
    const hasErrors = remainingItems.some((item) => item.lastError);

    set({
      isSyncing: false,
      syncError: hasErrors ? `${failCount} transaction(s) failed to sync` : null,
    });

    logger.info('Offline queue sync completed', {
      success: successCount,
      failed: failCount,
      remaining: remainingItems.length,
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
