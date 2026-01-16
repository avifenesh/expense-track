import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OnboardingBudgetScreen } from '../../../src/screens/onboarding/OnboardingBudgetScreen';
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
} as unknown as OnboardingScreenProps<'OnboardingBudget'>['navigation'];

const mockRoute = {
  key: 'OnboardingBudget',
  name: 'OnboardingBudget' as const,
  params: undefined,
} as OnboardingScreenProps<'OnboardingBudget'>['route'];

describe('OnboardingBudgetScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders step indicator correctly', () => {
    render(<OnboardingBudgetScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Step 3 of 5')).toBeTruthy();
  });

  it('renders title and button text (both say Set Budget)', () => {
    render(<OnboardingBudgetScreen navigation={mockNavigation} route={mockRoute} />);

    // Both the title and the button have "Set Budget" text
    const setBudgetElements = screen.getAllByText('Set Budget');
    expect(setBudgetElements).toHaveLength(2);
  });

  it('renders subtitle correctly', () => {
    render(<OnboardingBudgetScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Set your monthly budget to track spending')).toBeTruthy();
  });

  it('renders budget amount', () => {
    render(<OnboardingBudgetScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('2,000')).toBeTruthy();
  });

  it('renders currency symbol', () => {
    render(<OnboardingBudgetScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('$')).toBeTruthy();
  });

  it('renders period indicator', () => {
    render(<OnboardingBudgetScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('/month')).toBeTruthy();
  });

  it('renders info text about budget adjustment', () => {
    render(<OnboardingBudgetScreen navigation={mockNavigation} route={mockRoute} />);

    expect(
      screen.getByText('You can adjust this later and set category-specific budgets')
    ).toBeTruthy();
  });

  it('renders Skip for now button', () => {
    render(<OnboardingBudgetScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Skip for now')).toBeTruthy();
  });

  it('renders Set Budget button', () => {
    render(<OnboardingBudgetScreen navigation={mockNavigation} route={mockRoute} />);

    // Using getAllByText since both title and button have same text
    const setBudgetElements = screen.getAllByText('Set Budget');
    expect(setBudgetElements.length).toBeGreaterThan(0);
  });

  it('navigates to OnboardingSampleData when Skip is pressed', () => {
    render(<OnboardingBudgetScreen navigation={mockNavigation} route={mockRoute} />);

    const skipButton = screen.getByText('Skip for now');
    fireEvent.press(skipButton);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('OnboardingSampleData');
  });

  it('navigates to OnboardingSampleData when Set Budget button is pressed', () => {
    render(<OnboardingBudgetScreen navigation={mockNavigation} route={mockRoute} />);

    // Get all "Set Budget" text elements - second one is the button
    const setBudgetElements = screen.getAllByText('Set Budget');
    fireEvent.press(setBudgetElements[1]);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('OnboardingSampleData');
  });

  it('renders both action buttons', () => {
    render(<OnboardingBudgetScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('Skip for now')).toBeTruthy();
    // Set Budget button exists (along with title)
    const setBudgetElements = screen.getAllByText('Set Budget');
    expect(setBudgetElements).toHaveLength(2);
  });

  it('renders budget display with correct format', () => {
    render(<OnboardingBudgetScreen navigation={mockNavigation} route={mockRoute} />);

    // Check budget display elements
    expect(screen.getByText('$')).toBeTruthy();
    expect(screen.getByText('2,000')).toBeTruthy();
    expect(screen.getByText('/month')).toBeTruthy();
  });
});
