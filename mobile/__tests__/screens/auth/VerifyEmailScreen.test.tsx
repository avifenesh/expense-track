import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { VerifyEmailScreen } from '../../../src/screens/auth/VerifyEmailScreen';

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
  key: 'VerifyEmail',
  name: 'VerifyEmail' as const,
  params: { email: 'test@example.com' },
};

describe('VerifyEmailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title correctly', () => {
    render(<VerifyEmailScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Verify Email')).toBeTruthy();
  });

  it('displays the email from route params', () => {
    render(<VerifyEmailScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('We sent a verification link to test@example.com')).toBeTruthy();
  });

  it('displays different email when params change', () => {
    const routeWithDifferentEmail = {
      ...mockRoute,
      params: { email: 'user@domain.org' },
    };

    render(<VerifyEmailScreen navigation={mockNavigation as any} route={routeWithDifferentEmail} />);

    expect(screen.getByText('We sent a verification link to user@domain.org')).toBeTruthy();
  });

  it('renders form placeholder text', () => {
    render(<VerifyEmailScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Email verification will be implemented in task #70')).toBeTruthy();
  });

  it('navigates back to Login screen when back link is pressed', () => {
    render(<VerifyEmailScreen navigation={mockNavigation as any} route={mockRoute} />);

    const backLink = screen.getByText('Back to Sign In');
    fireEvent.press(backLink);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Login');
  });

  it('renders the back to sign in navigation link', () => {
    render(<VerifyEmailScreen navigation={mockNavigation as any} route={mockRoute} />);

    expect(screen.getByText('Back to Sign In')).toBeTruthy();
  });
});
