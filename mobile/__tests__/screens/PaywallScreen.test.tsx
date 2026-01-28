import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PaywallScreen } from '../../src/screens/PaywallScreen';
import { useAuthStore } from '../../src/stores/authStore';
import { Linking, Alert } from 'react-native';

// Mock Linking methods
jest.spyOn(Linking, 'canOpenURL');
jest.spyOn(Linking, 'openURL');
jest.spyOn(Alert, 'alert');

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

const mockLogout = jest.fn();
const mockCanOpenURL = Linking.canOpenURL as jest.Mock;
const mockOpenURL = Linking.openURL as jest.Mock;
const mockAlert = Alert.alert as jest.Mock;

describe('PaywallScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore.getState as jest.Mock).mockReturnValue({
      logout: mockLogout,
    });
    mockLogout.mockResolvedValue(undefined);
    mockCanOpenURL.mockResolvedValue(true);
    mockOpenURL.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('renders the paywall screen', () => {
      render(<PaywallScreen />);

      expect(screen.getByTestId('paywall.screen')).toBeTruthy();
    });

    it('renders subscription expired title', () => {
      render(<PaywallScreen />);

      expect(screen.getByText('Subscription Expired')).toBeTruthy();
    });

    it('renders subscription expired subtitle', () => {
      render(<PaywallScreen />);

      expect(
        screen.getByText(
          'Your subscription has ended. Subscribe to continue tracking your finances.'
        )
      ).toBeTruthy();
    });

    it('renders feature list', () => {
      render(<PaywallScreen />);

      expect(screen.getByText(/Unlimited expense tracking/)).toBeTruthy();
      expect(screen.getByText(/Budget management/)).toBeTruthy();
      expect(screen.getByText(/Multi-currency support/)).toBeTruthy();
      expect(screen.getByText(/Expense sharing/)).toBeTruthy();
      expect(screen.getByText(/Sync across all devices/)).toBeTruthy();
    });

    it('renders price text', () => {
      render(<PaywallScreen />);

      expect(screen.getByText('Just $3/month')).toBeTruthy();
    });

    it('renders subscribe button', () => {
      render(<PaywallScreen />);

      expect(screen.getByTestId('paywall.subscribeButton')).toBeTruthy();
      expect(screen.getByText('Subscribe Now')).toBeTruthy();
    });

    it('renders sign out button', () => {
      render(<PaywallScreen />);

      expect(screen.getByTestId('paywall.signOutButton')).toBeTruthy();
      expect(screen.getByText('Sign Out')).toBeTruthy();
    });

    it('renders all testIDs', () => {
      render(<PaywallScreen />);

      expect(screen.getByTestId('paywall.screen')).toBeTruthy();
      expect(screen.getByTestId('paywall.content')).toBeTruthy();
      expect(screen.getByTestId('paywall.iconContainer')).toBeTruthy();
      expect(screen.getByTestId('paywall.title')).toBeTruthy();
      expect(screen.getByTestId('paywall.subtitle')).toBeTruthy();
      expect(screen.getByTestId('paywall.infoBox')).toBeTruthy();
      expect(screen.getByTestId('paywall.subscribeButton')).toBeTruthy();
      expect(screen.getByTestId('paywall.signOutButton')).toBeTruthy();
    });
  });

  describe('Subscribe Button', () => {
    it('opens pricing URL when subscribe button is pressed', async () => {
      render(<PaywallScreen />);

      const subscribeButton = screen.getByTestId('paywall.subscribeButton');
      fireEvent.press(subscribeButton);

      await waitFor(() => {
        expect(mockCanOpenURL).toHaveBeenCalledWith('https://balancebeacon.com/pricing');
        expect(mockOpenURL).toHaveBeenCalledWith('https://balancebeacon.com/pricing');
      });
    });

    it('shows alert when URL cannot be opened', async () => {
      mockCanOpenURL.mockResolvedValue(false);

      render(<PaywallScreen />);

      const subscribeButton = screen.getByTestId('paywall.subscribeButton');
      fireEvent.press(subscribeButton);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Unable to Open Link',
          'Please visit balancebeacon.com/pricing in your browser to subscribe.',
          [{ text: 'OK' }]
        );
      });
    });

    it('shows alert when Linking.openURL throws', async () => {
      mockOpenURL.mockRejectedValue(new Error('Failed to open'));

      render(<PaywallScreen />);

      const subscribeButton = screen.getByTestId('paywall.subscribeButton');
      fireEvent.press(subscribeButton);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Unable to Open Link',
          'Please visit balancebeacon.com/pricing in your browser to subscribe.',
          [{ text: 'OK' }]
        );
      });
    });

    it('shows alert when Linking.canOpenURL throws', async () => {
      mockCanOpenURL.mockRejectedValue(new Error('Check failed'));

      render(<PaywallScreen />);

      const subscribeButton = screen.getByTestId('paywall.subscribeButton');
      fireEvent.press(subscribeButton);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Unable to Open Link',
          'Please visit balancebeacon.com/pricing in your browser to subscribe.',
          [{ text: 'OK' }]
        );
      });
    });
  });

  describe('Sign Out Button', () => {
    it('calls logout when sign out button is pressed', async () => {
      render(<PaywallScreen />);

      const signOutButton = screen.getByTestId('paywall.signOutButton');
      fireEvent.press(signOutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });

    it('shows loading indicator while signing out', async () => {
      let resolveLogout: () => void;
      mockLogout.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveLogout = resolve;
        })
      );

      render(<PaywallScreen />);

      const signOutButton = screen.getByTestId('paywall.signOutButton');
      fireEvent.press(signOutButton);

      await waitFor(() => {
        expect(screen.getByTestId('paywall.signOutLoading')).toBeTruthy();
      });

      // Resolve the logout promise
      resolveLogout!();

      await waitFor(() => {
        expect(screen.queryByTestId('paywall.signOutLoading')).toBeNull();
      });
    });

    it('disables sign out button while signing out', async () => {
      let resolveLogout: () => void;
      mockLogout.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveLogout = resolve;
        })
      );

      render(<PaywallScreen />);

      const signOutButton = screen.getByTestId('paywall.signOutButton');
      fireEvent.press(signOutButton);

      // Try pressing again - should not call logout twice
      fireEvent.press(signOutButton);
      fireEvent.press(signOutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1);
      });

      resolveLogout!();
    });

    it('handles logout error gracefully', async () => {
      mockLogout.mockRejectedValue(new Error('Logout failed'));

      render(<PaywallScreen />);

      const signOutButton = screen.getByTestId('paywall.signOutButton');
      fireEvent.press(signOutButton);

      await waitFor(() => {
        // Should not throw, button should become enabled again
        expect(screen.queryByTestId('paywall.signOutLoading')).toBeNull();
      });
    });

    it('hides Sign Out text while loading', async () => {
      let resolveLogout: () => void;
      mockLogout.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveLogout = resolve;
        })
      );

      render(<PaywallScreen />);

      // Initially shows Sign Out text
      expect(screen.getByText('Sign Out')).toBeTruthy();

      const signOutButton = screen.getByTestId('paywall.signOutButton');
      fireEvent.press(signOutButton);

      await waitFor(() => {
        expect(screen.queryByText('Sign Out')).toBeNull();
        expect(screen.getByTestId('paywall.signOutLoading')).toBeTruthy();
      });

      resolveLogout!();

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeTruthy();
      });
    });
  });
});
