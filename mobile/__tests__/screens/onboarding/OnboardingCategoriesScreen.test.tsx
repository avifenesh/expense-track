import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OnboardingCategoriesScreen } from '../../../src/screens/onboarding/OnboardingCategoriesScreen';

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
};

const mockRoute = {
  key: 'OnboardingCategories',
  name: 'OnboardingCategories' as const,
  params: undefined,
};

describe('OnboardingCategoriesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders step indicator correctly', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Step 2 of 5')).toBeTruthy();
  });

  it('renders title correctly', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Categories')).toBeTruthy();
  });

  it('renders subtitle correctly', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Select the expense categories you want to track')).toBeTruthy();
  });

  it('renders Food & Dining category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Food & Dining')).toBeTruthy();
  });

  it('renders Transportation category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Transportation')).toBeTruthy();
  });

  it('renders Shopping category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Shopping')).toBeTruthy();
  });

  it('renders Entertainment category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Entertainment')).toBeTruthy();
  });

  it('renders Bills & Utilities category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Bills & Utilities')).toBeTruthy();
  });

  it('renders Healthcare category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Healthcare')).toBeTruthy();
  });

  it('renders Education category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Education')).toBeTruthy();
  });

  it('renders Travel category', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Travel')).toBeTruthy();
  });

  it('renders all 8 default categories', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation as any} route={mockRoute} />);

    const categories = [
      'Food & Dining',
      'Transportation',
      'Shopping',
      'Entertainment',
      'Bills & Utilities',
      'Healthcare',
      'Education',
      'Travel',
    ];

    categories.forEach((category) => {
      expect(screen.getByText(category)).toBeTruthy();
    });
  });

  it('renders Continue button', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('navigates to OnboardingBudget when Continue is pressed', () => {
    render(<OnboardingCategoriesScreen navigation={mockNavigation as any} route={mockRoute} />);

    const continueButton = screen.getByText('Continue');
    fireEvent.press(continueButton);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('OnboardingBudget');
  });
});
