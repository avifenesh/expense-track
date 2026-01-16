import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { LoginScreen } from '../../../src/screens/auth/LoginScreen';

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
  key: 'Login',
  name: 'Login' as const,
  params: undefined,
};

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title correctly', () => {
    render(<LoginScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('renders subtitle correctly', () => {
    render(<LoginScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Welcome back to Expense Track')).toBeTruthy();
  });

  it('renders form placeholder text', () => {
    render(<LoginScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Login form will be implemented in task #70')).toBeTruthy();
  });

  it('navigates to Register screen when register link is pressed', () => {
    render(<LoginScreen navigation={mockNavigation as any} route={mockRoute} />);

    const registerLink = screen.getByText("Don't have an account? Register");
    fireEvent.press(registerLink);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to ResetPassword screen when forgot password link is pressed', () => {
    render(<LoginScreen navigation={mockNavigation as any} route={mockRoute} />);

    const forgotLink = screen.getByText('Forgot password?');
    fireEvent.press(forgotLink);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('ResetPassword', {});
  });

  it('renders both navigation links', () => {
    render(<LoginScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText("Don't have an account? Register")).toBeTruthy();
    expect(screen.getByText('Forgot password?')).toBeTruthy();
  });
});
