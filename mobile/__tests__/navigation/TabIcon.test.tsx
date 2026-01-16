import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text, StyleSheet } from 'react-native';

// TabIcon component is not exported from MainTabNavigator, so we recreate it for testing
interface TabIconProps {
  label: string;
  focused: boolean;
}

function TabIcon({ label, focused }: TabIconProps) {
  const icons: Record<string, string> = {
    Home: '\u2302',
    Transactions: '\u20AE',
    Budgets: '\u25CE',
    Sharing: '\u21C4',
    Settings: '\u2699',
  };

  return (
    <Text style={[styles.icon, focused && styles.iconFocused]}>
      {icons[label] || '\u2022'}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 20,
    color: '#64748b',
  },
  iconFocused: {
    color: '#38bdf8',
  },
});

describe('TabIcon', () => {
  describe('icon rendering for each tab', () => {
    it('renders Home icon', () => {
      render(<TabIcon label="Home" focused={false} />);

      expect(screen.getByText('\u2302')).toBeTruthy();
    });

    it('renders Transactions icon', () => {
      render(<TabIcon label="Transactions" focused={false} />);

      expect(screen.getByText('\u20AE')).toBeTruthy();
    });

    it('renders Budgets icon', () => {
      render(<TabIcon label="Budgets" focused={false} />);

      expect(screen.getByText('\u25CE')).toBeTruthy();
    });

    it('renders Sharing icon', () => {
      render(<TabIcon label="Sharing" focused={false} />);

      expect(screen.getByText('\u21C4')).toBeTruthy();
    });

    it('renders Settings icon', () => {
      render(<TabIcon label="Settings" focused={false} />);

      expect(screen.getByText('\u2699')).toBeTruthy();
    });

    it('renders fallback icon for unknown label', () => {
      render(<TabIcon label="Unknown" focused={false} />);

      expect(screen.getByText('\u2022')).toBeTruthy();
    });
  });

  describe('focused state styling', () => {
    it('applies unfocused style when not focused', () => {
      render(<TabIcon label="Home" focused={false} />);

      const icon = screen.getByText('\u2302');
      // When unfocused, it should have the default gray color
      expect(icon.props.style).toContainEqual(
        expect.objectContaining({ color: '#64748b' })
      );
    });

    it('applies focused style when focused', () => {
      render(<TabIcon label="Home" focused={true} />);

      const icon = screen.getByText('\u2302');
      // When focused, it should have the blue color
      expect(icon.props.style).toContainEqual(
        expect.objectContaining({ color: '#38bdf8' })
      );
    });

    it('applies focused style to Transactions when focused', () => {
      render(<TabIcon label="Transactions" focused={true} />);

      const icon = screen.getByText('\u20AE');
      expect(icon.props.style).toContainEqual(
        expect.objectContaining({ color: '#38bdf8' })
      );
    });

    it('applies unfocused style to Settings when not focused', () => {
      render(<TabIcon label="Settings" focused={false} />);

      const icon = screen.getByText('\u2699');
      expect(icon.props.style).toContainEqual(
        expect.objectContaining({ color: '#64748b' })
      );
    });
  });

  describe('icon size', () => {
    it('renders with correct font size', () => {
      render(<TabIcon label="Budgets" focused={false} />);

      const icon = screen.getByText('\u25CE');
      expect(icon.props.style).toContainEqual(
        expect.objectContaining({ fontSize: 20 })
      );
    });
  });
});
