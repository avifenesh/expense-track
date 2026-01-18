import { useSharingStore } from '../../src/stores/sharingStore';
import { useAuthStore } from '../../src/stores/authStore';
import { ApiError, apiGet, apiPost, apiPatch, apiDelete } from '../../src/services/api';

jest.mock('../../src/services/api');

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;
const mockApiPatch = apiPatch as jest.MockedFunction<typeof apiPatch>;
const mockApiDelete = apiDelete as jest.MockedFunction<typeof apiDelete>;

const mockSharedExpense = {
  id: 'share-1',
  transactionId: 'tx-1',
  splitType: 'EQUAL' as const,
  description: 'Dinner at restaurant',
  totalAmount: '100.00',
  currency: 'USD' as const,
  createdAt: '2026-01-15T12:00:00Z',
  transaction: {
    id: 'tx-1',
    date: '2026-01-15',
    description: 'Restaurant dinner',
    category: {
      id: 'cat-1',
      name: 'Food',
    },
  },
  participants: [
    {
      id: 'part-1',
      shareAmount: '50.00',
      sharePercentage: null,
      status: 'PENDING' as const,
      paidAt: null,
      reminderSentAt: null,
      participant: {
        id: 'user-2',
        email: 'friend@example.com',
        displayName: 'Friend',
      },
    },
  ],
  totalOwed: '50.00',
  totalPaid: '0.00',
  allSettled: false,
};

const mockParticipation = {
  id: 'part-2',
  shareAmount: '25.00',
  sharePercentage: null,
  status: 'PENDING' as const,
  paidAt: null,
  sharedExpense: {
    id: 'share-2',
    splitType: 'EQUAL' as const,
    totalAmount: '50.00',
    currency: 'USD' as const,
    description: 'Movie tickets',
    createdAt: '2026-01-14T10:00:00Z',
    transaction: {
      id: 'tx-2',
      date: '2026-01-14',
      description: 'Movie tickets',
      category: {
        id: 'cat-2',
        name: 'Entertainment',
      },
    },
    owner: {
      id: 'user-3',
      email: 'owner@example.com',
      displayName: 'Owner',
    },
  },
};

const mockSettlementBalance = {
  userId: 'user-2',
  userEmail: 'friend@example.com',
  userDisplayName: 'Friend',
  currency: 'USD' as const,
  youOwe: '0.00',
  theyOwe: '50.00',
  netBalance: '50.00',
};

const mockUser = {
  id: 'user-2',
  email: 'friend@example.com',
  displayName: 'Friend',
};

describe('sharingStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSharingStore.getState().reset();
    useAuthStore.setState({ accessToken: 'test-token' });
  });

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useSharingStore.getState();
      expect(state.sharedByMe).toEqual([]);
      expect(state.sharedWithMe).toEqual([]);
      expect(state.settlementBalances).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchSharing', () => {
    it('fetches all sharing data successfully', async () => {
      mockApiGet.mockResolvedValue({
        sharedExpenses: [mockSharedExpense],
        expensesSharedWithMe: [mockParticipation],
        settlementBalances: [mockSettlementBalance],
      });

      await useSharingStore.getState().fetchSharing();

      expect(mockApiGet).toHaveBeenCalledWith('/sharing', 'test-token');
      const state = useSharingStore.getState();
      expect(state.sharedByMe).toHaveLength(1);
      expect(state.sharedByMe[0]).toEqual(mockSharedExpense);
      expect(state.sharedWithMe).toHaveLength(1);
      expect(state.sharedWithMe[0]).toEqual(mockParticipation);
      expect(state.settlementBalances).toHaveLength(1);
      expect(state.settlementBalances[0]).toEqual(mockSettlementBalance);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets loading state during fetch', async () => {
      let loadingDuringFetch = false;
      mockApiGet.mockImplementation(async () => {
        loadingDuringFetch = useSharingStore.getState().isLoading;
        return {
          sharedExpenses: [],
          expensesSharedWithMe: [],
          settlementBalances: [],
        };
      });

      await useSharingStore.getState().fetchSharing();

      expect(loadingDuringFetch).toBe(true);
      expect(useSharingStore.getState().isLoading).toBe(false);
    });

    it('handles API errors', async () => {
      mockApiGet.mockRejectedValue(new ApiError('Server error', 'SERVER_ERROR', 500));

      await useSharingStore.getState().fetchSharing();

      const state = useSharingStore.getState();
      expect(state.error).toBe('Server error');
      expect(state.isLoading).toBe(false);
    });

    it('handles non-ApiError errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Network failure'));

      await useSharingStore.getState().fetchSharing();

      const state = useSharingStore.getState();
      expect(state.error).toBe('Failed to fetch sharing data');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('markParticipantPaid', () => {
    beforeEach(() => {
      useSharingStore.setState({
        sharedByMe: [mockSharedExpense],
      });
    });

    it('marks participant as paid and updates local state', async () => {
      const paidResponse = {
        id: 'part-1',
        status: 'PAID' as const,
        paidAt: '2026-01-16T14:00:00Z',
      };

      mockApiPatch.mockResolvedValue(paidResponse);

      const result = await useSharingStore.getState().markParticipantPaid('part-1');

      expect(mockApiPatch).toHaveBeenCalledWith(
        '/expenses/shares/part-1/paid',
        {},
        'test-token'
      );
      expect(result).toEqual(paidResponse);

      const state = useSharingStore.getState();
      expect(state.sharedByMe[0].participants[0].status).toBe('PAID');
      expect(state.sharedByMe[0].participants[0].paidAt).toBe('2026-01-16T14:00:00Z');
    });

    it('only updates the correct participant', async () => {
      const multiParticipantExpense = {
        ...mockSharedExpense,
        participants: [
          { ...mockSharedExpense.participants[0], id: 'part-1' },
          {
            id: 'part-2',
            shareAmount: '25.00',
            sharePercentage: null,
            status: 'PENDING' as const,
            paidAt: null,
            reminderSentAt: null,
            participant: {
              id: 'user-3',
              email: 'other@example.com',
              displayName: 'Other',
            },
          },
        ],
      };
      useSharingStore.setState({ sharedByMe: [multiParticipantExpense] });

      mockApiPatch.mockResolvedValue({
        id: 'part-1',
        status: 'PAID',
        paidAt: '2026-01-16T14:00:00Z',
      });

      await useSharingStore.getState().markParticipantPaid('part-1');

      const state = useSharingStore.getState();
      expect(state.sharedByMe[0].participants[0].status).toBe('PAID');
      expect(state.sharedByMe[0].participants[1].status).toBe('PENDING');
    });

    it('throws ApiError on API failure', async () => {
      mockApiPatch.mockRejectedValue(new ApiError('Not found', 'NOT_FOUND', 404));

      await expect(
        useSharingStore.getState().markParticipantPaid('invalid')
      ).rejects.toThrow(ApiError);
    });

    it('throws wrapped error on non-ApiError failure', async () => {
      mockApiPatch.mockRejectedValue(new Error('Network error'));

      await expect(
        useSharingStore.getState().markParticipantPaid('part-1')
      ).rejects.toThrow('Failed to mark share as paid');
    });
  });

  describe('declineShare', () => {
    beforeEach(() => {
      useSharingStore.setState({
        sharedWithMe: [mockParticipation],
      });
    });

    it('declines share and removes from local state', async () => {
      const declineResponse = {
        id: 'part-2',
        status: 'DECLINED' as const,
      };

      mockApiPost.mockResolvedValue(declineResponse);

      const result = await useSharingStore.getState().declineShare('part-2');

      expect(mockApiPost).toHaveBeenCalledWith(
        '/expenses/shares/part-2/decline',
        {},
        'test-token'
      );
      expect(result).toEqual(declineResponse);

      const state = useSharingStore.getState();
      expect(state.sharedWithMe).toHaveLength(0);
    });

    it('only removes the declined participation', async () => {
      const otherParticipation = {
        ...mockParticipation,
        id: 'part-3',
      };
      useSharingStore.setState({
        sharedWithMe: [mockParticipation, otherParticipation],
      });

      mockApiPost.mockResolvedValue({ id: 'part-2', status: 'DECLINED' });

      await useSharingStore.getState().declineShare('part-2');

      const state = useSharingStore.getState();
      expect(state.sharedWithMe).toHaveLength(1);
      expect(state.sharedWithMe[0].id).toBe('part-3');
    });

    it('throws ApiError on API failure', async () => {
      mockApiPost.mockRejectedValue(new ApiError('Not found', 'NOT_FOUND', 404));

      await expect(
        useSharingStore.getState().declineShare('invalid')
      ).rejects.toThrow(ApiError);
    });

    it('throws wrapped error on non-ApiError failure', async () => {
      mockApiPost.mockRejectedValue(new Error('Network error'));

      await expect(
        useSharingStore.getState().declineShare('part-2')
      ).rejects.toThrow('Failed to decline share');
    });
  });

  describe('cancelSharedExpense', () => {
    beforeEach(() => {
      useSharingStore.setState({
        sharedByMe: [mockSharedExpense],
      });
    });

    it('cancels shared expense and removes from local state', async () => {
      mockApiDelete.mockResolvedValue({ message: 'Shared expense cancelled' });

      await useSharingStore.getState().cancelSharedExpense('share-1');

      expect(mockApiDelete).toHaveBeenCalledWith(
        '/expenses/shares/share-1',
        'test-token'
      );

      const state = useSharingStore.getState();
      expect(state.sharedByMe).toHaveLength(0);
    });

    it('only removes the cancelled expense', async () => {
      const otherExpense = {
        ...mockSharedExpense,
        id: 'share-2',
      };
      useSharingStore.setState({
        sharedByMe: [mockSharedExpense, otherExpense],
      });

      mockApiDelete.mockResolvedValue({ message: 'Cancelled' });

      await useSharingStore.getState().cancelSharedExpense('share-1');

      const state = useSharingStore.getState();
      expect(state.sharedByMe).toHaveLength(1);
      expect(state.sharedByMe[0].id).toBe('share-2');
    });

    it('throws ApiError on API failure', async () => {
      mockApiDelete.mockRejectedValue(new ApiError('Not found', 'NOT_FOUND', 404));

      await expect(
        useSharingStore.getState().cancelSharedExpense('invalid')
      ).rejects.toThrow(ApiError);
    });

    it('throws wrapped error on non-ApiError failure', async () => {
      mockApiDelete.mockRejectedValue(new Error('Network error'));

      await expect(
        useSharingStore.getState().cancelSharedExpense('share-1')
      ).rejects.toThrow('Failed to cancel shared expense');
    });
  });

  describe('sendReminder', () => {
    it('sends reminder successfully', async () => {
      mockApiPost.mockResolvedValue({ message: 'Reminder sent' });

      await useSharingStore.getState().sendReminder('part-1');

      expect(mockApiPost).toHaveBeenCalledWith(
        '/expenses/shares/part-1/remind',
        {},
        'test-token'
      );
    });

    it('throws ApiError on API failure', async () => {
      mockApiPost.mockRejectedValue(new ApiError('Not found', 'NOT_FOUND', 404));

      await expect(
        useSharingStore.getState().sendReminder('invalid')
      ).rejects.toThrow(ApiError);
    });

    it('throws wrapped error on non-ApiError failure', async () => {
      mockApiPost.mockRejectedValue(new Error('Network error'));

      await expect(
        useSharingStore.getState().sendReminder('part-1')
      ).rejects.toThrow('Failed to send reminder');
    });
  });

  describe('lookupUser', () => {
    it('returns user when found', async () => {
      mockApiGet.mockResolvedValue({ user: mockUser });

      const result = await useSharingStore.getState().lookupUser('friend@example.com');

      expect(mockApiGet).toHaveBeenCalledWith(
        '/users/lookup?email=friend%40example.com',
        'test-token'
      );
      expect(result).toEqual(mockUser);
    });

    it('returns null when user not found (404)', async () => {
      mockApiGet.mockRejectedValue(new ApiError('User not found', 'NOT_FOUND', 404));

      const result = await useSharingStore.getState().lookupUser('unknown@example.com');

      expect(result).toBeNull();
    });

    it('throws ApiError on other API errors', async () => {
      mockApiGet.mockRejectedValue(new ApiError('Server error', 'SERVER_ERROR', 500));

      await expect(
        useSharingStore.getState().lookupUser('test@example.com')
      ).rejects.toThrow(ApiError);
    });

    it('throws wrapped error on non-ApiError failure', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'));

      await expect(
        useSharingStore.getState().lookupUser('test@example.com')
      ).rejects.toThrow('Failed to lookup user');
    });

    it('properly encodes email in URL', async () => {
      mockApiGet.mockResolvedValue({ user: mockUser });

      await useSharingStore.getState().lookupUser('user+tag@example.com');

      expect(mockApiGet).toHaveBeenCalledWith(
        '/users/lookup?email=user%2Btag%40example.com',
        'test-token'
      );
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      useSharingStore.setState({ error: 'Some error' });

      useSharingStore.getState().clearError();

      expect(useSharingStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets to initial state', () => {
      useSharingStore.setState({
        sharedByMe: [mockSharedExpense],
        sharedWithMe: [mockParticipation],
        settlementBalances: [mockSettlementBalance],
        isLoading: true,
        error: 'Some error',
      });

      useSharingStore.getState().reset();

      const state = useSharingStore.getState();
      expect(state.sharedByMe).toEqual([]);
      expect(state.sharedWithMe).toEqual([]);
      expect(state.settlementBalances).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('auth token usage', () => {
    it('uses access token from auth store', async () => {
      useAuthStore.setState({ accessToken: 'different-token' });
      mockApiGet.mockResolvedValue({
        sharedExpenses: [],
        expensesSharedWithMe: [],
        settlementBalances: [],
      });

      await useSharingStore.getState().fetchSharing();

      expect(mockApiGet).toHaveBeenCalledWith('/sharing', 'different-token');
    });

    it('works when access token is null', async () => {
      useAuthStore.setState({ accessToken: null });
      mockApiGet.mockResolvedValue({
        sharedExpenses: [],
        expensesSharedWithMe: [],
        settlementBalances: [],
      });

      await useSharingStore.getState().fetchSharing();

      expect(mockApiGet).toHaveBeenCalledWith('/sharing', null);
    });
  });
});
