import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import {
  FormCurrencyInput,
  CurrencyCode,
} from '../../../src/components/forms/FormCurrencyInput';

describe('FormCurrencyInput', () => {
  describe('Rendering', () => {
    it('renders label correctly', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
        />
      );
      expect(screen.getByText('Amount')).toBeTruthy();
    });

    it('renders with testID', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          testID="amount-field"
        />
      );
      expect(screen.getByTestId('amount-field')).toBeTruthy();
    });

    it('renders input element', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          testID="amount-field"
        />
      );
      expect(screen.getByTestId('amount-field-input')).toBeTruthy();
    });

    it('renders currency symbol', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          testID="amount-field"
        />
      );
      expect(screen.getByTestId('amount-field-symbol')).toBeTruthy();
      expect(screen.getByText('$')).toBeTruthy();
    });

    it('renders currency code', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          testID="amount-field"
        />
      );
      expect(screen.getByTestId('amount-field-code')).toBeTruthy();
      expect(screen.getByText('USD')).toBeTruthy();
    });

    it('renders placeholder text', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          placeholder="Enter amount"
        />
      );
      expect(screen.getByPlaceholderText('Enter amount')).toBeTruthy();
    });

    it('renders default placeholder when not provided', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
        />
      );
      expect(screen.getByPlaceholderText('0.00')).toBeTruthy();
    });
  });

  describe('Currency Symbols', () => {
    const currencies: CurrencyCode[] = ['USD', 'EUR', 'ILS'];
    const symbols: Record<CurrencyCode, string> = {
      USD: '$',
      EUR: '€',
      ILS: '₪',
    };

    currencies.forEach((currency) => {
      it(`displays correct symbol for ${currency}`, () => {
        render(
          <FormCurrencyInput
            label="Amount"
            currency={currency}
            value={null}
            onChangeValue={() => {}}
          />
        );
        expect(screen.getByText(symbols[currency])).toBeTruthy();
      });

      it(`displays correct code for ${currency}`, () => {
        render(
          <FormCurrencyInput
            label="Amount"
            currency={currency}
            value={null}
            onChangeValue={() => {}}
          />
        );
        expect(screen.getByText(currency)).toBeTruthy();
      });
    });
  });

  describe('Value Display', () => {
    it('displays value in cents as decimal', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={1234}
          onChangeValue={() => {}}
        />
      );
      expect(screen.getByDisplayValue('12.34')).toBeTruthy();
    });

    it('displays zero correctly', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={0}
          onChangeValue={() => {}}
        />
      );
      expect(screen.getByDisplayValue('0.00')).toBeTruthy();
    });

    it('displays null as empty', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          testID="amount-field"
        />
      );
      const input = screen.getByTestId('amount-field-input');
      expect(input.props.value).toBe('');
    });

    it('displays large values correctly', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={1234567}
          onChangeValue={() => {}}
        />
      );
      expect(screen.getByDisplayValue('12345.67')).toBeTruthy();
    });

    it('displays small values correctly', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={5}
          onChangeValue={() => {}}
        />
      );
      expect(screen.getByDisplayValue('0.05')).toBeTruthy();
    });
  });

  describe('Value Input', () => {
    it('calls onChangeValue with cents when text changes', () => {
      const onChangeValue = jest.fn();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={onChangeValue}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent.changeText(input, '12.34');

      expect(onChangeValue).toHaveBeenCalledWith(1234);
    });

    it('calls onChangeValue with null for empty input', () => {
      const onChangeValue = jest.fn();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={1234}
          onChangeValue={onChangeValue}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent.changeText(input, '');

      expect(onChangeValue).toHaveBeenCalledWith(null);
    });

    it('sanitizes non-numeric input', () => {
      const onChangeValue = jest.fn();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={onChangeValue}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent.changeText(input, 'abc123.45def');

      expect(onChangeValue).toHaveBeenCalledWith(12345);
    });

    it('allows only one decimal point', () => {
      const onChangeValue = jest.fn();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={onChangeValue}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent.changeText(input, '12.34.56');

      expect(onChangeValue).toHaveBeenCalledWith(123456);
    });

    it('limits decimal places to 2', () => {
      const onChangeValue = jest.fn();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={onChangeValue}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent.changeText(input, '12.34');
      fireEvent.changeText(input, '12.345'); // Should not allow more than 2 decimal places

      // Second call should not be made
      expect(onChangeValue).toHaveBeenCalledTimes(1);
      expect(onChangeValue).toHaveBeenLastCalledWith(1234);
    });
  });

  describe('Negative Values', () => {
    it('does not allow negative by default', () => {
      const onChangeValue = jest.fn();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={onChangeValue}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent.changeText(input, '-12.34');

      expect(onChangeValue).toHaveBeenCalledWith(1234);
    });

    it('allows negative when allowNegative is true', () => {
      const onChangeValue = jest.fn();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={onChangeValue}
          allowNegative
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent.changeText(input, '-12.34');

      expect(onChangeValue).toHaveBeenCalledWith(-1234);
    });
  });

  describe('Min/Max Constraints', () => {
    it('respects maxValue', () => {
      const onChangeValue = jest.fn();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={onChangeValue}
          maxValue={10000}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent.changeText(input, '50.00');
      fireEvent.changeText(input, '150.00'); // Above max, should not update

      expect(onChangeValue).toHaveBeenCalledTimes(1);
      expect(onChangeValue).toHaveBeenLastCalledWith(5000);
    });

    it('respects minValue', () => {
      const onChangeValue = jest.fn();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={onChangeValue}
          minValue={1000}
          allowNegative
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent.changeText(input, '50.00');
      fireEvent.changeText(input, '5.00'); // Below min, should not update

      expect(onChangeValue).toHaveBeenCalledTimes(1);
      expect(onChangeValue).toHaveBeenLastCalledWith(5000);
    });
  });

  describe('Focus/Blur Behavior', () => {
    it('calls onFocus when input is focused', () => {
      const onFocus = jest.fn();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          onFocus={onFocus}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent(input, 'focus');

      expect(onFocus).toHaveBeenCalled();
    });

    it('calls onBlur when input loses focus', () => {
      const onBlur = jest.fn();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          onBlur={onBlur}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent(input, 'blur');

      expect(onBlur).toHaveBeenCalled();
    });

    it('formats value on blur', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={1234}
          onChangeValue={() => {}}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent(input, 'focus');
      fireEvent(input, 'blur');

      expect(screen.getByDisplayValue('12.34')).toBeTruthy();
    });
  });

  describe('Error State', () => {
    it('displays error message', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          error="Invalid amount"
        />
      );
      expect(screen.getByText('Invalid amount')).toBeTruthy();
    });

    it('shows error with testID', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          error="Error"
          testID="amount-field"
        />
      );
      expect(screen.getByTestId('amount-field-error')).toBeTruthy();
    });

    it('hides helper text when error present', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          error="Error"
          helperText="Enter amount"
          testID="amount-field"
        />
      );

      expect(screen.getByText('Error')).toBeTruthy();
      expect(screen.queryByTestId('amount-field-helper')).toBeNull();
    });
  });

  describe('Helper Text', () => {
    it('displays helper text', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          helperText="Enter the transaction amount"
        />
      );
      expect(screen.getByText('Enter the transaction amount')).toBeTruthy();
    });

    it('shows helper with testID', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          helperText="Helper"
          testID="amount-field"
        />
      );
      expect(screen.getByTestId('amount-field-helper')).toBeTruthy();
    });
  });

  describe('Disabled State', () => {
    it('disables input when editable is false', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          editable={false}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      expect(input.props.editable).toBe(false);
    });

    it('has disabled accessibility state when not editable', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          editable={false}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      expect(input.props.accessibilityState).toEqual({ disabled: true });
    });
  });

  describe('Keyboard Type', () => {
    it('uses decimal-pad keyboard type', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      expect(input.props.keyboardType).toBe('decimal-pad');
    });
  });

  describe('Accessibility', () => {
    it('has correct accessibility label', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      expect(input.props.accessibilityLabel).toBe('Amount in USD');
    });

    it('has accessibility hint', () => {
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      expect(input.props.accessibilityHint).toBe('Enter amount in USD');
    });
  });

  describe('Custom Styles', () => {
    it('applies custom container style', () => {
      const customStyle = { marginTop: 20 };
      const { toJSON } = render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          containerStyle={customStyle}
        />
      );
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('applies custom input style', () => {
      const customStyle = { fontSize: 20 };
      const { toJSON } = render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          inputStyle={customStyle}
        />
      );
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('applies custom label style', () => {
      const customStyle = { fontSize: 16 };
      const { toJSON } = render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          labelStyle={customStyle}
        />
      );
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });
  });

  describe('Ref Forwarding', () => {
    it('forwards ref to TextInput', () => {
      const ref = React.createRef<TextInput>();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={() => {}}
          ref={ref}
          testID="amount-field"
        />
      );

      expect(ref.current).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles decimal input without leading zero', () => {
      const onChangeValue = jest.fn();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={onChangeValue}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent.changeText(input, '.50');

      expect(onChangeValue).toHaveBeenCalledWith(50);
    });

    it('handles just minus sign', () => {
      const onChangeValue = jest.fn();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={onChangeValue}
          allowNegative
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent.changeText(input, '-');

      expect(onChangeValue).toHaveBeenCalledWith(null);
    });

    it('handles just decimal point', () => {
      const onChangeValue = jest.fn();
      render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={null}
          onChangeValue={onChangeValue}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent.changeText(input, '.');

      expect(onChangeValue).toHaveBeenCalledWith(null);
    });

    it('handles value update while focused', () => {
      const { rerender } = render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={1234}
          onChangeValue={() => {}}
          testID="amount-field"
        />
      );

      const input = screen.getByTestId('amount-field-input');
      fireEvent(input, 'focus');

      // Update value while focused
      rerender(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={5678}
          onChangeValue={() => {}}
          testID="amount-field"
        />
      );

      // Should maintain the display during focus
      expect(screen.getByDisplayValue('12.34')).toBeTruthy();
    });

    it('updates display when not focused', () => {
      const { rerender } = render(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={1234}
          onChangeValue={() => {}}
          testID="amount-field"
        />
      );

      expect(screen.getByDisplayValue('12.34')).toBeTruthy();

      // Update value while not focused
      rerender(
        <FormCurrencyInput
          label="Amount"
          currency="USD"
          value={5678}
          onChangeValue={() => {}}
          testID="amount-field"
        />
      );

      expect(screen.getByDisplayValue('56.78')).toBeTruthy();
    });
  });
});
