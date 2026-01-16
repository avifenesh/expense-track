import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { OnboardingScreenProps } from '../../../src/navigation/types';
import { OnboardingSampleDataScreen } from '../../../src/screens/onboarding/OnboardingSampleDataScreen';

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
  key: 'OnboardingSampleData',
  name: 'OnboardingSampleData' as const,
  params: undefined,
};

describe('OnboardingSampleDataScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders step indicator correctly', () => {
    render(<OnboardingSampleDataScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Step 4 of 5')).toBeTruthy();
  });

  it('renders title correctly', () => {
    render(<OnboardingSampleDataScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Sample Data')).toBeTruthy();
  });

  it('renders subtitle correctly', () => {
    render(<OnboardingSampleDataScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Want to explore with sample transactions?')).toBeTruthy();
  });

  it('renders yes option title', () => {
    render(<OnboardingSampleDataScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Yes, add samples')).toBeTruthy();
  });

  it('renders yes option description', () => {
    render(<OnboardingSampleDataScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('See how the app works with realistic data')).toBeTruthy();
  });

  it('renders no option title', () => {
    render(<OnboardingSampleDataScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('No, start fresh')).toBeTruthy();
  });

  it('renders no option description', () => {
    render(<OnboardingSampleDataScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Begin with a clean slate')).toBeTruthy();
  });

  it('renders both sample data options', () => {
    render(<OnboardingSampleDataScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Yes, add samples')).toBeTruthy();
    expect(screen.getByText('No, start fresh')).toBeTruthy();
  });

  it('renders Continue button', () => {
    render(<OnboardingSampleDataScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('navigates to OnboardingComplete when Continue is pressed', () => {
    render(<OnboardingSampleDataScreen navigation={mockNavigation} route={mockRoute} />);

    const continueButton = screen.getByText('Continue');
    fireEvent.press(continueButton);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('OnboardingComplete');
  });
});
