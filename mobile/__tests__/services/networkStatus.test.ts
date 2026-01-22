import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { networkStatus } from '../../src/services/networkStatus';

jest.mock('@react-native-community/netinfo');

const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo> & {
  __setMockState: (state: { isConnected: boolean; isInternetReachable: boolean | null }) => void;
  __resetMock: () => void;
};

// Helper type for partial NetInfoState mocks
type MockNetInfoState = Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>;

describe('networkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    networkStatus.cleanup();
    mockNetInfo.__resetMock?.();
  });

  describe('initialize', () => {
    it('sets up NetInfo listener on initialize', () => {
      networkStatus.initialize();

      expect(mockNetInfo.addEventListener).toHaveBeenCalled();
      expect(mockNetInfo.fetch).toHaveBeenCalled();
    });

    it('only initializes once', () => {
      networkStatus.initialize();
      networkStatus.initialize();

      expect(mockNetInfo.addEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStatus', () => {
    it('returns current network status', () => {
      networkStatus.initialize();

      const status = networkStatus.getStatus();

      expect(status).toHaveProperty('isConnected');
      expect(status).toHaveProperty('isInternetReachable');
    });

    it('returns a copy of status (not reference)', () => {
      networkStatus.initialize();

      const status1 = networkStatus.getStatus();
      const status2 = networkStatus.getStatus();

      expect(status1).not.toBe(status2);
      expect(status1).toEqual(status2);
    });
  });

  describe('isOnline', () => {
    it('returns true when connected and internet is reachable', async () => {
      mockNetInfo.fetch.mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: true,
      } as MockNetInfoState as NetInfoState);

      networkStatus.initialize();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(networkStatus.isOnline()).toBe(true);
    });

    it('returns true when connected and reachability is null (unknown)', async () => {
      mockNetInfo.fetch.mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: null,
      } as MockNetInfoState as NetInfoState);

      networkStatus.initialize();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(networkStatus.isOnline()).toBe(true);
    });

    it('returns false when not connected', async () => {
      mockNetInfo.fetch.mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: false,
      } as MockNetInfoState as NetInfoState);

      networkStatus.initialize();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(networkStatus.isOnline()).toBe(false);
    });

    it('returns false when connected but internet not reachable', async () => {
      mockNetInfo.fetch.mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: false,
      } as MockNetInfoState as NetInfoState);

      networkStatus.initialize();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(networkStatus.isOnline()).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('returns unsubscribe function', () => {
      networkStatus.initialize();

      const unsubscribe = networkStatus.subscribe(jest.fn());

      expect(typeof unsubscribe).toBe('function');
    });

    it('calls callback immediately with current status', () => {
      networkStatus.initialize();
      const callback = jest.fn();

      networkStatus.subscribe(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        isConnected: expect.any(Boolean),
      }));
    });

    it('removes callback on unsubscribe', async () => {
      networkStatus.initialize();
      const callback = jest.fn();

      const unsubscribe = networkStatus.subscribe(callback);
      callback.mockClear();
      unsubscribe();

      mockNetInfo.__setMockState?.({ isConnected: false, isInternetReachable: false });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(callback).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      networkStatus.initialize();
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      networkStatus.subscribe(callback1);
      networkStatus.subscribe(callback2);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('clears all subscribers and unsubscribes from NetInfo', () => {
      networkStatus.initialize();
      const callback = jest.fn();
      networkStatus.subscribe(callback);

      networkStatus.cleanup();

      expect(networkStatus.getStatus()).toBeDefined();
    });

    it('allows re-initialization after cleanup', () => {
      networkStatus.initialize();
      networkStatus.cleanup();
      networkStatus.initialize();

      expect(mockNetInfo.addEventListener).toHaveBeenCalledTimes(2);
    });
  });
});
