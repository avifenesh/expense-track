import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { OnboardingScreenProps } from '../../../src/navigation/types';
import { OnboardingCompleteScreen } from '../../../src/screens/onboarding/OnboardingCompleteScreen';

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
  key: 'OnboardingComplete',
  name: 'OnboardingComplete' as const,
  params: undefined,
};

describe('OnboardingCompleteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders step indicator correctly', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Step 5 of 5')).toBeTruthy();
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

    // The checkmark is rendered as a text character
    const checkmarks = screen.getAllByText(/✓/);
    expect(checkmarks.length).toBeGreaterThan(0);
  });

  it('renders Currency summary item', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Currency')).toBeTruthy();
    expect(screen.getByText('USD')).toBeTruthy();
  });

  it('renders Categories summary item', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Categories')).toBeTruthy();
    expect(screen.getByText('8 selected')).toBeTruthy();
  });

  it('renders Monthly Budget summary item', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Monthly Budget')).toBeTruthy();
    expect(screen.getByText('$2,000')).toBeTruthy();
  });

  it('renders all three summary items', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Currency')).toBeTruthy();
    expect(screen.getByText('Categories')).toBeTruthy();
    expect(screen.getByText('Monthly Budget')).toBeTruthy();
  });

  it('renders Start Tracking button', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Start Tracking')).toBeTruthy();
  });

  it('displays summary values correctly', () => {
    render(<OnboardingCompleteScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('USD')).toBeTruthy();
    expect(screen.getByText('8 selected')).toBeTruthy();
    expect(screen.getByText('$2,000')).toBeTruthy();
  });
});
