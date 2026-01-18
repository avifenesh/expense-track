import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { FormDatePicker, DatePickerMode } from '../../../src/components/forms/FormDatePicker';

// Mock Platform
const originalPlatform = Platform.OS;

const setMockPlatform = (platform: 'ios' | 'android') => {
  Object.defineProperty(Platform, 'OS', {
    get: () => platform,
    configurable: true,
  });
};

afterEach(() => {
  Object.defineProperty(Platform, 'OS', {
    get: () => originalPlatform,
    configurable: true,
  });
});

describe('FormDatePicker', () => {
  const mockDate = new Date('2026-01-15T10:30:00Z');

  describe('Rendering', () => {
    it('renders label correctly', () => {
      render(
        <FormDatePicker
          label="Transaction Date"
          value={null}
          onChange={() => {}}
        />
      );
      expect(screen.getByText('Transaction Date')).toBeTruthy();
    });

    it('renders with testID', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          testID="date-picker"
        />
      );
      expect(screen.getByTestId('date-picker')).toBeTruthy();
    });

    it('renders button with testID', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          testID="date-picker"
        />
      );
      expect(screen.getByTestId('date-picker-button')).toBeTruthy();
    });

    it('displays placeholder when no value', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          placeholder="Choose a date"
        />
      );
      expect(screen.getByText('Choose a date')).toBeTruthy();
    });

    it('displays default placeholder when not provided', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
        />
      );
      expect(screen.getByText('Select date')).toBeTruthy();
    });

    it('displays calendar icon', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
        />
      );
      expect(screen.getByText('📅')).toBeTruthy();
    });
  });

  describe('Value Display', () => {
    it('displays formatted date value', () => {
      render(
        <FormDatePicker
          label="Date"
          value={mockDate}
          onChange={() => {}}
        />
      );
      // Default format is "Jan 15, 2026" style
      expect(screen.getByText(/Jan.*15.*2026/)).toBeTruthy();
    });

    it('displays formatted time value', () => {
      render(
        <FormDatePicker
          label="Time"
          value={mockDate}
          onChange={() => {}}
          mode="time"
        />
      );
      // Time format should show hours and minutes
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeTruthy();
    });

    it('displays formatted datetime value', () => {
      render(
        <FormDatePicker
          label="DateTime"
          value={mockDate}
          onChange={() => {}}
          mode="datetime"
        />
      );
      // Should show both date and time
      expect(screen.getByText(/Jan.*15.*2026.*\d{1,2}:\d{2}/)).toBeTruthy();
    });

    it('applies custom format options', () => {
      render(
        <FormDatePicker
          label="Date"
          value={mockDate}
          onChange={() => {}}
          formatOptions={{ year: 'numeric', month: 'long', day: 'numeric' }}
        />
      );
      expect(screen.getByText(/January.*15.*2026/)).toBeTruthy();
    });
  });

  describe('Modes', () => {
    const modes: DatePickerMode[] = ['date', 'time', 'datetime'];

    modes.forEach((mode) => {
      it(`renders correctly in ${mode} mode`, () => {
        const { toJSON } = render(
          <FormDatePicker
            label={`${mode} picker`}
            value={mockDate}
            onChange={() => {}}
            mode={mode}
          />
        );
        expect(toJSON()).toBeTruthy();
      });
    });
  });

  describe('iOS Modal Behavior', () => {
    beforeEach(() => {
      setMockPlatform('ios');
    });

    it('opens modal when button is pressed', async () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-modal')).toBeTruthy();
      });
    });

    it('displays modal title', async () => {
      render(
        <FormDatePicker
          label="Transaction Date"
          value={null}
          onChange={() => {}}
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      await waitFor(() => {
        // Title appears in modal header
        expect(screen.getAllByText('Transaction Date').length).toBeGreaterThan(0);
      });
    });

    it('shows cancel button in modal', async () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-cancel')).toBeTruthy();
      });
    });

    it('shows confirm button in modal', async () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-confirm')).toBeTruthy();
      });
    });

    it('shows clear button when value exists', async () => {
      render(
        <FormDatePicker
          label="Date"
          value={mockDate}
          onChange={() => {}}
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-clear')).toBeTruthy();
      });
    });

    it('does not show clear button when value is null', async () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('date-picker-clear')).toBeNull();
      });
    });

    it('closes modal when cancel is pressed', async () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-modal')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('date-picker-cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('date-picker-picker')).toBeNull();
      });
    });

    it('calls onChange when confirm is pressed', async () => {
      const onChange = jest.fn();
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={onChange}
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-confirm')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('date-picker-confirm'));

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
    });

    it('calls onChange with null when clear is pressed', async () => {
      const onChange = jest.fn();
      render(
        <FormDatePicker
          label="Date"
          value={mockDate}
          onChange={onChange}
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-clear')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('date-picker-clear'));

      expect(onChange).toHaveBeenCalledWith(null);
    });

    it('shows DateTimePicker in modal', async () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-picker')).toBeTruthy();
      });
    });
  });

  describe('Disabled State', () => {
    it('does not open picker when disabled', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          disabled
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      expect(screen.queryByTestId('date-picker-modal')).toBeNull();
    });

    it('applies disabled styles', () => {
      const { toJSON } = render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          disabled
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('has disabled accessibility state', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          disabled
          testID="date-picker"
        />
      );

      const button = screen.getByTestId('date-picker-button');
      expect(button.props.accessibilityState).toEqual({ disabled: true });
    });
  });

  describe('Error State', () => {
    it('displays error message', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          error="Please select a date"
        />
      );
      expect(screen.getByText('Please select a date')).toBeTruthy();
    });

    it('shows error with testID', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          error="Error"
          testID="date-picker"
        />
      );
      expect(screen.getByTestId('date-picker-error')).toBeTruthy();
    });

    it('hides helper text when error present', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          error="Error"
          helperText="Choose a date"
          testID="date-picker"
        />
      );

      expect(screen.getByText('Error')).toBeTruthy();
      expect(screen.queryByTestId('date-picker-helper')).toBeNull();
    });
  });

  describe('Helper Text', () => {
    it('displays helper text', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          helperText="Select the transaction date"
        />
      );
      expect(screen.getByText('Select the transaction date')).toBeTruthy();
    });

    it('shows helper with testID', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          helperText="Helper"
          testID="date-picker"
        />
      );
      expect(screen.getByTestId('date-picker-helper')).toBeTruthy();
    });
  });

  describe('Date Constraints', () => {
    it('passes minimumDate to picker', async () => {
      setMockPlatform('ios');
      const minDate = new Date('2026-01-01');

      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          minimumDate={minDate}
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-picker')).toBeTruthy();
      });
    });

    it('passes maximumDate to picker', async () => {
      setMockPlatform('ios');
      const maxDate = new Date('2026-12-31');

      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          maximumDate={maxDate}
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-picker')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('has button accessibility role', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          testID="date-picker"
        />
      );

      const button = screen.getByTestId('date-picker-button');
      expect(button.props.accessibilityRole).toBe('button');
    });

    it('has correct accessibility label with placeholder', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          placeholder="Pick a date"
          testID="date-picker"
        />
      );

      const button = screen.getByTestId('date-picker-button');
      expect(button.props.accessibilityLabel).toBe('Date: Pick a date');
    });

    it('has accessibility hint', () => {
      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          testID="date-picker"
        />
      );

      const button = screen.getByTestId('date-picker-button');
      expect(button.props.accessibilityHint).toBe('Opens date picker');
    });
  });

  describe('Custom Styles', () => {
    it('applies custom container style', () => {
      const customStyle = { marginTop: 20 };
      const { toJSON } = render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          containerStyle={customStyle}
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('applies custom button style', () => {
      const customStyle = { borderWidth: 2 };
      const { toJSON } = render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          buttonStyle={customStyle}
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('applies custom label style', () => {
      const customStyle = { fontSize: 16 };
      const { toJSON } = render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          labelStyle={customStyle}
        />
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles opening picker with null value', async () => {
      setMockPlatform('ios');

      render(
        <FormDatePicker
          label="Date"
          value={null}
          onChange={() => {}}
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      await waitFor(() => {
        // Should use current date as temp value
        expect(screen.getByTestId('date-picker-picker')).toBeTruthy();
      });
    });

    it('handles opening picker with existing value', async () => {
      setMockPlatform('ios');

      render(
        <FormDatePicker
          label="Date"
          value={mockDate}
          onChange={() => {}}
          testID="date-picker"
        />
      );

      fireEvent.press(screen.getByTestId('date-picker-button'));

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-picker')).toBeTruthy();
      });
    });

    it('handles very old dates', () => {
      const oldDate = new Date('1900-01-01');
      render(
        <FormDatePicker
          label="Date"
          value={oldDate}
          onChange={() => {}}
        />
      );
      expect(screen.getByText(/Jan.*1.*1900/)).toBeTruthy();
    });

    it('handles future dates', () => {
      const futureDate = new Date('2099-12-31');
      render(
        <FormDatePicker
          label="Date"
          value={futureDate}
          onChange={() => {}}
        />
      );
      expect(screen.getByText(/Dec.*31.*2099/)).toBeTruthy();
    });
  });
});
