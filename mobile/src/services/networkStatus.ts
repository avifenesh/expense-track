import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { logger } from '../lib/logger';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

type NetworkStatusCallback = (status: NetworkStatus) => void;

class NetworkStatusService {
  private currentStatus: NetworkStatus = {
    isConnected: true,
    isInternetReachable: null,
  };
  private subscribers: Set<NetworkStatusCallback> = new Set();
  private unsubscribeNetInfo: NetInfoSubscription | null = null;
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    NetInfo.fetch().then((state) => {
      this.handleNetInfoChange(state);
    });

    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      this.handleNetInfoChange(state);
    });

    logger.info('NetworkStatus service initialized');
  }

  private handleNetInfoChange(state: NetInfoState): void {
    const newStatus: NetworkStatus = {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
    };

    const wasOffline = !this.currentStatus.isConnected;
    const isNowOnline = newStatus.isConnected;

    this.currentStatus = newStatus;

    if (wasOffline && isNowOnline) {
      logger.info('Network connection restored');
    } else if (!isNowOnline) {
      logger.info('Network connection lost');
    }

    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(this.currentStatus);
      } catch (error) {
        logger.error('Error in network status subscriber', error);
      }
    });
  }

  getStatus(): NetworkStatus {
    return { ...this.currentStatus };
  }

  isOnline(): boolean {
    return (
      this.currentStatus.isConnected &&
      (this.currentStatus.isInternetReachable === null ||
        this.currentStatus.isInternetReachable === true)
    );
  }

  subscribe(callback: NetworkStatusCallback): () => void {
    this.subscribers.add(callback);

    callback(this.currentStatus);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  cleanup(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    this.subscribers.clear();
    this.initialized = false;
    logger.info('NetworkStatus service cleaned up');
  }
}

export const networkStatus = new NetworkStatusService();
