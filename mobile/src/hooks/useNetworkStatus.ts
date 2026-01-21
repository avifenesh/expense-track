import { useState, useEffect } from 'react';
import { networkStatus, NetworkStatus } from '../services/networkStatus';

interface UseNetworkStatusResult {
  isOnline: boolean;
  isInternetReachable: boolean | null;
}

export function useNetworkStatus(): UseNetworkStatusResult {
  const [status, setStatus] = useState<NetworkStatus>(networkStatus.getStatus());

  useEffect(() => {
    const unsubscribe = networkStatus.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  const isOnline =
    status.isConnected &&
    (status.isInternetReachable === null || status.isInternetReachable === true);

  return {
    isOnline,
    isInternetReachable: status.isInternetReachable,
  };
}
