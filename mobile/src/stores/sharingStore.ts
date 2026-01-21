import { create } from 'zustand';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '../services/api';
import { useAuthStore } from './authStore';
import { registerStoreReset } from './storeRegistry';
import type { Currency } from '../types';

export type SplitType = 'EQUAL' | 'PERCENTAGE' | 'FIXED';
export type ShareStatus = 'PENDING' | 'PAID' | 'DECLINED';

export interface ShareUser {
  id?: string;
  email: string;
  displayName?: string | null;
}

export interface ShareParticipant {
  id: string;
  shareAmount: string;
  sharePercentage?: string | null;
  status: ShareStatus;
  paidAt?: string | null;
  reminderSentAt?: string | null;
  participant: ShareUser;
}

export interface SharedExpenseTransaction {
  id: string;
  date: string;
  description: string | null;
  category: {
    id: string;
    name: string;
  };
}

export interface SharedExpense {
  id: string;
  transactionId: string;
  splitType: SplitType;
  description: string | null;
  totalAmount: string;
  currency: Currency;
  createdAt: string;
  transaction: SharedExpenseTransaction;
  participants: ShareParticipant[];
  totalOwed: string;
  totalPaid: string;
  allSettled: boolean;
}

export interface SharedWithMeParticipation {
  id: string;
  shareAmount: string;
  sharePercentage?: string | null;
  status: ShareStatus;
  paidAt?: string | null;
  sharedExpense: {
    id: string;
    splitType: SplitType;
    totalAmount: string;
    currency: Currency;
    description: string | null;
    createdAt: string;
    transaction: SharedExpenseTransaction;
    owner: ShareUser;
  };
}

export interface SettlementBalance {
  userId: string;
  userEmail: string;
  userDisplayName: string | null;
  currency: Currency;
  youOwe: string;
  theyOwe: string;
  netBalance: string;
}

export interface CreateSharedExpenseParticipant {
  email: string;
  shareAmount: number;
  sharePercentage?: number;
}

export interface CreateSharedExpenseInput {
  transactionId: string;
  splitType: SplitType;
  description: string;
  participants: CreateSharedExpenseParticipant[];
}

export interface CreateSharedExpenseResponse {
  id: string;
  transactionId: string;
  splitType: SplitType;
  totalAmount: string;
  currency: Currency;
  description: string | null;
  createdAt: string;
  participants: {
    id: string;
    userId: string;
    email: string;
    displayName: string | null;
    shareAmount: string;
    sharePercentage: string | null;
    status: ShareStatus;
  }[];
}

export interface CreateShareResponse {
  sharedExpenseId: string;
  participants: ShareParticipant[];
}

export interface MarkPaidResponse {
  id: string;
  status: ShareStatus;
  paidAt: string | null;
}

export interface DeclineShareResponse {
  id: string;
  status: ShareStatus;
}

export interface UserLookupResponse {
  user: ShareUser;
}

interface SharingResponse {
  sharedExpenses: SharedExpense[];
  expensesSharedWithMe: SharedWithMeParticipation[];
  settlementBalances: SettlementBalance[];
}

interface SharingState {
  sharedByMe: SharedExpense[];
  sharedWithMe: SharedWithMeParticipation[];
  settlementBalances: SettlementBalance[];
  isLoading: boolean;
  error: string | null;
}

interface SharingActions {
  fetchSharing: () => Promise<void>;
  createSharedExpense: (input: CreateSharedExpenseInput) => Promise<CreateSharedExpenseResponse>;
  markParticipantPaid: (participantId: string) => Promise<MarkPaidResponse>;
  declineShare: (participantId: string) => Promise<DeclineShareResponse>;
  cancelSharedExpense: (sharedExpenseId: string) => Promise<void>;
  sendReminder: (participantId: string) => Promise<void>;
  lookupUser: (email: string) => Promise<ShareUser | null>;
  clearError: () => void;
  reset: () => void;
}

export type SharingStore = SharingState & SharingActions;

const initialState: SharingState = {
  sharedByMe: [],
  sharedWithMe: [],
  settlementBalances: [],
  isLoading: false,
  error: null,
};

export const useSharingStore = create<SharingStore>((set, _get) => ({
  ...initialState,

  fetchSharing: async () => {
    const accessToken = useAuthStore.getState().accessToken;

    set({ isLoading: true, error: null });

    try {
      const response = await apiGet<SharingResponse>('/sharing', accessToken);

      set({
        sharedByMe: response.sharedExpenses,
        sharedWithMe: response.expensesSharedWithMe,
        settlementBalances: response.settlementBalances,
        isLoading: false,
      });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to fetch sharing data';
      set({ error: message, isLoading: false });
    }
  },

  createSharedExpense: async (input: CreateSharedExpenseInput) => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      const response = await apiPost<CreateSharedExpenseResponse>(
        '/expenses/share',
        {
          transactionId: input.transactionId,
          splitType: input.splitType,
          description: input.description || undefined,
          participants: input.participants.map((p) => ({
            email: p.email,
            shareAmount: p.shareAmount,
            ...(input.splitType === 'PERCENTAGE' && p.sharePercentage != null
              ? { sharePercentage: p.sharePercentage }
              : {}),
          })),
        },
        accessToken
      );

      // Refetch sharing data to update local state with the new shared expense
      const get = useSharingStore.getState;
      await get().fetchSharing();

      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to create shared expense', 'CREATE_SHARE_FAILED', 0);
    }
  },

  markParticipantPaid: async (participantId: string) => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      const response = await apiPatch<MarkPaidResponse>(
        `/expenses/shares/${participantId}/paid`,
        {},
        accessToken
      );

      set((state) => ({
        sharedByMe: state.sharedByMe.map((expense) => ({
          ...expense,
          participants: expense.participants.map((p) =>
            p.id === participantId
              ? { ...p, status: response.status, paidAt: response.paidAt }
              : p
          ),
        })),
      }));

      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to mark share as paid', 'MARK_PAID_FAILED', 0);
    }
  },

  declineShare: async (participantId: string) => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      const response = await apiPost<DeclineShareResponse>(
        `/expenses/shares/${participantId}/decline`,
        {},
        accessToken
      );

      set((state) => ({
        sharedWithMe: state.sharedWithMe.filter((p) => p.id !== participantId),
      }));

      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to decline share', 'DECLINE_FAILED', 0);
    }
  },

  cancelSharedExpense: async (sharedExpenseId: string) => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      await apiDelete<{ message: string }>(
        `/expenses/shares/${sharedExpenseId}`,
        accessToken
      );

      set((state) => ({
        sharedByMe: state.sharedByMe.filter((e) => e.id !== sharedExpenseId),
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to cancel shared expense', 'CANCEL_FAILED', 0);
    }
  },

  sendReminder: async (participantId: string) => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      await apiPost<{ message: string }>(
        `/expenses/shares/${participantId}/remind`,
        {},
        accessToken
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to send reminder', 'REMINDER_FAILED', 0);
    }
  },

  lookupUser: async (email: string) => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      const params = new URLSearchParams();
      params.set('email', email);

      const response = await apiGet<UserLookupResponse>(
        `/users/lookup?${params.toString()}`,
        accessToken
      );

      return response.user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to lookup user', 'LOOKUP_FAILED', 0);
    }
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({ ...initialState });
  },
}));

// Register for cleanup on logout
registerStoreReset(() => useSharingStore.getState().reset());
