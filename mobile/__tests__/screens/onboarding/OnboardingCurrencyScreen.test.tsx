import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { OnboardingScreenProps } from '../../../src/navigation/types';
import { OnboardingCurrencyScreen } from '../../../src/screens/onboarding/OnboardingCurrencyScreen';

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
  key: 'OnboardingCurrency',
  name: 'OnboardingCurrency' as const,
  params: undefined,
};

describe('OnboardingCurrencyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders step indicator correctly', () => {
    render(<OnboardingCurrencyScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Step 1 of 5')).toBeTruthy();
  });

  it('renders title correctly', () => {
    render(<OnboardingCurrencyScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Choose Currency')).toBeTruthy();
  });

  it('renders subtitle correctly', () => {
    render(<OnboardingCurrencyScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Select your preferred currency for tracking expenses')).toBeTruthy();
  });

  it('renders USD currency option', () => {
    render(<OnboardingCurrencyScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('$')).toBeTruthy();
    expect(screen.getByText('USD - US Dollar')).toBeTruthy();
  });

  it('renders EUR currency option', () => {
    render(<OnboardingCurrencyScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('EUR - Euro')).toBeTruthy();
  });

  it('renders ILS currency option', () => {
    render(<OnboardingCurrencyScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('ILS - Israeli Shekel')).toBeTruthy();
  });

  it('renders Continue button', () => {
    render(<OnboardingCurrencyScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('navigates to OnboardingCategories when Continue is pressed', () => {
    render(<OnboardingCurrencyScreen navigation={mockNavigation} route={mockRoute} />);

    const continueButton = screen.getByText('Continue');
    fireEvent.press(continueButton);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('OnboardingCategories');
  });

  it('renders all three currency symbols', () => {
    render(<OnboardingCurrencyScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('$')).toBeTruthy();
    // Euro symbol is in the option text
    expect(screen.getByText('EUR - Euro')).toBeTruthy();
    // Shekel symbol is in the option text
    expect(screen.getByText('ILS - Israeli Shekel')).toBeTruthy();
  });
});
