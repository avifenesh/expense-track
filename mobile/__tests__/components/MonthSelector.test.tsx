import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MonthSelector } from '../../src/components/MonthSelector';

describe('MonthSelector', () => {
  const mockOnMonthChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders month label correctly', () => {
      render(
        <MonthSelector
          selectedMonth="2026-01"
          onMonthChange={mockOnMonthChange}
        />
      );

      expect(screen.getByText('January 2026')).toBeTruthy();
    });

    it('renders navigation buttons', () => {
      render(
        <MonthSelector
          selectedMonth="2026-01"
          onMonthChange={mockOnMonthChange}
        />
      );

      expect(screen.getByLabelText('Previous month')).toBeTruthy();
      expect(screen.getByLabelText('Next month')).toBeTruthy();
    });

    it('displays correct month for different dates', () => {
      const { rerender } = render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
        />
      );

      expect(screen.getByText('June 2026')).toBeTruthy();

      rerender(
        <MonthSelector
          selectedMonth="2025-12"
          onMonthChange={mockOnMonthChange}
        />
      );

      expect(screen.getByText('December 2025')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('calls onMonthChange with previous month when left arrow pressed', () => {
      render(
        <MonthSelector
          selectedMonth="2026-03"
          onMonthChange={mockOnMonthChange}
        />
      );

      fireEvent.press(screen.getByLabelText('Previous month'));

      expect(mockOnMonthChange).toHaveBeenCalledWith('2026-02');
    });

    it('calls onMonthChange with next month when right arrow pressed', () => {
      render(
        <MonthSelector
          selectedMonth="2026-03"
          onMonthChange={mockOnMonthChange}
        />
      );

      fireEvent.press(screen.getByLabelText('Next month'));

      expect(mockOnMonthChange).toHaveBeenCalledWith('2026-04');
    });

    it('handles year rollover when navigating forward from December', () => {
      render(
        <MonthSelector
          selectedMonth="2026-12"
          onMonthChange={mockOnMonthChange}
        />
      );

      fireEvent.press(screen.getByLabelText('Next month'));

      expect(mockOnMonthChange).toHaveBeenCalledWith('2027-01');
    });

    it('handles year rollover when navigating backward from January', () => {
      render(
        <MonthSelector
          selectedMonth="2026-01"
          onMonthChange={mockOnMonthChange}
        />
      );

      fireEvent.press(screen.getByLabelText('Previous month'));

      expect(mockOnMonthChange).toHaveBeenCalledWith('2025-12');
    });
  });

  describe('Disabled State', () => {
    it('does not call onMonthChange when disabled and previous pressed', () => {
      render(
        <MonthSelector
          selectedMonth="2026-03"
          onMonthChange={mockOnMonthChange}
          disabled
        />
      );

      fireEvent.press(screen.getByLabelText('Previous month'));

      expect(mockOnMonthChange).not.toHaveBeenCalled();
    });

    it('does not call onMonthChange when disabled and next pressed', () => {
      render(
        <MonthSelector
          selectedMonth="2026-03"
          onMonthChange={mockOnMonthChange}
          disabled
        />
      );

      fireEvent.press(screen.getByLabelText('Next month'));

      expect(mockOnMonthChange).not.toHaveBeenCalled();
    });

    it('renders with disabled styles when disabled', () => {
      render(
        <MonthSelector
          selectedMonth="2026-03"
          onMonthChange={mockOnMonthChange}
          disabled
        />
      );

      const prevButton = screen.getByLabelText('Previous month');
      const nextButton = screen.getByLabelText('Next month');

      expect(prevButton.props.accessibilityState?.disabled).toBe(true);
      expect(nextButton.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('has proper accessibility labels on buttons', () => {
      render(
        <MonthSelector
          selectedMonth="2026-03"
          onMonthChange={mockOnMonthChange}
        />
      );

      expect(screen.getByLabelText('Previous month')).toBeTruthy();
      expect(screen.getByLabelText('Next month')).toBeTruthy();
    });

    it('buttons have button role', () => {
      render(
        <MonthSelector
          selectedMonth="2026-03"
          onMonthChange={mockOnMonthChange}
        />
      );

      const prevButton = screen.getByLabelText('Previous month');
      const nextButton = screen.getByLabelText('Next month');

      expect(prevButton.props.accessibilityRole).toBe('button');
      expect(nextButton.props.accessibilityRole).toBe('button');
    });
  });
});
