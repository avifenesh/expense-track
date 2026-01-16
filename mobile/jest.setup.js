/* global jest */
// Import gesture handler test setup
import 'react-native-gesture-handler/jestSetup';

// Mock @react-navigation/native-stack
jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }) => {
        // Get the first screen's component and render it
        const screens = React.Children.toArray(children);
        if (screens.length === 0) return null;

        const firstScreen = screens[0];
        const Component = firstScreen?.props?.component;

        return React.createElement(
          View,
          { testID: 'stack-navigator' },
          Component
            ? React.createElement(Component, { navigation: { navigate: jest.fn() }, route: { params: {} } })
            : firstScreen
        );
      },
      Screen: ({ name: _name, component: _component }) => null,
      Group: ({ children }) => children,
    }),
  };
});

// Mock @react-navigation/bottom-tabs
jest.mock('@react-navigation/bottom-tabs', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');

  return {
    createBottomTabNavigator: () => ({
      Navigator: ({ children }) => {
        const screens = React.Children.toArray(children);
        const [activeIndex, setActiveIndex] = React.useState(0);

        const activeScreen = screens[activeIndex];
        const Component = activeScreen?.props?.component;

        return React.createElement(
          View,
          { testID: 'tab-navigator' },
          // Active screen content
          Component
            ? React.createElement(Component, { navigation: { navigate: jest.fn() }, route: { params: {} } })
            : null,
          // Tab bar
          React.createElement(
            View,
            { testID: 'tab-bar' },
            screens.map((screen, index) =>
              React.createElement(
                Pressable,
                {
                  key: screen?.props?.name || index,
                  onPress: () => setActiveIndex(index),
                  testID: `tab-${screen?.props?.name}`,
                },
                React.createElement(
                  Text,
                  null,
                  screen?.props?.options?.tabBarLabel || screen?.props?.name || ''
                )
              )
            )
          )
        );
      },
      Screen: () => null,
    }),
  };
});

// Mock react-native-screens
jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
  enableFreeze: jest.fn(),
}));

// Mock react-native-safe-area-context with proper context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 375, height: 812 };

  const SafeAreaContext = React.createContext({
    insets: inset,
    frame: frame,
  });

  return {
    SafeAreaProvider: ({ children }) =>
      React.createElement(
        SafeAreaContext.Provider,
        { value: { insets: inset, frame: frame } },
        children
      ),
    SafeAreaConsumer: SafeAreaContext.Consumer,
    SafeAreaView: ({ children, edges: _edges, style }) =>
      React.createElement(View, { testID: 'safe-area-view', style }, children),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
    SafeAreaInsetsContext: SafeAreaContext,
    SafeAreaFrameContext: SafeAreaContext,
    initialWindowMetrics: {
      insets: inset,
      frame: frame,
    },
    withSafeAreaInsets: (Component) => Component,
  };
});

// Suppress console warnings
const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Animated: `useNativeDriver`') ||
      args[0].includes('useNativeDriver') ||
      args[0].includes('React Navigation'))
  ) {
    return;
  }
  originalWarn(...args);
};

console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning:') || args[0].includes('act(...)'))
  ) {
    return;
  }
  originalError(...args);
};
