import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { OnboardingCompleteScreen } from '../../../src/screens/onboarding/OnboardingCompleteScreen';
import { useOnboardingStore } from '../../../src/stores';
import type { OnboardingScreenProps } from '../../../src/navigation/types';

jest.mock('../../../src/stores', () => ({
  useOnboardingStore: jest.fn(),
}));

const mockUseOnboardingStore = useOnboardingStore as unknown as jest.Mock;

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  reset: jest.fn(),
  setParams: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  isFocused: jest.fn(),
  canGoBack: jest.fn(),
  getId: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
} as unknown as OnboardingScreenProps<'OnboardingComplete'>['navigation'];

const mockRoute = {
  key: 'OnboardingComplete',
  name: 'OnboardingComplete' as const,
  params: undefined,
} as OnboardingScreenProps<'OnboardingComplete'>['route'];

const defaultStoreState = {
  selectedCurrency: 'USD',
  selectedCategories: [],
  monthlyBudget: null,
  wantsSampleData: false,
  isCompleting: false,
  error: null,
  completeOnboarding: jest.fn().mockResolvedValue(true),
};

describe('OnboardingCompleteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOnboardingStore.mockReturnValue(defaultStoreState);
  });

  it('renders step indicator correctly', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Step 5 of 6')).toBeTruthy();
  });

  it('renders title correctly', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('All Set!')).toBeTruthy();
  });

  it('renders subtitle correctly', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Your expense tracker is ready to use')).toBeTruthy();
  });

  it('renders success checkmark', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    const checkmarks = screen.getAllByText(/✓/);
    expect(checkmarks.length).toBeGreaterThan(0);
  });

  it('renders Currency summary item', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Currency')).toBeTruthy();
    expect(screen.getByText('USD')).toBeTruthy();
  });

  it('renders Categories summary item with none selected', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Categories')).toBeTruthy();
    expect(screen.getByText('None selected')).toBeTruthy();
  });

  it('renders Categories summary item with categories selected', () => {
    mockUseOnboardingStore.mockReturnValue({
      ...defaultStoreState,
      selectedCategories: ['Food & Dining', 'Transportation', 'Shopping'],
    });

    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Categories')).toBeTruthy();
    expect(screen.getByText('3 selected')).toBeTruthy();
  });

  it('renders Monthly Budget summary item when not set', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Monthly Budget')).toBeTruthy();
    expect(screen.getByText('Not set')).toBeTruthy();
  });

  it('renders Monthly Budget summary item when set', () => {
    mockUseOnboardingStore.mockReturnValue({
      ...defaultStoreState,
      monthlyBudget: 2000,
    });

    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Monthly Budget')).toBeTruthy();
    expect(screen.getByText('$2,000')).toBeTruthy();
  });

  it('renders Sample Data summary item', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Sample Data')).toBeTruthy();
    expect(screen.getByText('No')).toBeTruthy();
  });

  it('renders Sample Data as Yes when selected', () => {
    mockUseOnboardingStore.mockReturnValue({
      ...defaultStoreState,
      wantsSampleData: true,
    });

    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Sample Data')).toBeTruthy();
    expect(screen.getByText('Yes')).toBeTruthy();
  });

  it('renders all summary items', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Currency')).toBeTruthy();
    expect(screen.getByText('Categories')).toBeTruthy();
    expect(screen.getByText('Monthly Budget')).toBeTruthy();
    expect(screen.getByText('Sample Data')).toBeTruthy();
  });

  it('renders Get Started button', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Get Started')).toBeTruthy();
  });

  it('calls completeOnboarding and navigates on button press', async () => {
    const mockCompleteOnboarding = jest.fn().mockResolvedValue(true);
    mockUseOnboardingStore.mockReturnValue({
      ...defaultStoreState,
      completeOnboarding: mockCompleteOnboarding,
    });

    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    fireEvent.press(screen.getByText('Get Started'));

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalled();
      expect(mockNavigation.navigate).toHaveBeenCalledWith('OnboardingBiometric');
    });
  });

  it('does not navigate when completeOnboarding returns false', async () => {
    const mockCompleteOnboarding = jest.fn().mockResolvedValue(false);
    mockUseOnboardingStore.mockReturnValue({
      ...defaultStoreState,
      completeOnboarding: mockCompleteOnboarding,
    });

    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    fireEvent.press(screen.getByText('Get Started'));

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalled();
    });

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('shows loading indicator when completing', () => {
    mockUseOnboardingStore.mockReturnValue({
      ...defaultStoreState,
      isCompleting: true,
    });

    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    // When loading, the "Get Started" text should not be visible
    expect(screen.queryByText('Get Started')).toBeNull();
  });

  it('displays error message when present', () => {
    mockUseOnboardingStore.mockReturnValue({
      ...defaultStoreState,
      error: 'Something went wrong',
    });

    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('displays EUR currency correctly', () => {
    mockUseOnboardingStore.mockReturnValue({
      ...defaultStoreState,
      selectedCurrency: 'EUR',
      monthlyBudget: 1500,
    });

    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('EUR')).toBeTruthy();
    // EUR symbol
    expect(screen.getByText(/€1,500/)).toBeTruthy();
  });
});
