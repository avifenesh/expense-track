import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OnboardingCategoriesScreen } from '../../../src/screens/onboarding/OnboardingCategoriesScreen';
import type { OnboardingScreenProps } from '../../../src/navigation/types';

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
} as unknown as OnboardingScreenProps<'OnboardingCategories'>['navigation'];

const mockRoute = {
  key: 'OnboardingCategories',
  name: 'OnboardingCategories' as const,
  params: undefined,
} as OnboardingScreenProps<'OnboardingCategories'>['route'];

describe('OnboardingCategoriesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders step indicator correctly', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Step 2 of 5')).toBeTruthy();
  });

  it('renders title correctly', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Categories')).toBeTruthy();
  });

  it('renders subtitle correctly', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Select the expense categories you want to track')).toBeTruthy();
  });

  it('renders Groceries category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Groceries')).toBeTruthy();
  });

  it('renders Transportation category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Transportation')).toBeTruthy();
  });

  it('renders Shopping category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Shopping')).toBeTruthy();
  });

  it('renders Entertainment category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Entertainment')).toBeTruthy();
  });

  it('renders Utilities category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Utilities')).toBeTruthy();
  });

  it('renders Health category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Health')).toBeTruthy();
  });

  it('renders Housing category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Housing')).toBeTruthy();
  });

  it('renders Salary category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Salary')).toBeTruthy();
  });

  it('renders all default categories', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation} route={mockRoute} />);

    // Expense categories from DEFAULT_EXPENSE_CATEGORIES
    const expenseCategories = [
      'Groceries',
      'Dining Out',
      'Transportation',
      'Utilities',
      'Entertainment',
      'Shopping',
      'Health',
      'Housing',
      'Insurance',
      'Subscriptions',
    ];

    // Income categories from DEFAULT_INCOME_CATEGORIES
    const incomeCategories = [
      'Salary',
      'Freelance',
      'Investments',
      'Other Income',
    ];

    expenseCategories.forEach((category) => {
      expect(screen.getByText(category)).toBeTruthy();
    });

    incomeCategories.forEach((category) => {
      expect(screen.getByText(category)).toBeTruthy();
    });
  });

  it('renders Continue button', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('navigates to OnboardingBudget when Continue is pressed', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation} route={mockRoute} />);

    const continueButton = screen.getByText('Continue');
    fireEvent.press(continueButton);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('OnboardingBudget');
  });
});
