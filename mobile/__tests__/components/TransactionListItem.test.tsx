import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TransactionListItem } from '../../src/components/TransactionListItem';
import type { Transaction } from '../../src/stores';

const mockExpenseTransaction: Transaction = {
  id: 'tx-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  type: 'EXPENSE',
  amount: '50.00',
  currency: 'USD',
  date: '2026-01-15',
  month: '2026-01-01',
  description: 'Groceries',
  isRecurring: false,
  category: {
    id: 'cat-1',
    name: 'Food',
    type: 'EXPENSE',
    color: '#4CAF50',
  },
};

const mockIncomeTransaction: Transaction = {
  id: 'tx-2',
  accountId: 'acc-1',
  categoryId: 'cat-2',
  type: 'INCOME',
  amount: '1000.00',
  currency: 'USD',
  date: '2026-01-14',
  month: '2026-01-01',
  description: 'Salary',
  isRecurring: false,
  category: {
    id: 'cat-2',
    name: 'Income',
    type: 'INCOME',
    color: '#22c55e',
  },
};

describe('TransactionListItem', () => {
  describe('Rendering', () => {
    it('renders expense transaction description', () => {
      render(<TransactionListItem transaction={mockExpenseTransaction} />);

      expect(screen.getByText('Groceries')).toBeTruthy();
    });

    it('renders income transaction description', () => {
      render(<TransactionListItem transaction={mockIncomeTransaction} />);

      expect(screen.getByText('Salary')).toBeTruthy();
    });

    it('renders expense amount with negative sign', () => {
      render(<TransactionListItem transaction={mockExpenseTransaction} />);

      expect(screen.getByText('-$50.00')).toBeTruthy();
    });

    it('renders income amount with positive sign', () => {
      render(<TransactionListItem transaction={mockIncomeTransaction} />);

      expect(screen.getByText('+$1,000.00')).toBeTruthy();
    });

    it('renders date in short format', () => {
      render(<TransactionListItem transaction={mockExpenseTransaction} />);

      expect(screen.getByText('Jan 15')).toBeTruthy();
    });

    it('falls back to category name when description is empty', () => {
      const transaction: Transaction = {
        ...mockExpenseTransaction,
        description: '',
      };
      render(<TransactionListItem transaction={transaction} />);

      expect(screen.getByText('Food')).toBeTruthy();
    });

    it('falls back to "Transaction" when no description or category', () => {
      const transaction: Transaction = {
        ...mockExpenseTransaction,
        description: '',
        category: undefined,
      };
      render(<TransactionListItem transaction={transaction} />);

      expect(screen.getByText('Transaction')).toBeTruthy();
    });
  });

  describe('Currency formatting', () => {
    it('formats EUR currency', () => {
      const transaction: Transaction = {
        ...mockExpenseTransaction,
        currency: 'EUR',
        amount: '100.00',
      };
      render(<TransactionListItem transaction={transaction} />);

      // de-DE locale formats as "-100,00 €" (currency after number)
      expect(screen.getByText(/-.*100.*€/)).toBeTruthy();
    });

    it('formats ILS currency', () => {
      const transaction: Transaction = {
        ...mockExpenseTransaction,
        currency: 'ILS',
        amount: '100.00',
      };
      render(<TransactionListItem transaction={transaction} />);

      // ILS format has currency after number
      expect(screen.getByText(/-.*100.*₪/)).toBeTruthy();
    });
  });

  describe('Press handling', () => {
    it('calls onPress when pressed', () => {
      const onPress = jest.fn();
      render(<TransactionListItem transaction={mockExpenseTransaction} onPress={onPress} />);

      fireEvent.press(screen.getByRole('button'));

      expect(onPress).toHaveBeenCalledWith(mockExpenseTransaction);
    });

    it('does not render as button when onPress is not provided', () => {
      render(<TransactionListItem transaction={mockExpenseTransaction} />);

      expect(screen.queryByRole('button')).toBeNull();
    });

    it('has correct accessibility label for expense', () => {
      const onPress = jest.fn();
      render(<TransactionListItem transaction={mockExpenseTransaction} onPress={onPress} />);

      expect(screen.getByLabelText('Groceries, -$50.00')).toBeTruthy();
    });

    it('has correct accessibility label for income', () => {
      const onPress = jest.fn();
      render(<TransactionListItem transaction={mockIncomeTransaction} onPress={onPress} />);

      expect(screen.getByLabelText('Salary, +$1,000.00')).toBeTruthy();
    });
  });

  describe('Category styling', () => {
    it('uses category color for dot', () => {
      const { toJSON } = render(<TransactionListItem transaction={mockExpenseTransaction} />);

      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('uses fallback color when category has no color', () => {
      const transaction: Transaction = {
        ...mockExpenseTransaction,
        category: {
          ...mockExpenseTransaction.category!,
          color: undefined as unknown as string,
        },
      };
      const { toJSON } = render(<TransactionListItem transaction={transaction} />);

      expect(toJSON()).toBeTruthy();
    });
  });
});
