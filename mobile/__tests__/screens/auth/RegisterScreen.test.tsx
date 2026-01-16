import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { RegisterScreen } from '../../../src/screens/auth/RegisterScreen';

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
  key: 'Register',
  name: 'Register' as const,
  params: undefined,
};

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title correctly', () => {
    render(<RegisterScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Create Account')).toBeTruthy();
  });

  it('renders subtitle correctly', () => {
    render(<RegisterScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Start tracking your expenses')).toBeTruthy();
  });

  it('renders form placeholder text', () => {
    render(<RegisterScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Registration form will be implemented in task #70')).toBeTruthy();
  });

  it('navigates back to Login screen when sign in link is pressed', () => {
    render(<RegisterScreen navigation={mockNavigation as any} route={mockRoute} />);

    const loginLink = screen.getByText('Already have an account? Sign in');
    fireEvent.press(loginLink);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Login');
  });

  it('renders the sign in navigation link', () => {
    render(<RegisterScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Already have an account? Sign in')).toBeTruthy();
  });
});
