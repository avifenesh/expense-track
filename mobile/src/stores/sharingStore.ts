import { create } from 'zustand';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '../services/api';
import { useAuthStore } from './authStore';
import type { Currency } from '../types';

export type SplitType = 'EQUAL' | 'PERCENTAGE' | 'FIXED';
export type ShareStatus = 'PENDING' | 'PAID' | 'DECLINED';

export interface ShareUser {
  id?: string;
  email: string;
  displayName?: string;
}

export interface ShareParticipant {
  id: string;
  userId?: string;
  user?: ShareUser;
  email: string;
  shareAmount: string;
  status: ShareStatus;
  paidAt?: string;
}

export interface SharedExpense {
  id: string;
  transactionId: string;
  splitType: SplitType;
  description: string;
  totalAmount: string;
  currency: Currency;
  createdAt: string;
  participants: ShareParticipant[];
}

export interface SharedWithMeParticipation {
  id: string;
  shareAmount: string;
  status: ShareStatus;
  sharedExpense: {
    id: string;
    description: string;
    totalAmount: string;
    currency: Currency;
    owner: ShareUser;
  };
}

export interface CreateSharedExpenseInput {
  transactionId: string;
  splitType: SplitType;
  description: string;
  participants: {
    email: string;
    shareAmount: number;
  }[];
}

export interface CreateShareResponse {
  sharedExpenseId: string;
  participants: ShareParticipant[];
}

export interface MarkPaidResponse {
  id: string;
  status: ShareStatus;
  paidAt: string;
}

export interface DeclineShareResponse {
  id: string;
  status: ShareStatus;
}

export interface UserLookupResponse {
  user: ShareUser;
}

interface SharedByMeResponse {
  sharedExpenses: SharedExpense[];
}

interface SharedWithMeResponse {
  participations: SharedWithMeParticipation[];
}

interface SharingState {
  sharedByMe: SharedExpense[];
  sharedWithMe: SharedWithMeParticipation[];
  isLoading: boolean;
  error: string | null;
}

interface SharingActions {
  fetchSharedByMe: () => Promise<void>;
  fetchSharedWithMe: () => Promise<void>;
  fetchAll: () => Promise<void>;
  createSharedExpense: (data: CreateSharedExpenseInput) => Promise<CreateShareResponse>;
  markShareAsPaid: (participantId: string) => Promise<MarkPaidResponse>;
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
  isLoading: false,
  error: null,
};

export const useSharingStore = create<SharingStore>((set, get) => ({
  ...initialState,

  fetchSharedByMe: async () => {
    const accessToken = useAuthStore.getState().accessToken;

    set({ isLoading: true, error: null });

    try {
      const response = await apiGet<SharedByMeResponse>(
        '/expenses/shared-by-me',
        accessToken
      );

      set({
        sharedByMe: response.sharedExpenses,
        isLoading: false,
      });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to fetch shared expenses';
      set({ error: message, isLoading: false });
    }
  },

  fetchSharedWithMe: async () => {
    const accessToken = useAuthStore.getState().accessToken;

    set({ isLoading: true, error: null });

    try {
      const response = await apiGet<SharedWithMeResponse>(
        '/expenses/shared-with-me',
        accessToken
      );

      set({
        sharedWithMe: response.participations,
        isLoading: false,
      });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to fetch expenses shared with you';
      set({ error: message, isLoading: false });
    }
  },

  fetchAll: async () => {
    const accessToken = useAuthStore.getState().accessToken;

    set({ isLoading: true, error: null });

    try {
      const [sharedByMeResponse, sharedWithMeResponse] = await Promise.all([
        apiGet<SharedByMeResponse>('/expenses/shared-by-me', accessToken),
        apiGet<SharedWithMeResponse>('/expenses/shared-with-me', accessToken),
      ]);

      set({
        sharedByMe: sharedByMeResponse.sharedExpenses,
        sharedWithMe: sharedWithMeResponse.participations,
        isLoading: false,
      });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to fetch sharing data';
      set({ error: message, isLoading: false });
    }
  },

  createSharedExpense: async (data: CreateSharedExpenseInput) => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      const response = await apiPost<CreateShareResponse>(
        '/expenses/share',
        data,
        accessToken
      );

      // Refresh the list in background - don't block on failure
      get().fetchSharedByMe().catch(() => {
        // Refresh failure is non-critical; the create succeeded
      });

      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to share expense', 'SHARE_FAILED', 0);
    }
  },

  markShareAsPaid: async (participantId: string) => {
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
