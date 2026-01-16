import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { OnboardingStack } from '../../src/navigation/OnboardingStack';

describe('OnboardingStack', () => {
  it('renders welcome screen by default', () => {
    render(
      <NavigationContainer>
        <OnboardingStack />
      </NavigationContainer>
    );

    expect(screen.getByText('Welcome')).toBeTruthy();
    expect(screen.getByText("Let's set up your expense tracking")).toBeTruthy();
  });

  it('shows get started button', () => {
    render(
      <NavigationContainer>
        <OnboardingStack />
      </NavigationContainer>
    );

    expect(screen.getByText('Get Started')).toBeTruthy();
  });

  it('displays welcome info', () => {
    render(
      <NavigationContainer>
        <OnboardingStack />
      </NavigationContainer>
    );

    expect(
      screen.getByText(
        "We'll guide you through a few steps to personalize your experience"
      )
    ).toBeTruthy();
  });
});
