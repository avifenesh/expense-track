import React from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  Alert,
} from 'react-native';
import { useOfflineQueueStore } from '../stores';

export interface SyncStatusBadgeProps {
  style?: ViewStyle;
  onPress?: () => void;
  testID?: string;
}

export function SyncStatusBadge({ style, onPress, testID = 'sync-status-badge' }: SyncStatusBadgeProps) {
  // Use individual selectors to prevent unnecessary re-renders
  const items = useOfflineQueueStore((state) => state.items);
  const isSyncing = useOfflineQueueStore((state) => state.isSyncing);
  const syncError = useOfflineQueueStore((state) => state.syncError);

  const pendingCount = items.length;
  const failedCount = items.filter((item) => item.lastError).length;

  if (pendingCount === 0 && !isSyncing && !syncError) {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    const failedItems = items.filter((item) => item.lastError);
    const message = syncError
      ? `${syncError}\n\nPending: ${pendingCount}\nFailed: ${failedCount}`
      : `${pendingCount} transaction(s) waiting to sync`;

    Alert.alert(
      'Sync Status',
      message,
      failedItems.length > 0
        ? [
            {
              text: 'Retry Sync',
              onPress: () => {
                useOfflineQueueStore.getState().processQueue();
              },
            },
            { text: 'OK', style: 'cancel' },
          ]
        : [{ text: 'OK', style: 'cancel' }]
    );
  };

  const getBackgroundColor = () => {
    if (syncError || failedCount > 0) {
      return '#ef4444';
    }
    if (isSyncing) {
      return '#38bdf8';
    }
    return '#f59e0b';
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.container, { backgroundColor: getBackgroundColor() }, style]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        isSyncing
          ? 'Syncing transactions'
          : syncError
            ? `Sync error: ${pendingCount} pending`
            : `${pendingCount} transactions pending`
      }
    >
      {isSyncing ? (
        <ActivityIndicator
          size="small"
          color="#fff"
          testID="sync-status-spinner"
        />
      ) : syncError || failedCount > 0 ? (
        <Text style={styles.icon} testID="sync-status-error-icon">
          !
        </Text>
      ) : null}
      <Text style={styles.count} testID="sync-status-count">
        {pendingCount}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    minWidth: 32,
    justifyContent: 'center',
  },
  icon: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  count: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
