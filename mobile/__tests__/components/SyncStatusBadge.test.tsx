import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SyncStatusBadge } from '../../src/components/SyncStatusBadge';

interface QueuedItem {
  id: string;
  data: {
    accountId: string;
    categoryId: string;
    type: 'EXPENSE';
    amount: number;
    currency: 'USD';
    date: string;
  };
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

const createQueuedItem = (id: string, lastError?: string): QueuedItem => ({
  id,
  data: {
    accountId: 'account-1',
    categoryId: 'category-1',
    type: 'EXPENSE' as const,
    amount: 50,
    currency: 'USD' as const,
    date: '2026-01-21T00:00:00.000Z',
  },
  createdAt: '2026-01-21T00:00:00.000Z',
  retryCount: lastError ? 1 : 0,
  lastError,
});

// Mock state that will be updated in tests
let mockStoreState = {
  items: [] as QueuedItem[],
  isSyncing: false,
  syncError: null as string | null,
  processQueue: jest.fn(),
};

jest.mock('../../src/stores', () => ({
  useOfflineQueueStore: Object.assign(
    // The hook itself - calls selector with state
    (selector?: (state: typeof mockStoreState) => unknown) => {
      if (selector) {
        return selector(mockStoreState);
      }
      return mockStoreState;
    },
    // getState method
    { getState: () => mockStoreState }
  ),
}));

jest.spyOn(Alert, 'alert');

describe('SyncStatusBadge', () => {
  const mockProcessQueue = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState = {
      items: [],
      isSyncing: false,
      syncError: null,
      processQueue: mockProcessQueue,
    };
  });

  it('renders nothing when queue is empty and not syncing', () => {
    mockStoreState.items = [];
    mockStoreState.isSyncing = false;
    mockStoreState.syncError = null;

    const { queryByTestId } = render(<SyncStatusBadge />);

    expect(queryByTestId('sync-status-badge')).toBeNull();
  });

  it('renders pending count when items are queued', () => {
    mockStoreState.items = [createQueuedItem('1'), createQueuedItem('2')];
    mockStoreState.isSyncing = false;
    mockStoreState.syncError = null;

    const { getByTestId } = render(<SyncStatusBadge />);

    expect(getByTestId('sync-status-badge')).toBeTruthy();
    expect(getByTestId('sync-status-count').props.children).toBe(2);
  });

  it('renders syncing spinner when syncing', () => {
    mockStoreState.items = [createQueuedItem('1')];
    mockStoreState.isSyncing = true;
    mockStoreState.syncError = null;

    const { getByTestId } = render(<SyncStatusBadge />);

    expect(getByTestId('sync-status-spinner')).toBeTruthy();
  });

  it('renders error icon when there is a sync error', () => {
    mockStoreState.items = [createQueuedItem('1', 'Network error')];
    mockStoreState.isSyncing = false;
    mockStoreState.syncError = 'Failed to sync';

    const { getByTestId } = render(<SyncStatusBadge />);

    expect(getByTestId('sync-status-error-icon')).toBeTruthy();
  });

  it('renders error icon when items have errors', () => {
    mockStoreState.items = [createQueuedItem('1', 'Some error')];
    mockStoreState.isSyncing = false;
    mockStoreState.syncError = null;

    const { getByTestId } = render(<SyncStatusBadge />);

    expect(getByTestId('sync-status-error-icon')).toBeTruthy();
  });

  it('shows alert with queue status on press', () => {
    mockStoreState.items = [createQueuedItem('1')];
    mockStoreState.isSyncing = false;
    mockStoreState.syncError = null;

    const { getByTestId } = render(<SyncStatusBadge />);
    fireEvent.press(getByTestId('sync-status-badge'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Sync Status',
      expect.stringContaining('1 transaction(s) waiting to sync'),
      expect.any(Array)
    );
  });

  it('shows retry button in alert when there are failed items', () => {
    mockStoreState.items = [createQueuedItem('1', 'Network error')];
    mockStoreState.isSyncing = false;
    mockStoreState.syncError = 'Failed';

    const { getByTestId } = render(<SyncStatusBadge />);
    fireEvent.press(getByTestId('sync-status-badge'));

    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const buttons = alertCalls[0][2];
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text).toBe('Retry Sync');
  });

  it('calls processQueue when retry is pressed', async () => {
    mockStoreState.items = [createQueuedItem('1', 'Network error')];
    mockStoreState.isSyncing = false;
    mockStoreState.syncError = 'Failed';

    const { getByTestId } = render(<SyncStatusBadge />);
    fireEvent.press(getByTestId('sync-status-badge'));

    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const retryButton = alertCalls[0][2][0];
    retryButton.onPress();

    expect(mockProcessQueue).toHaveBeenCalled();
  });

  it('calls custom onPress handler when provided', () => {
    mockStoreState.items = [createQueuedItem('1')];
    mockStoreState.isSyncing = false;
    mockStoreState.syncError = null;
    const onPress = jest.fn();

    const { getByTestId } = render(<SyncStatusBadge onPress={onPress} />);
    fireEvent.press(getByTestId('sync-status-badge'));

    expect(onPress).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('applies custom style', () => {
    mockStoreState.items = [createQueuedItem('1')];
    mockStoreState.isSyncing = false;
    mockStoreState.syncError = null;

    const { getByTestId } = render(
      <SyncStatusBadge style={{ marginTop: 10 }} />
    );

    const badge = getByTestId('sync-status-badge');
    // The style can be an array (when using StyleSheet.compose) or a single object
    const style = badge.props.style;
    const styleObj = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(styleObj).toMatchObject({ marginTop: 10 });
  });

  it('has correct accessibility properties', () => {
    mockStoreState.items = [createQueuedItem('1')];
    mockStoreState.isSyncing = false;
    mockStoreState.syncError = null;

    const { getByTestId } = render(<SyncStatusBadge />);
    const badge = getByTestId('sync-status-badge');

    expect(badge.props.accessibilityRole).toBe('button');
    expect(badge.props.accessibilityLabel).toContain('pending');
  });

  it('updates accessibility label when syncing', () => {
    mockStoreState.items = [createQueuedItem('1')];
    mockStoreState.isSyncing = true;
    mockStoreState.syncError = null;

    const { getByTestId } = render(<SyncStatusBadge />);
    const badge = getByTestId('sync-status-badge');

    expect(badge.props.accessibilityLabel).toBe('Syncing transactions');
  });

  it('updates accessibility label when there is an error', () => {
    mockStoreState.items = [createQueuedItem('1')];
    mockStoreState.isSyncing = false;
    mockStoreState.syncError = 'Failed';

    const { getByTestId } = render(<SyncStatusBadge />);
    const badge = getByTestId('sync-status-badge');

    expect(badge.props.accessibilityLabel).toContain('Sync error');
  });
});
