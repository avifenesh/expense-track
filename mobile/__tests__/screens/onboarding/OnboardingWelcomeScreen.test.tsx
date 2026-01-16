import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OnboardingWelcomeScreen } from '../../../src/screens/onboarding/OnboardingWelcomeScreen';

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
  key: 'OnboardingWelcome',
  name: 'OnboardingWelcome' as const,
  params: undefined,
};

describe('OnboardingWelcomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title correctly', () => {
    render(<OnboardingWelcomeScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Welcome')).toBeTruthy();
  });

  it('renders subtitle correctly', () => {
    render(<OnboardingWelcomeScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText("Let's set up your expense tracking")).toBeTruthy();
  });

  it('renders info text about the onboarding process', () => {
    render(<OnboardingWelcomeScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(
      screen.getByText("We'll guide you through a few steps to personalize your experience")
    ).toBeTruthy();
  });

  it('renders Get Started button', () => {
    render(<OnboardingWelcomeScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Get Started')).toBeTruthy();
  });

  it('navigates to OnboardingCurrency when Get Started is pressed', () => {
    render(<OnboardingWelcomeScreen navigation={mockNavigation as any} route={mockRoute} />);

    const getStartedButton = screen.getByText('Get Started');
    fireEvent.press(getStartedButton);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('OnboardingCurrency');
  });
});
