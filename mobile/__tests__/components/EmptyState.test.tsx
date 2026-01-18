import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { EmptyState } from '../../src/components/EmptyState';

describe('EmptyState', () => {
  describe('Rendering', () => {
    it('renders title correctly', () => {
      render(<EmptyState title="No items" message="Nothing to display" />);

      expect(screen.getByText('No items')).toBeTruthy();
    });

    it('renders message correctly', () => {
      render(<EmptyState title="No items" message="Nothing to display here" />);

      expect(screen.getByText('Nothing to display here')).toBeTruthy();
    });

    it('renders icon when provided', () => {
      render(<EmptyState icon="📭" title="No messages" message="Your inbox is empty" />);

      expect(screen.getByText('📭')).toBeTruthy();
    });

    it('does not render icon when not provided', () => {
      render(<EmptyState title="No items" message="Nothing here" />);

      expect(screen.queryByText('📭')).toBeNull();
    });
  });

  describe('Styling', () => {
    it('applies custom style when provided', () => {
      const customStyle = { paddingTop: 100 };
      const { toJSON } = render(
        <EmptyState title="Test" message="Test message" style={customStyle} />
      );

      const tree = toJSON();
      expect(tree).toBeTruthy();
    });
  });

  describe('Content variations', () => {
    it('handles long title text', () => {
      const longTitle = 'This is a very long title that might wrap to multiple lines';
      render(<EmptyState title={longTitle} message="Short message" />);

      expect(screen.getByText(longTitle)).toBeTruthy();
    });

    it('handles long message text', () => {
      const longMessage =
        'This is a very long message that explains in detail why the list is empty and what the user might want to do about it.';
      render(<EmptyState title="Empty" message={longMessage} />);

      expect(screen.getByText(longMessage)).toBeTruthy();
    });

    it('handles emoji icons', () => {
      render(<EmptyState icon="🔍" title="No results" message="Try different search terms" />);

      expect(screen.getByText('🔍')).toBeTruthy();
    });
  });
});
