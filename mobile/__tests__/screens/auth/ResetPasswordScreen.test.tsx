import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ResetPasswordScreen } from '../../../src/screens/auth/ResetPasswordScreen';

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
  key: 'ResetPassword',
  name: 'ResetPassword' as const,
  params: undefined,
};

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title correctly', () => {
    render(<ResetPasswordScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Reset Password')).toBeTruthy();
  });

  it('renders subtitle correctly', () => {
    render(<ResetPasswordScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Enter your email to receive a reset link')).toBeTruthy();
  });

  it('renders form placeholder text', () => {
    render(<ResetPasswordScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Password reset form will be implemented in task #70')).toBeTruthy();
  });

  it('navigates back to Login screen when back link is pressed', () => {
    render(<ResetPasswordScreen navigation={mockNavigation as any} route={mockRoute} />);

    const backLink = screen.getByText('Back to Sign In');
    fireEvent.press(backLink);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Login');
  });

  it('renders the back to sign in navigation link', () => {
    render(<ResetPasswordScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Back to Sign In')).toBeTruthy();
  });
});
