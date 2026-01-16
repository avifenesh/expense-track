import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { MainTabNavigator } from '../../src/navigation/MainTabNavigator';

describe('MainTabNavigator', () => {
  it('renders all five tabs', () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );

    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Transactions')).toBeTruthy();
    expect(screen.getByText('Budgets')).toBeTruthy();
    expect(screen.getByText('Sharing')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('shows dashboard by default', () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );

    expect(screen.getByText('Your financial overview')).toBeTruthy();
    expect(screen.getByText('This Month')).toBeTruthy();
  });

  it('navigates to transactions tab', async () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );

    fireEvent.press(screen.getByText('Transactions'));

    await waitFor(() => {
      expect(screen.getByText('+ Add')).toBeTruthy();
      expect(screen.getByText('All')).toBeTruthy();
      expect(screen.getByText('Income')).toBeTruthy();
      expect(screen.getByText('Expenses')).toBeTruthy();
    });
  });

  it('navigates to budgets tab', async () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );

    fireEvent.press(screen.getByText('Budgets'));

    await waitFor(() => {
      expect(screen.getByText('Track your spending by category')).toBeTruthy();
      expect(screen.getByText('Monthly Budget')).toBeTruthy();
    });
  });

  it('navigates to sharing tab', async () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );

    fireEvent.press(screen.getByText('Sharing'));

    await waitFor(() => {
      expect(screen.getByText('Net Balance')).toBeTruthy();
      expect(screen.getByText('+ Share')).toBeTruthy();
    });
  });

  it('navigates to settings tab', async () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );

    fireEvent.press(screen.getByText('Settings'));

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeTruthy();
      expect(screen.getByText('Profile')).toBeTruthy();
      expect(screen.getByText('Sign Out')).toBeTruthy();
    });
  });

  it('maintains tab state when switching between tabs', async () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );

    // Go to transactions
    fireEvent.press(screen.getByText('Transactions'));
    await waitFor(() => {
      expect(screen.getByText('+ Add')).toBeTruthy();
    });

    // Go to settings
    fireEvent.press(screen.getByText('Settings'));
    await waitFor(() => {
      expect(screen.getByText('Sign Out')).toBeTruthy();
    });

    // Go back to dashboard
    fireEvent.press(screen.getByText('Home'));
    await waitFor(() => {
      expect(screen.getByText('Your financial overview')).toBeTruthy();
    });
  });
});
