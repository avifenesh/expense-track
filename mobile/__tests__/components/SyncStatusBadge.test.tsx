import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SyncStatusBadge } from '../../src/components/SyncStatusBadge';
import { useOfflineQueueStore } from '../../src/stores';

jest.mock('../../src/stores', () => ({
  useOfflineQueueStore: jest.fn(),
}));

jest.spyOn(Alert, 'alert');

const mockUseOfflineQueueStore = useOfflineQueueStore as unknown as jest.Mock;

const createQueuedItem = (id: string, lastError?: string) => ({
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

describe('SyncStatusBadge', () => {
  const mockProcessQueue = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useOfflineQueueStore as any).getState = jest.fn().mockReturnValue({
      processQueue: mockProcessQueue,
    });
  });

  it('renders nothing when queue is empty and not syncing', () => {
    mockUseOfflineQueueStore.mockReturnValue({
      items: [],
      isSyncing: false,
      syncError: null,
    });

    const { queryByTestId } = render(<SyncStatusBadge />);

    expect(queryByTestId('sync-status-badge')).toBeNull();
  });

  it('renders pending count when items are queued', () => {
    mockUseOfflineQueueStore.mockReturnValue({
      items: [createQueuedItem('1'), createQueuedItem('2')],
      isSyncing: false,
      syncError: null,
    });

    const { getByTestId } = render(<SyncStatusBadge />);

    expect(getByTestId('sync-status-badge')).toBeTruthy();
    expect(getByTestId('sync-status-count').props.children).toBe(2);
  });

  it('renders syncing spinner when syncing', () => {
    mockUseOfflineQueueStore.mockReturnValue({
      items: [createQueuedItem('1')],
      isSyncing: true,
      syncError: null,
    });

    const { getByTestId } = render(<SyncStatusBadge />);

    expect(getByTestId('sync-status-spinner')).toBeTruthy();
  });

  it('renders error icon when there is a sync error', () => {
    mockUseOfflineQueueStore.mockReturnValue({
      items: [createQueuedItem('1', 'Network error')],
      isSyncing: false,
      syncError: 'Failed to sync',
    });

    const { getByTestId } = render(<SyncStatusBadge />);

    expect(getByTestId('sync-status-error-icon')).toBeTruthy();
  });

  it('renders error icon when items have errors', () => {
    mockUseOfflineQueueStore.mockReturnValue({
      items: [createQueuedItem('1', 'Some error')],
      isSyncing: false,
      syncError: null,
    });

    const { getByTestId } = render(<SyncStatusBadge />);

    expect(getByTestId('sync-status-error-icon')).toBeTruthy();
  });

  it('shows alert with queue status on press', () => {
    mockUseOfflineQueueStore.mockReturnValue({
      items: [createQueuedItem('1')],
      isSyncing: false,
      syncError: null,
    });

    const { getByTestId } = render(<SyncStatusBadge />);
    fireEvent.press(getByTestId('sync-status-badge'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Sync Status',
      expect.stringContaining('1 transaction(s) waiting to sync'),
      expect.any(Array)
    );
  });

  it('shows retry button in alert when there are failed items', () => {
    mockUseOfflineQueueStore.mockReturnValue({
      items: [createQueuedItem('1', 'Network error')],
      isSyncing: false,
      syncError: 'Failed',
    });

    const { getByTestId } = render(<SyncStatusBadge />);
    fireEvent.press(getByTestId('sync-status-badge'));

    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const buttons = alertCalls[0][2];
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text).toBe('Retry Sync');
  });

  it('calls processQueue when retry is pressed', async () => {
    mockUseOfflineQueueStore.mockReturnValue({
      items: [createQueuedItem('1', 'Network error')],
      isSyncing: false,
      syncError: 'Failed',
    });

    const { getByTestId } = render(<SyncStatusBadge />);
    fireEvent.press(getByTestId('sync-status-badge'));

    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const retryButton = alertCalls[0][2][0];
    retryButton.onPress();

    expect(mockProcessQueue).toHaveBeenCalled();
  });

  it('calls custom onPress handler when provided', () => {
    mockUseOfflineQueueStore.mockReturnValue({
      items: [createQueuedItem('1')],
      isSyncing: false,
      syncError: null,
    });
    const onPress = jest.fn();

    const { getByTestId } = render(<SyncStatusBadge onPress={onPress} />);
    fireEvent.press(getByTestId('sync-status-badge'));

    expect(onPress).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('applies custom style', () => {
    mockUseOfflineQueueStore.mockReturnValue({
      items: [createQueuedItem('1')],
      isSyncing: false,
      syncError: null,
    });

    const { getByTestId } = render(
      <SyncStatusBadge style={{ marginTop: 10 }} />
    );

    const badge = getByTestId('sync-status-badge');
    expect(badge.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ marginTop: 10 })])
    );
  });

  it('has correct accessibility properties', () => {
    mockUseOfflineQueueStore.mockReturnValue({
      items: [createQueuedItem('1')],
      isSyncing: false,
      syncError: null,
    });

    const { getByTestId } = render(<SyncStatusBadge />);
    const badge = getByTestId('sync-status-badge');

    expect(badge.props.accessibilityRole).toBe('button');
    expect(badge.props.accessibilityLabel).toContain('pending');
  });

  it('updates accessibility label when syncing', () => {
    mockUseOfflineQueueStore.mockReturnValue({
      items: [createQueuedItem('1')],
      isSyncing: true,
      syncError: null,
    });

    const { getByTestId } = render(<SyncStatusBadge />);
    const badge = getByTestId('sync-status-badge');

    expect(badge.props.accessibilityLabel).toBe('Syncing transactions');
  });

  it('updates accessibility label when there is an error', () => {
    mockUseOfflineQueueStore.mockReturnValue({
      items: [createQueuedItem('1')],
      isSyncing: false,
      syncError: 'Failed',
    });

    const { getByTestId } = render(<SyncStatusBadge />);
    const badge = getByTestId('sync-status-badge');

    expect(badge.props.accessibilityLabel).toContain('Sync error');
  });
});
