import { create } from 'zustand';
import { apiGet, apiPost, apiPatch, apiPut, ApiError } from '../services/api';
import { useAuthStore } from './authStore';
import { registerStoreReset } from './storeRegistry';

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  isArchived: boolean;
  isHolding: boolean;
}

export interface CreateCategoryInput {
  name: string;
  type: TransactionType;
  color: string;
}

export interface UpdateCategoryInput {
  id: string;
  name: string;
  color?: string | null;
}

interface CategoriesResponse {
  categories: Category[];
}

interface CategoriesState {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
}

interface CategoriesActions {
  fetchCategories: (type?: TransactionType, includeArchived?: boolean) => Promise<void>;
  createCategory: (data: CreateCategoryInput) => Promise<Category>;
  updateCategory: (data: UpdateCategoryInput) => Promise<Category>;
  archiveCategory: (id: string) => Promise<void>;
  unarchiveCategory: (id: string) => Promise<void>;
  getCategoriesByType: (type: TransactionType) => Category[];
  clearError: () => void;
  reset: () => void;
}

export type CategoriesStore = CategoriesState & CategoriesActions;

const initialState: CategoriesState = {
  categories: [],
  isLoading: false,
  error: null,
};

export const useCategoriesStore = create<CategoriesStore>((set, get) => ({
  ...initialState,

  fetchCategories: async (type?: TransactionType, includeArchived = false) => {
    const accessToken = useAuthStore.getState().accessToken;

    set({ isLoading: true, error: null });

    try {
      const params = new URLSearchParams();
      if (type) {
        params.set('type', type);
      }
      if (includeArchived) {
        params.set('includeArchived', 'true');
      }

      const queryString = params.toString();
      const endpoint = queryString ? `/categories?${queryString}` : '/categories';

      const response = await apiGet<CategoriesResponse>(endpoint, accessToken);

      set({
        categories: response.categories,
        isLoading: false,
      });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to fetch categories';
      set({ error: message, isLoading: false });
    }
  },

  createCategory: async (data: CreateCategoryInput) => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      const category = await apiPost<Category>('/categories', data, accessToken);

      set((state) => {
        const existingIndex = state.categories.findIndex((c) => c.id === category.id);
        if (existingIndex >= 0) {
          const updatedCategories = [...state.categories];
          updatedCategories[existingIndex] = category;
          return { categories: updatedCategories };
        }
        return { categories: [...state.categories, category] };
      });

      return category;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to create category', 'CREATE_FAILED', 0);
    }
  },

  updateCategory: async (data: UpdateCategoryInput) => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      const category = await apiPut<Category>(
        `/categories/${data.id}`,
        { name: data.name, color: data.color },
        accessToken
      );

      set((state) => ({
        categories: state.categories.map((c) =>
          c.id === data.id ? category : c
        ),
      }));

      return category;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to update category', 'UPDATE_FAILED', 0);
    }
  },

  archiveCategory: async (id: string) => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      await apiPatch<{ id: string; isArchived: boolean }>(
        `/categories/${id}/archive`,
        { isArchived: true },
        accessToken
      );

      set((state) => ({
        categories: state.categories.map((c) =>
          c.id === id ? { ...c, isArchived: true } : c
        ),
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to archive category', 'ARCHIVE_FAILED', 0);
    }
  },

  unarchiveCategory: async (id: string) => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      await apiPatch<{ id: string; isArchived: boolean }>(
        `/categories/${id}/archive`,
        { isArchived: false },
        accessToken
      );

      set((state) => ({
        categories: state.categories.map((c) =>
          c.id === id ? { ...c, isArchived: false } : c
        ),
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to unarchive category', 'UNARCHIVE_FAILED', 0);
    }
  },

  getCategoriesByType: (type: TransactionType) => {
    return get().categories.filter((c) => c.type === type && !c.isArchived);
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({ ...initialState });
  },
}));

// Register for cleanup on logout
registerStoreReset(() => useCategoriesStore.getState().reset());
