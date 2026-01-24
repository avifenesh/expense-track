import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MonthSelector } from '../../src/components/MonthSelector';

describe('MonthSelector', () => {
  const mockOnMonthChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Set system time to December 2026 so all 2026 tests work
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-12-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
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
          allowFutureMonths
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

    it('month label has proper accessibility for modal trigger', () => {
      render(
        <MonthSelector
          selectedMonth="2026-03"
          onMonthChange={mockOnMonthChange}
          testID="month-selector"
        />
      );

      const label = screen.getByTestId('month-selector-label');
      expect(label.props.accessibilityRole).toBe('button');
      expect(label.props.accessibilityLabel).toBe('Select month: March 2026');
      expect(label.props.accessibilityHint).toBe('Opens month picker');
    });
  });

  describe('Bounds Testing', () => {
    it('disables previous button when at minMonth', () => {
      render(
        <MonthSelector
          selectedMonth="2026-01"
          onMonthChange={mockOnMonthChange}
          minMonth="2026-01"
        />
      );

      const prevButton = screen.getByLabelText('Previous month');
      expect(prevButton.props.accessibilityState?.disabled).toBe(true);

      fireEvent.press(prevButton);
      expect(mockOnMonthChange).not.toHaveBeenCalled();
    });

    it('disables next button when at maxMonth', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          maxMonth="2026-06"
        />
      );

      const nextButton = screen.getByLabelText('Next month');
      expect(nextButton.props.accessibilityState?.disabled).toBe(true);

      fireEvent.press(nextButton);
      expect(mockOnMonthChange).not.toHaveBeenCalled();
    });

    it('defaults maxMonth to current month', () => {
      // System time is set to 2026-12-15
      render(
        <MonthSelector
          selectedMonth="2026-12"
          onMonthChange={mockOnMonthChange}
        />
      );

      const nextButton = screen.getByLabelText('Next month');
      expect(nextButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('allows future months when allowFutureMonths is true', () => {
      render(
        <MonthSelector
          selectedMonth="2026-12"
          onMonthChange={mockOnMonthChange}
          allowFutureMonths
        />
      );

      const nextButton = screen.getByLabelText('Next month');
      expect(nextButton.props.accessibilityState?.disabled).toBe(false);

      fireEvent.press(nextButton);
      expect(mockOnMonthChange).toHaveBeenCalledWith('2027-01');
    });

    it('respects explicit maxMonth even with allowFutureMonths', () => {
      render(
        <MonthSelector
          selectedMonth="2027-06"
          onMonthChange={mockOnMonthChange}
          allowFutureMonths
          maxMonth="2027-06"
        />
      );

      const nextButton = screen.getByLabelText('Next month');
      expect(nextButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('allows navigation within bounds', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          minMonth="2026-01"
          maxMonth="2026-12"
        />
      );

      const prevButton = screen.getByLabelText('Previous month');
      const nextButton = screen.getByLabelText('Next month');

      expect(prevButton.props.accessibilityState?.disabled).toBe(false);
      expect(nextButton.props.accessibilityState?.disabled).toBe(false);
    });

    it('handles single selectable month (minMonth = maxMonth)', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          minMonth="2026-06"
          maxMonth="2026-06"
        />
      );

      const prevButton = screen.getByLabelText('Previous month');
      const nextButton = screen.getByLabelText('Next month');

      expect(prevButton.props.accessibilityState?.disabled).toBe(true);
      expect(nextButton.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Modal Testing', () => {
    it('opens modal when label pressed', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));

      expect(screen.getByText('Select Month')).toBeTruthy();
    });

    it('does not open modal when disabled', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          disabled
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));

      expect(screen.queryByText('Select Month')).toBeNull();
    });

    it('closes modal when close button pressed', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));
      expect(screen.getByText('Select Month')).toBeTruthy();

      fireEvent.press(screen.getByTestId('month-selector-close'));
      expect(screen.queryByText('Select Month')).toBeNull();
    });

    it('closes modal when month is selected', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));
      expect(screen.getByText('Select Month')).toBeTruthy();

      // Select March (index 2)
      fireEvent.press(screen.getByTestId('month-selector-month-2'));

      expect(mockOnMonthChange).toHaveBeenCalledWith('2026-03');
      expect(screen.queryByText('Select Month')).toBeNull();
    });

    it('displays year selector in modal', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));

      expect(screen.getByTestId('month-selector-year')).toBeTruthy();
      expect(screen.getByText('2026')).toBeTruthy();
    });

    it('displays month grid in modal', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));

      expect(screen.getByText('Jan')).toBeTruthy();
      expect(screen.getByText('Feb')).toBeTruthy();
      expect(screen.getByText('Mar')).toBeTruthy();
      expect(screen.getByText('Dec')).toBeTruthy();
    });
  });

  describe('Year/Month Selection', () => {
    it('navigates to previous year', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));
      fireEvent.press(screen.getByTestId('month-selector-year-prev'));

      expect(screen.getByText('2025')).toBeTruthy();
    });

    it('navigates to next year', () => {
      render(
        <MonthSelector
          selectedMonth="2025-06"
          onMonthChange={mockOnMonthChange}
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));
      fireEvent.press(screen.getByTestId('month-selector-year-next'));

      expect(screen.getByText('2026')).toBeTruthy();
    });

    it('selects month and triggers callback with correct value', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));

      // Navigate to 2025
      fireEvent.press(screen.getByTestId('month-selector-year-prev'));

      // Select October (index 9)
      fireEvent.press(screen.getByTestId('month-selector-month-9'));

      expect(mockOnMonthChange).toHaveBeenCalledWith('2025-10');
    });

    it('highlights currently selected month', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));

      // June is index 5
      const juneButton = screen.getByTestId('month-selector-month-5');
      expect(juneButton.props.accessibilityState?.selected).toBe(true);
    });

    it('disables months outside bounds in year before minMonth', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          minMonth="2026-03"
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));

      // January (index 0) and February (index 1) should be disabled
      const janButton = screen.getByTestId('month-selector-month-0');
      const febButton = screen.getByTestId('month-selector-month-1');
      const marButton = screen.getByTestId('month-selector-month-2');

      expect(janButton.props.accessibilityState?.disabled).toBe(true);
      expect(febButton.props.accessibilityState?.disabled).toBe(true);
      expect(marButton.props.accessibilityState?.disabled).toBe(false);
    });

    it('disables months outside bounds in year after maxMonth', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          maxMonth="2026-09"
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));

      // October (index 9), November (index 10), December (index 11) should be disabled
      const sepButton = screen.getByTestId('month-selector-month-8');
      const octButton = screen.getByTestId('month-selector-month-9');
      const novButton = screen.getByTestId('month-selector-month-10');
      const decButton = screen.getByTestId('month-selector-month-11');

      expect(sepButton.props.accessibilityState?.disabled).toBe(false);
      expect(octButton.props.accessibilityState?.disabled).toBe(true);
      expect(novButton.props.accessibilityState?.disabled).toBe(true);
      expect(decButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('disables year navigation at min/max year boundaries', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          minMonth="2026-01"
          maxMonth="2026-12"
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));

      // When viewing 2026 with min=2026-01 and max=2026-12:
      // - minYear = min(currentYear - yearRange, 2026) = 2021 (since current year is 2026)
      // - maxYear = max(currentYear, 2026) = 2026
      // So prev should be enabled (can go to 2025), but next should be disabled (can't go past 2026)
      const _yearPrevButton = screen.getByTestId('month-selector-year-prev');
      const yearNextButton = screen.getByTestId('month-selector-year-next');

      // Year navigation allows going back in time (minYear is calculated from yearRange)
      // but maxYear is limited by maxMonth
      expect(yearNextButton.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles December to January year boundary in modal', () => {
      render(
        <MonthSelector
          selectedMonth="2026-12"
          onMonthChange={mockOnMonthChange}
          allowFutureMonths
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));

      // Navigate to next year
      fireEvent.press(screen.getByTestId('month-selector-year-next'));

      // Select January
      fireEvent.press(screen.getByTestId('month-selector-month-0'));

      expect(mockOnMonthChange).toHaveBeenCalledWith('2027-01');
    });

    it('propagates testID to child elements', () => {
      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          testID="test-month-selector"
        />
      );

      expect(screen.getByTestId('test-month-selector')).toBeTruthy();
      expect(screen.getByTestId('test-month-selector-prev')).toBeTruthy();
      expect(screen.getByTestId('test-month-selector-next')).toBeTruthy();
      expect(screen.getByTestId('test-month-selector-label')).toBeTruthy();
    });

    it('respects custom yearRange prop', () => {
      jest.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));

      render(
        <MonthSelector
          selectedMonth="2026-06"
          onMonthChange={mockOnMonthChange}
          yearRange={2}
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));

      // With yearRange=2 and current year 2026, min year should be 2024
      // Navigate back to 2024
      fireEvent.press(screen.getByTestId('month-selector-year-prev'));
      expect(screen.getByText('2025')).toBeTruthy();

      fireEvent.press(screen.getByTestId('month-selector-year-prev'));
      expect(screen.getByText('2024')).toBeTruthy();

      // Should not be able to go further back
      const yearPrevButton = screen.getByTestId('month-selector-year-prev');
      expect(yearPrevButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('initializes picker year from selectedMonth', () => {
      render(
        <MonthSelector
          selectedMonth="2024-06"
          onMonthChange={mockOnMonthChange}
          testID="month-selector"
        />
      );

      fireEvent.press(screen.getByTestId('month-selector-label'));

      // Should show 2024 initially
      expect(screen.getByText('2024')).toBeTruthy();
    });
  });
});
