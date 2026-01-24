import { useCategoriesStore } from '../../src/stores/categoriesStore';
import { useAuthStore } from '../../src/stores/authStore';
import { ApiError, apiGet, apiPost, apiPatch, apiPut } from '../../src/services/api';

jest.mock('../../src/services/api', () => {
  const actual = jest.requireActual('../../src/services/api');
  return {
    ...actual,
    apiGet: jest.fn(),
    apiPost: jest.fn(),
    apiPatch: jest.fn(),
    apiPut: jest.fn(),
  };
});

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;
const mockApiPatch = apiPatch as jest.MockedFunction<typeof apiPatch>;
const mockApiPut = apiPut as jest.MockedFunction<typeof apiPut>;

const mockCategory = {
  id: 'cat-1',
  name: 'Groceries',
  type: 'EXPENSE' as const,
  color: '#4CAF50',
  isArchived: false,
  isHolding: false,
};

const mockIncomeCategory = {
  id: 'cat-2',
  name: 'Salary',
  type: 'INCOME' as const,
  color: '#2196F3',
  isArchived: false,
  isHolding: false,
};

describe('categoriesStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCategoriesStore.getState().reset();
    useAuthStore.setState({ accessToken: 'test-token' });
  });

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useCategoriesStore.getState();
      expect(state.categories).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchCategories', () => {
    it('fetches categories successfully', async () => {
      mockApiGet.mockResolvedValue({
        categories: [mockCategory, mockIncomeCategory],
      });

      await useCategoriesStore.getState().fetchCategories();

      const state = useCategoriesStore.getState();
      expect(state.categories).toHaveLength(2);
      expect(state.categories[0]).toEqual(mockCategory);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('fetches categories with type filter', async () => {
      mockApiGet.mockResolvedValue({
        categories: [mockCategory],
      });

      await useCategoriesStore.getState().fetchCategories('EXPENSE');

      expect(mockApiGet).toHaveBeenCalledWith('/categories?type=EXPENSE', 'test-token');
    });

    it('fetches categories including archived', async () => {
      mockApiGet.mockResolvedValue({
        categories: [mockCategory],
      });

      await useCategoriesStore.getState().fetchCategories(undefined, true);

      expect(mockApiGet).toHaveBeenCalledWith('/categories?includeArchived=true', 'test-token');
    });

    it('fetches categories with both filters', async () => {
      mockApiGet.mockResolvedValue({
        categories: [mockCategory],
      });

      await useCategoriesStore.getState().fetchCategories('INCOME', true);

      expect(mockApiGet).toHaveBeenCalledWith(
        '/categories?type=INCOME&includeArchived=true',
        'test-token'
      );
    });

    it('handles API errors', async () => {
      mockApiGet.mockRejectedValue(new ApiError('Server error', 'SERVER_ERROR', 500));

      await useCategoriesStore.getState().fetchCategories();

      const state = useCategoriesStore.getState();
      expect(state.error).toBe('Server error');
      expect(state.isLoading).toBe(false);
    });

    it('handles generic errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'));

      await useCategoriesStore.getState().fetchCategories();

      const state = useCategoriesStore.getState();
      expect(state.error).toBe('Failed to fetch categories');
    });

    it('sets isLoading during fetch', async () => {
      let loadingDuringFetch = false;
      mockApiGet.mockImplementation(async () => {
        loadingDuringFetch = useCategoriesStore.getState().isLoading;
        return { categories: [mockCategory] };
      });

      await useCategoriesStore.getState().fetchCategories();

      expect(loadingDuringFetch).toBe(true);
      expect(useCategoriesStore.getState().isLoading).toBe(false);
    });

    it('clears previous error on successful fetch', async () => {
      useCategoriesStore.setState({ error: 'Previous error' });
      mockApiGet.mockResolvedValue({ categories: [mockCategory] });

      await useCategoriesStore.getState().fetchCategories();

      expect(useCategoriesStore.getState().error).toBeNull();
    });

    it('works with null access token', async () => {
      useAuthStore.setState({ accessToken: null });
      mockApiGet.mockResolvedValue({ categories: [mockCategory] });

      await useCategoriesStore.getState().fetchCategories();

      expect(mockApiGet).toHaveBeenCalledWith('/categories', null);
    });
  });

  describe('createCategory', () => {
    it('creates category successfully', async () => {
      mockApiPost.mockResolvedValue(mockCategory);

      const result = await useCategoriesStore.getState().createCategory({
        name: 'Groceries',
        type: 'EXPENSE',
        color: '#4CAF50',
      });

      expect(result).toEqual(mockCategory);
      const state = useCategoriesStore.getState();
      expect(state.categories).toHaveLength(1);
      expect(state.categories[0]).toEqual(mockCategory);
    });

    it('calls correct API endpoint', async () => {
      mockApiPost.mockResolvedValue(mockCategory);

      await useCategoriesStore.getState().createCategory({
        name: 'Groceries',
        type: 'EXPENSE',
        color: '#4CAF50',
      });

      expect(mockApiPost).toHaveBeenCalledWith(
        '/categories',
        { name: 'Groceries', type: 'EXPENSE', color: '#4CAF50' },
        'test-token'
      );
    });

    it('throws ApiError on failure', async () => {
      mockApiPost.mockRejectedValue(new ApiError('Duplicate name', 'VALIDATION_ERROR', 400));

      await expect(
        useCategoriesStore.getState().createCategory({
          name: 'Groceries',
          type: 'EXPENSE',
          color: '#4CAF50',
        })
      ).rejects.toThrow('Duplicate name');
    });

    it('wraps generic errors', async () => {
      mockApiPost.mockRejectedValue(new Error('Network error'));

      await expect(
        useCategoriesStore.getState().createCategory({
          name: 'Groceries',
          type: 'EXPENSE',
          color: '#4CAF50',
        })
      ).rejects.toThrow('Failed to create category');
    });

    it('appends category to existing list', async () => {
      useCategoriesStore.setState({ categories: [mockIncomeCategory] });
      mockApiPost.mockResolvedValue(mockCategory);

      await useCategoriesStore.getState().createCategory({
        name: 'Groceries',
        type: 'EXPENSE',
        color: '#4CAF50',
      });

      const state = useCategoriesStore.getState();
      expect(state.categories).toHaveLength(2);
      expect(state.categories[0]).toEqual(mockIncomeCategory);
      expect(state.categories[1]).toEqual(mockCategory);
    });

    it('updates existing category on reactivation instead of appending', async () => {
      const archivedCategory = { ...mockCategory, isArchived: true };
      useCategoriesStore.setState({ categories: [archivedCategory, mockIncomeCategory] });

      const reactivatedCategory = { ...mockCategory, isArchived: false };
      mockApiPost.mockResolvedValue(reactivatedCategory);

      await useCategoriesStore.getState().createCategory({
        name: 'Groceries',
        type: 'EXPENSE',
        color: '#4CAF50',
      });

      const state = useCategoriesStore.getState();
      expect(state.categories).toHaveLength(2);
      expect(state.categories[0]).toEqual(reactivatedCategory);
      expect(state.categories[0].isArchived).toBe(false);
    });
  });

  describe('updateCategory', () => {
    beforeEach(() => {
      useCategoriesStore.setState({
        categories: [mockCategory, mockIncomeCategory],
      });
    });

    it('updates category successfully', async () => {
      const updatedCategory = { ...mockCategory, name: 'Food', color: '#FF5722' };
      mockApiPut.mockResolvedValue(updatedCategory);

      const result = await useCategoriesStore.getState().updateCategory({
        id: 'cat-1',
        name: 'Food',
        color: '#FF5722',
      });

      expect(result).toEqual(updatedCategory);
      const state = useCategoriesStore.getState();
      expect(state.categories.find((c) => c.id === 'cat-1')?.name).toBe('Food');
      expect(state.categories.find((c) => c.id === 'cat-1')?.color).toBe('#FF5722');
    });

    it('calls correct API endpoint', async () => {
      const updatedCategory = { ...mockCategory, name: 'Food' };
      mockApiPut.mockResolvedValue(updatedCategory);

      await useCategoriesStore.getState().updateCategory({
        id: 'cat-1',
        name: 'Food',
        color: '#FF5722',
      });

      expect(mockApiPut).toHaveBeenCalledWith(
        '/categories/cat-1',
        { name: 'Food', color: '#FF5722' },
        'test-token'
      );
    });

    it('updates local state with API response', async () => {
      const updatedCategory = { ...mockCategory, name: 'Updated Name', color: '#123456' };
      mockApiPut.mockResolvedValue(updatedCategory);

      await useCategoriesStore.getState().updateCategory({
        id: 'cat-1',
        name: 'Updated Name',
        color: '#123456',
      });

      const state = useCategoriesStore.getState();
      expect(state.categories).toHaveLength(2);
      expect(state.categories[0]).toEqual(updatedCategory);
      expect(state.categories[1]).toEqual(mockIncomeCategory);
    });

    it('throws ApiError on failure', async () => {
      mockApiPut.mockRejectedValue(new ApiError('Duplicate name', 'VALIDATION_ERROR', 400));

      await expect(
        useCategoriesStore.getState().updateCategory({
          id: 'cat-1',
          name: 'Duplicate',
        })
      ).rejects.toThrow('Duplicate name');
    });

    it('wraps generic errors', async () => {
      mockApiPut.mockRejectedValue(new Error('Network error'));

      await expect(
        useCategoriesStore.getState().updateCategory({
          id: 'cat-1',
          name: 'Food',
        })
      ).rejects.toThrow('Failed to update category');
    });

    it('handles update with null color', async () => {
      const updatedCategory = { ...mockCategory, name: 'Food', color: null };
      mockApiPut.mockResolvedValue(updatedCategory);

      await useCategoriesStore.getState().updateCategory({
        id: 'cat-1',
        name: 'Food',
        color: null,
      });

      expect(mockApiPut).toHaveBeenCalledWith(
        '/categories/cat-1',
        { name: 'Food', color: null },
        'test-token'
      );
    });

    it('does not affect other categories', async () => {
      const updatedCategory = { ...mockCategory, name: 'Updated' };
      mockApiPut.mockResolvedValue(updatedCategory);

      await useCategoriesStore.getState().updateCategory({
        id: 'cat-1',
        name: 'Updated',
      });

      const state = useCategoriesStore.getState();
      expect(state.categories.find((c) => c.id === 'cat-2')).toEqual(mockIncomeCategory);
    });
  });

  describe('archiveCategory', () => {
    beforeEach(() => {
      useCategoriesStore.setState({
        categories: [mockCategory, mockIncomeCategory],
      });
    });

    it('archives category successfully', async () => {
      mockApiPatch.mockResolvedValue({ id: 'cat-1', isArchived: true });

      await useCategoriesStore.getState().archiveCategory('cat-1');

      const state = useCategoriesStore.getState();
      expect(state.categories.find((c) => c.id === 'cat-1')?.isArchived).toBe(true);
      expect(state.categories.find((c) => c.id === 'cat-2')?.isArchived).toBe(false);
    });

    it('calls correct API endpoint', async () => {
      mockApiPatch.mockResolvedValue({ id: 'cat-1', isArchived: true });

      await useCategoriesStore.getState().archiveCategory('cat-1');

      expect(mockApiPatch).toHaveBeenCalledWith(
        '/categories/cat-1/archive',
        { isArchived: true },
        'test-token'
      );
    });

    it('throws ApiError on failure', async () => {
      mockApiPatch.mockRejectedValue(new ApiError('Not found', 'NOT_FOUND', 404));

      await expect(useCategoriesStore.getState().archiveCategory('cat-1')).rejects.toThrow(
        'Not found'
      );
    });

    it('wraps generic errors', async () => {
      mockApiPatch.mockRejectedValue(new Error('Network error'));

      await expect(useCategoriesStore.getState().archiveCategory('cat-1')).rejects.toThrow(
        'Failed to archive category'
      );
    });
  });

  describe('unarchiveCategory', () => {
    beforeEach(() => {
      useCategoriesStore.setState({
        categories: [{ ...mockCategory, isArchived: true }, mockIncomeCategory],
      });
    });

    it('unarchives category successfully', async () => {
      mockApiPatch.mockResolvedValue({ id: 'cat-1', isArchived: false });

      await useCategoriesStore.getState().unarchiveCategory('cat-1');

      const state = useCategoriesStore.getState();
      expect(state.categories.find((c) => c.id === 'cat-1')?.isArchived).toBe(false);
    });

    it('calls correct API endpoint', async () => {
      mockApiPatch.mockResolvedValue({ id: 'cat-1', isArchived: false });

      await useCategoriesStore.getState().unarchiveCategory('cat-1');

      expect(mockApiPatch).toHaveBeenCalledWith(
        '/categories/cat-1/archive',
        { isArchived: false },
        'test-token'
      );
    });

    it('wraps generic errors', async () => {
      mockApiPatch.mockRejectedValue(new Error('Network error'));

      await expect(useCategoriesStore.getState().unarchiveCategory('cat-1')).rejects.toThrow(
        'Failed to unarchive category'
      );
    });
  });

  describe('getCategoriesByType', () => {
    beforeEach(() => {
      useCategoriesStore.setState({
        categories: [
          mockCategory,
          mockIncomeCategory,
          { ...mockCategory, id: 'cat-3', name: 'Archived', isArchived: true },
        ],
      });
    });

    it('returns only expense categories', () => {
      const result = useCategoriesStore.getState().getCategoriesByType('EXPENSE');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cat-1');
    });

    it('returns only income categories', () => {
      const result = useCategoriesStore.getState().getCategoriesByType('INCOME');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cat-2');
    });

    it('excludes archived categories', () => {
      const result = useCategoriesStore.getState().getCategoriesByType('EXPENSE');

      expect(result.some((c) => c.isArchived)).toBe(false);
    });

    it('returns empty array when no categories exist', () => {
      useCategoriesStore.setState({ categories: [] });

      const result = useCategoriesStore.getState().getCategoriesByType('EXPENSE');

      expect(result).toEqual([]);
    });
  });

  describe('clearError', () => {
    it('clears error', () => {
      useCategoriesStore.setState({ error: 'Some error' });

      useCategoriesStore.getState().clearError();

      expect(useCategoriesStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets to initial state', () => {
      useCategoriesStore.setState({
        categories: [mockCategory],
        error: 'Error',
        isLoading: true,
      });

      useCategoriesStore.getState().reset();

      const state = useCategoriesStore.getState();
      expect(state.categories).toEqual([]);
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});
