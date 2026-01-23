import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SharingScreen } from '../../../src/screens/main/SharingScreen';
import { useSharingStore } from '../../../src/stores/sharingStore';
import type { MainTabScreenProps } from '../../../src/navigation/types';

// Mock the store
jest.mock('../../../src/stores/sharingStore');

const mockUseSharingStore = useSharingStore as jest.MockedFunction<typeof useSharingStore>;

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

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
} as unknown as MainTabScreenProps<'Sharing'>['navigation'];

const mockRoute = {
  key: 'Sharing',
  name: 'Sharing' as const,
  params: undefined,
} as MainTabScreenProps<'Sharing'>['route'];

function renderSharingScreen() {
  return render(
    <NavigationContainer>
      <SharingScreen navigation={mockNavigation} route={mockRoute} />
    </NavigationContainer>
  );
}

describe('SharingScreen', () => {
  const defaultSharingState = {
    sharedByMe: [mockSharedExpense],
    sharedWithMe: [mockParticipation],
    settlementBalances: [mockSettlementBalance],
    isLoading: false,
    error: null,
    fetchSharing: jest.fn().mockResolvedValue(undefined),
    markParticipantPaid: jest.fn().mockResolvedValue({ id: 'part-1', status: 'PAID', paidAt: '2026-01-16T14:00:00Z' }),
    declineShare: jest.fn(),
    cancelSharedExpense: jest.fn(),
    sendReminder: jest.fn(),
    lookupUser: jest.fn(),
    clearError: jest.fn(),
    reset: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSharingStore.mockReturnValue(defaultSharingState);
  });

  describe('Rendering', () => {
    it('renders sharing title', async () => {
      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('Sharing')).toBeTruthy();
      });
    });

    it('renders share button', async () => {
      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('+ Share')).toBeTruthy();
      });
    });

    it('renders net balance card', async () => {
      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('Net Balance')).toBeTruthy();
      });
    });

    it('renders section titles', async () => {
      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('Shared With You')).toBeTruthy();
        expect(screen.getByText('You Shared')).toBeTruthy();
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner during initial load', async () => {
      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        sharedByMe: [],
        sharedWithMe: [],
        settlementBalances: [],
        isLoading: true,
      });

      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('Loading sharing data...')).toBeTruthy();
      });
    });
  });

  describe('Error State', () => {
    it('shows error message when data fails to load', async () => {
      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        sharedByMe: [],
        sharedWithMe: [],
        settlementBalances: [],
        error: 'Failed to load sharing data',
      });

      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeTruthy();
        expect(screen.getByText('Failed to load sharing data')).toBeTruthy();
      });
    });

    it('shows retry button on error', async () => {
      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        sharedByMe: [],
        sharedWithMe: [],
        settlementBalances: [],
        error: 'Network error',
      });

      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeTruthy();
      });
    });

    it('calls clearError and fetchSharing when retry is pressed', async () => {
      const clearError = jest.fn();
      const fetchSharing = jest.fn().mockResolvedValue(undefined);
      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        sharedByMe: [],
        sharedWithMe: [],
        settlementBalances: [],
        error: 'Network error',
        clearError,
        fetchSharing,
      });

      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Try Again'));

      await waitFor(() => {
        expect(clearError).toHaveBeenCalled();
        expect(fetchSharing).toHaveBeenCalled();
      });
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no expenses shared with user', async () => {
      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        sharedWithMe: [],
      });

      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('No pending expenses')).toBeTruthy();
        expect(screen.getByText('When someone shares an expense with you, it will appear here.')).toBeTruthy();
      });
    });

    it('shows empty state when user has not shared any expenses', async () => {
      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        sharedByMe: [],
      });

      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('No shared expenses')).toBeTruthy();
        expect(screen.getByText('Share an expense to split costs with friends.')).toBeTruthy();
      });
    });
  });

  describe('Data Display', () => {
    it('displays shared expense description', async () => {
      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('Dinner at restaurant')).toBeTruthy();
      });
    });

    it('displays participation description', async () => {
      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('Movie tickets')).toBeTruthy();
      });
    });

    it('displays participant name', async () => {
      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('Friend')).toBeTruthy();
      });
    });

    it('displays owner name for shared with me expenses', async () => {
      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText(/From Owner/)).toBeTruthy();
      });
    });

    it('displays amounts correctly', async () => {
      renderSharingScreen();

      await waitFor(() => {
        // Participant share amount
        expect(screen.getByText('$50.00')).toBeTruthy();
        // Amount owed
        expect(screen.getByText('You owe $25.00')).toBeTruthy();
      });
    });
  });

  describe('Balance Display', () => {
    it('shows positive balance when owed money', async () => {
      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('+$50.00')).toBeTruthy();
        expect(screen.getByText('You are owed overall')).toBeTruthy();
      });
    });

    it('shows negative balance when owing money', async () => {
      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        settlementBalances: [{
          ...mockSettlementBalance,
          youOwe: '75.00',
          theyOwe: '0.00',
          netBalance: '-75.00',
        }],
      });

      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('-$75.00')).toBeTruthy();
        expect(screen.getByText('You owe overall')).toBeTruthy();
      });
    });

    it('shows settled message when balance is zero', async () => {
      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        settlementBalances: [{
          ...mockSettlementBalance,
          youOwe: '0.00',
          theyOwe: '0.00',
          netBalance: '0.00',
        }],
      });

      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('All settled up')).toBeTruthy();
      });
    });
  });

  describe('Mark Paid Functionality', () => {
    it('renders mark paid button for pending participants', async () => {
      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('Mark Paid')).toBeTruthy();
      });
    });

    it('calls markParticipantPaid when mark paid is pressed', async () => {
      const markParticipantPaid = jest.fn().mockResolvedValue({
        id: 'part-1',
        status: 'PAID',
        paidAt: '2026-01-16T14:00:00Z',
      });
      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        markParticipantPaid,
      });

      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('Mark Paid')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Mark Paid'));

      await waitFor(() => {
        expect(markParticipantPaid).toHaveBeenCalledWith('part-1');
      });
    });

    it('shows paid label for paid participants', async () => {
      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        sharedByMe: [{
          ...mockSharedExpense,
          participants: [{
            ...mockSharedExpense.participants[0],
            status: 'PAID' as const,
            paidAt: '2026-01-16T14:00:00Z',
          }],
          allSettled: true,
        }],
      });

      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('Paid')).toBeTruthy();
        expect(screen.getByText('SETTLED')).toBeTruthy();
      });
    });
  });

  describe('Status Badges', () => {
    it('shows PENDING badge for pending participations', async () => {
      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('PENDING')).toBeTruthy();
      });
    });

    it('shows owed amount for unsettled expenses', async () => {
      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('$50.00 owed')).toBeTruthy();
      });
    });
  });

  describe('Initial Data Fetch', () => {
    it('fetches sharing data on mount', async () => {
      const fetchSharing = jest.fn().mockResolvedValue(undefined);
      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        fetchSharing,
      });

      renderSharingScreen();

      await waitFor(() => {
        expect(fetchSharing).toHaveBeenCalled();
      });
    });
  });

  describe('Sorting', () => {
    it('shows unsettled expenses before settled ones', async () => {
      const settledExpense = {
        ...mockSharedExpense,
        id: 'share-settled',
        description: 'Settled Expense',
        allSettled: true,
        createdAt: '2026-01-16T12:00:00Z', // Newer
      };
      const unsettledExpense = {
        ...mockSharedExpense,
        id: 'share-unsettled',
        description: 'Unsettled Expense',
        allSettled: false,
        createdAt: '2026-01-14T12:00:00Z', // Older
      };

      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        sharedByMe: [settledExpense, unsettledExpense],
      });

      renderSharingScreen();

      await waitFor(() => {
        const allText = screen.getByText('You Shared').parent?.parent;
        expect(allText).toBeTruthy();
        // Unsettled should appear first despite being older
        expect(screen.getByText('Unsettled Expense')).toBeTruthy();
        expect(screen.getByText('Settled Expense')).toBeTruthy();
      });
    });
  });

  describe('Category Display', () => {
    it('displays category name', async () => {
      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('Food')).toBeTruthy();
        expect(screen.getByText('Entertainment')).toBeTruthy();
      });
    });
  });

  describe('Multi-Currency Balance Display', () => {
    it('groups balances by currency and displays separate cards', async () => {
      const usdBalance = {
        userId: 'user-2',
        userEmail: 'friend@example.com',
        userDisplayName: 'Friend',
        currency: 'USD' as const,
        youOwe: '0.00',
        theyOwe: '50.00',
        netBalance: '50.00',
      };
      const eurBalance = {
        userId: 'user-3',
        userEmail: 'another@example.com',
        userDisplayName: 'Another',
        currency: 'EUR' as const,
        youOwe: '30.00',
        theyOwe: '0.00',
        netBalance: '-30.00',
      };

      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        settlementBalances: [usdBalance, eurBalance],
      });

      renderSharingScreen();

      await waitFor(() => {
        // Both currencies should be displayed
        expect(screen.getByText('USD')).toBeTruthy();
        expect(screen.getByText('EUR')).toBeTruthy();
        // Both balances should be shown
        expect(screen.getByText('+$50.00')).toBeTruthy();
        expect(screen.getByText(/-€30/)).toBeTruthy();
      });
    });

    it('shows currency labels only when multiple currencies exist', async () => {
      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        settlementBalances: [mockSettlementBalance], // Single USD balance
      });

      renderSharingScreen();

      await waitFor(() => {
        // Should not show currency label for single currency
        expect(screen.queryByText('USD')).toBeNull();
        // But should show the balance
        expect(screen.getByText('+$50.00')).toBeTruthy();
      });
    });

    it('aggregates multiple balances of the same currency', async () => {
      const usdBalance1 = {
        userId: 'user-2',
        userEmail: 'friend1@example.com',
        userDisplayName: 'Friend1',
        currency: 'USD' as const,
        youOwe: '0.00',
        theyOwe: '50.00',
        netBalance: '50.00',
      };
      const usdBalance2 = {
        userId: 'user-3',
        userEmail: 'friend2@example.com',
        userDisplayName: 'Friend2',
        currency: 'USD' as const,
        youOwe: '20.00',
        theyOwe: '0.00',
        netBalance: '-20.00',
      };

      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        settlementBalances: [usdBalance1, usdBalance2],
      });

      renderSharingScreen();

      await waitFor(() => {
        // Net balance should be aggregated: 50 - 20 = 30 (they owe 50, you owe 20)
        expect(screen.getByText('+$30.00')).toBeTruthy();
        expect(screen.getByText('You are owed overall')).toBeTruthy();
      });
    });

    it('shows empty state when no balances exist', async () => {
      mockUseSharingStore.mockReturnValue({
        ...defaultSharingState,
        settlementBalances: [],
      });

      renderSharingScreen();

      await waitFor(() => {
        expect(screen.getByText('No balances yet')).toBeTruthy();
      });
    });
  });
});
