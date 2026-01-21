import { renderHook, act } from '@testing-library/react-native';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { networkStatus } from '../../src/services/networkStatus';

jest.mock('../../src/services/networkStatus');

const mockNetworkStatus = networkStatus as jest.Mocked<typeof networkStatus>;

describe('useNetworkStatus', () => {
  let subscriberCallback: ((status: { isConnected: boolean; isInternetReachable: boolean | null }) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    subscriberCallback = null;

    mockNetworkStatus.getStatus.mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
    });

    mockNetworkStatus.subscribe.mockImplementation((callback) => {
      subscriberCallback = callback;
      callback({ isConnected: true, isInternetReachable: true });
      return () => {
        subscriberCallback = null;
      };
    });
  });

  it('returns initial network status', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isInternetReachable).toBe(true);
  });

  it('subscribes to network status on mount', () => {
    renderHook(() => useNetworkStatus());

    expect(mockNetworkStatus.subscribe).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', () => {
    const unsubscribe = jest.fn();
    mockNetworkStatus.subscribe.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('updates isOnline when network status changes to offline', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(true);

    act(() => {
      subscriberCallback?.({ isConnected: false, isInternetReachable: false });
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('updates isOnline when network status changes to online', () => {
    mockNetworkStatus.getStatus.mockReturnValue({
      isConnected: false,
      isInternetReachable: false,
    });
    mockNetworkStatus.subscribe.mockImplementation((callback) => {
      subscriberCallback = callback;
      callback({ isConnected: false, isInternetReachable: false });
      return () => {};
    });

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(false);

    act(() => {
      subscriberCallback?.({ isConnected: true, isInternetReachable: true });
    });

    expect(result.current.isOnline).toBe(true);
  });

  it('considers connected with null reachability as online', () => {
    mockNetworkStatus.subscribe.mockImplementation((callback) => {
      subscriberCallback = callback;
      callback({ isConnected: true, isInternetReachable: null });
      return () => {};
    });

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isInternetReachable).toBeNull();
  });

  it('considers connected but not reachable as offline', () => {
    mockNetworkStatus.subscribe.mockImplementation((callback) => {
      subscriberCallback = callback;
      callback({ isConnected: true, isInternetReachable: false });
      return () => {};
    });

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(false);
  });
});
