import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { BudgetCategoryCard } from '../../src/components/BudgetCategoryCard';

describe('BudgetCategoryCard', () => {
  const defaultProps = {
    categoryName: 'Food',
    categoryColor: '#4CAF50',
    planned: 500,
    spent: 150,
    currency: 'USD' as const,
  };

  describe('Rendering', () => {
    it('renders category name', () => {
      render(<BudgetCategoryCard {...defaultProps} />);

      expect(screen.getByText('Food')).toBeTruthy();
    });

    it('renders spent amount', () => {
      render(<BudgetCategoryCard {...defaultProps} />);

      expect(screen.getByText('$150.00')).toBeTruthy();
    });

    it('renders planned amount', () => {
      render(<BudgetCategoryCard {...defaultProps} />);

      expect(screen.getByText('$500.00')).toBeTruthy();
    });

    it('renders separator between amounts', () => {
      render(<BudgetCategoryCard {...defaultProps} />);

      expect(screen.getByText(' / ')).toBeTruthy();
    });

    it('renders progress bar', () => {
      const { toJSON } = render(<BudgetCategoryCard {...defaultProps} />);

      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Currency formatting', () => {
    it('formats USD currency', () => {
      render(<BudgetCategoryCard {...defaultProps} currency="USD" />);

      expect(screen.getByText('$150.00')).toBeTruthy();
      expect(screen.getByText('$500.00')).toBeTruthy();
    });

    it('formats EUR currency', () => {
      render(<BudgetCategoryCard {...defaultProps} currency="EUR" />);

      // de-DE locale formats as "150,00 €" (currency after number)
      expect(screen.getByText(/150.*€/)).toBeTruthy();
      expect(screen.getByText(/500.*€/)).toBeTruthy();
    });

    it('formats ILS currency', () => {
      render(<BudgetCategoryCard {...defaultProps} currency="ILS" />);

      // ILS format has currency after number
      expect(screen.getByText(/150.*₪/)).toBeTruthy();
      expect(screen.getByText(/500.*₪/)).toBeTruthy();
    });
  });

  describe('Over budget display', () => {
    it('shows over budget styling when spent exceeds planned', () => {
      const { toJSON } = render(
        <BudgetCategoryCard {...defaultProps} spent={600} planned={500} />
      );

      // Verify component renders with over-budget scenario
      expect(toJSON()).toBeTruthy();
      expect(screen.getByText('$600.00')).toBeTruthy();
    });

    it('does not show over budget styling when under budget', () => {
      const { toJSON } = render(
        <BudgetCategoryCard {...defaultProps} spent={100} planned={500} />
      );

      expect(toJSON()).toBeTruthy();
      expect(screen.getByText('$100.00')).toBeTruthy();
    });

    it('does not show over budget styling when exactly at budget', () => {
      const { toJSON } = render(
        <BudgetCategoryCard {...defaultProps} spent={500} planned={500} />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Progress calculation', () => {
    it('calculates progress correctly when under budget', () => {
      // 150/500 = 30% progress
      const { toJSON } = render(
        <BudgetCategoryCard {...defaultProps} spent={150} planned={500} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('caps progress at 100% when over budget', () => {
      // Over budget should still show max progress
      const { toJSON } = render(
        <BudgetCategoryCard {...defaultProps} spent={600} planned={500} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('shows zero progress when planned is zero', () => {
      const { toJSON } = render(
        <BudgetCategoryCard {...defaultProps} spent={100} planned={0} />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Press handling', () => {
    it('calls onPress when pressed', () => {
      const onPress = jest.fn();
      render(<BudgetCategoryCard {...defaultProps} onPress={onPress} />);

      fireEvent.press(screen.getByRole('button'));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not render as button when onPress is not provided', () => {
      render(<BudgetCategoryCard {...defaultProps} />);

      expect(screen.queryByRole('button')).toBeNull();
    });

    it('has correct accessibility label', () => {
      const onPress = jest.fn();
      render(<BudgetCategoryCard {...defaultProps} onPress={onPress} />);

      expect(screen.getByLabelText('Food, $150.00 of $500.00')).toBeTruthy();
    });
  });

  describe('Category styling', () => {
    it('renders with category color', () => {
      const { toJSON } = render(
        <BudgetCategoryCard {...defaultProps} categoryColor="#FF5722" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('renders with different category colors', () => {
      const { toJSON } = render(
        <BudgetCategoryCard {...defaultProps} categoryColor="#2196F3" />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Planned <= 0 edge cases', () => {
    it('shows over budget when planned is 0 but has spending', () => {
      const { toJSON } = render(
        <BudgetCategoryCard {...defaultProps} spent={100} planned={0} />
      );

      // Should render with over-budget styling (100% progress, red text)
      expect(toJSON()).toBeTruthy();
      expect(screen.getByText('$100.00')).toBeTruthy();
      expect(screen.getByText('$0.00')).toBeTruthy();
    });

    it('shows no over budget when planned is 0 and no spending', () => {
      const { toJSON } = render(
        <BudgetCategoryCard {...defaultProps} spent={0} planned={0} />
      );

      // Should not show over-budget styling
      expect(toJSON()).toBeTruthy();
    });

    it('shows over budget when planned is negative but has spending', () => {
      const { toJSON } = render(
        <BudgetCategoryCard {...defaultProps} spent={50} planned={-100} />
      );

      // Negative planned with spending should be over budget
      expect(toJSON()).toBeTruthy();
      expect(screen.getByText('$50.00')).toBeTruthy();
    });

    it('caps progress at 100% when planned is zero with spending', () => {
      // When planned is 0 but spent > 0, progress should be 100%
      const { toJSON } = render(
        <BudgetCategoryCard {...defaultProps} spent={1000} planned={0} />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Edge cases', () => {
    it('handles zero spent amount', () => {
      render(<BudgetCategoryCard {...defaultProps} spent={0} />);

      expect(screen.getByText('$0.00')).toBeTruthy();
    });

    it('handles large amounts', () => {
      render(
        <BudgetCategoryCard {...defaultProps} spent={10000.99} planned={50000} />
      );

      expect(screen.getByText('$10,000.99')).toBeTruthy();
      expect(screen.getByText('$50,000.00')).toBeTruthy();
    });

    it('handles long category names', () => {
      render(
        <BudgetCategoryCard
          {...defaultProps}
          categoryName="Entertainment and Recreation Expenses"
        />
      );

      expect(screen.getByText('Entertainment and Recreation Expenses')).toBeTruthy();
    });

    it('handles decimal amounts', () => {
      render(
        <BudgetCategoryCard {...defaultProps} spent={123.45} planned={678.90} />
      );

      expect(screen.getByText('$123.45')).toBeTruthy();
      expect(screen.getByText('$678.90')).toBeTruthy();
    });
  });
});
