import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { DateSectionHeader } from '../../src/components/DateSectionHeader';

describe('DateSectionHeader', () => {
  describe('Rendering', () => {
    it('renders title text correctly', () => {
      render(<DateSectionHeader title="Today" />);

      expect(screen.getByText('Today')).toBeTruthy();
    });

    it('renders "Yesterday" title', () => {
      render(<DateSectionHeader title="Yesterday" />);

      expect(screen.getByText('Yesterday')).toBeTruthy();
    });

    it('renders formatted date title', () => {
      render(<DateSectionHeader title="January 15, 2026" />);

      expect(screen.getByText('January 15, 2026')).toBeTruthy();
    });
  });

  describe('Content variations', () => {
    it('handles various date formats', () => {
      const { rerender } = render(<DateSectionHeader title="December 25, 2025" />);
      expect(screen.getByText('December 25, 2025')).toBeTruthy();

      rerender(<DateSectionHeader title="March 1, 2026" />);
      expect(screen.getByText('March 1, 2026')).toBeTruthy();
    });

    it('handles edge case dates', () => {
      render(<DateSectionHeader title="January 1, 2026" />);

      expect(screen.getByText('January 1, 2026')).toBeTruthy();
    });
  });

  describe('Structure', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<DateSectionHeader title="Test" />);

      expect(toJSON()).toBeTruthy();
    });
  });
});
