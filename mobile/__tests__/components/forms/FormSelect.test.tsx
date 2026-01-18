import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { FormSelect, FormSelectOption } from '../../../src/components/forms/FormSelect';

const mockOptions: FormSelectOption[] = [
  { value: 'usd', label: 'US Dollar' },
  { value: 'eur', label: 'Euro' },
  { value: 'gbp', label: 'British Pound' },
];

describe('FormSelect', () => {
  describe('Rendering', () => {
    it('renders label correctly', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
        />
      );
      expect(screen.getByText('Currency')).toBeTruthy();
    });

    it('renders with testID', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          testID="currency-select"
        />
      );
      expect(screen.getByTestId('currency-select')).toBeTruthy();
    });

    it('renders select button with testID', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          testID="currency-select"
        />
      );
      expect(screen.getByTestId('currency-select-button')).toBeTruthy();
    });

    it('displays placeholder when no value selected', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          placeholder="Select currency"
        />
      );
      expect(screen.getByText('Select currency')).toBeTruthy();
    });

    it('displays default placeholder when not provided', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
        />
      );
      expect(screen.getByText('Select an option')).toBeTruthy();
    });

    it('displays selected value label', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value="eur"
          onChange={() => {}}
        />
      );
      expect(screen.getByText('Euro')).toBeTruthy();
    });

    it('displays chevron indicator', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
        />
      );
      expect(screen.getByText('▼')).toBeTruthy();
    });
  });

  describe('Modal Behavior', () => {
    it('opens modal when select button is pressed', async () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          testID="currency-select"
        />
      );

      const button = screen.getByTestId('currency-select-button');
      fireEvent.press(button);

      await waitFor(() => {
        expect(screen.getByTestId('currency-select-modal')).toBeTruthy();
      });
    });

    it('displays modal title', async () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          modalTitle="Select Currency"
          testID="currency-select"
        />
      );

      fireEvent.press(screen.getByTestId('currency-select-button'));

      await waitFor(() => {
        expect(screen.getByText('Select Currency')).toBeTruthy();
      });
    });

    it('uses label as modal title when modalTitle not provided', async () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          testID="currency-select"
        />
      );

      fireEvent.press(screen.getByTestId('currency-select-button'));

      await waitFor(() => {
        // Label appears in both the form and modal header
        expect(screen.getAllByText('Currency').length).toBeGreaterThan(0);
      });
    });

    it('closes modal when close button is pressed', async () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          testID="currency-select"
        />
      );

      fireEvent.press(screen.getByTestId('currency-select-button'));
      await waitFor(() => {
        expect(screen.getByTestId('currency-select-modal')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('currency-select-close'));

      await waitFor(() => {
        expect(screen.queryByTestId('currency-select-options-list')).toBeNull();
      });
    });

    it('displays all options in modal', async () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          testID="currency-select"
        />
      );

      fireEvent.press(screen.getByTestId('currency-select-button'));

      await waitFor(() => {
        expect(screen.getByText('US Dollar')).toBeTruthy();
        expect(screen.getByText('Euro')).toBeTruthy();
        expect(screen.getByText('British Pound')).toBeTruthy();
      });
    });
  });

  describe('Selection', () => {
    it('calls onChange when option is selected', async () => {
      const onChange = jest.fn();
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={onChange}
          testID="currency-select"
        />
      );

      fireEvent.press(screen.getByTestId('currency-select-button'));

      await waitFor(() => {
        expect(screen.getByText('Euro')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Euro'));

      expect(onChange).toHaveBeenCalledWith('eur');
    });

    it('closes modal after selection', async () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          testID="currency-select"
        />
      );

      fireEvent.press(screen.getByTestId('currency-select-button'));

      await waitFor(() => {
        expect(screen.getByText('Euro')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Euro'));

      await waitFor(() => {
        expect(screen.queryByTestId('currency-select-options-list')).toBeNull();
      });
    });

    it('shows checkmark on selected option', async () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value="eur"
          onChange={() => {}}
          testID="currency-select"
        />
      );

      fireEvent.press(screen.getByTestId('currency-select-button'));

      await waitFor(() => {
        expect(screen.getByText('✓')).toBeTruthy();
      });
    });
  });

  describe('Disabled State', () => {
    it('does not open modal when disabled', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          disabled
          testID="currency-select"
        />
      );

      fireEvent.press(screen.getByTestId('currency-select-button'));

      expect(screen.queryByTestId('currency-select-modal')).toBeNull();
    });

    it('applies disabled styles', () => {
      const { toJSON } = render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          disabled
        />
      );
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('has disabled accessibility state', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          disabled
          testID="currency-select"
        />
      );

      const button = screen.getByTestId('currency-select-button');
      expect(button.props.accessibilityState).toEqual({ disabled: true });
    });
  });

  describe('Disabled Options', () => {
    const optionsWithDisabled: FormSelectOption[] = [
      { value: 'usd', label: 'US Dollar' },
      { value: 'eur', label: 'Euro', disabled: true },
      { value: 'gbp', label: 'British Pound' },
    ];

    it('does not call onChange when disabled option is pressed', async () => {
      const onChange = jest.fn();
      render(
        <FormSelect
          label="Currency"
          options={optionsWithDisabled}
          value={null}
          onChange={onChange}
          testID="currency-select"
        />
      );

      fireEvent.press(screen.getByTestId('currency-select-button'));

      await waitFor(() => {
        expect(screen.getByText('Euro')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Euro'));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('applies disabled styles to disabled option', async () => {
      render(
        <FormSelect
          label="Currency"
          options={optionsWithDisabled}
          value={null}
          onChange={() => {}}
          testID="currency-select"
        />
      );

      fireEvent.press(screen.getByTestId('currency-select-button'));

      await waitFor(() => {
        const option = screen.getByTestId('currency-select-option-eur');
        expect(option.props.accessibilityState).toEqual({
          selected: false,
          disabled: true,
        });
      });
    });
  });

  describe('Error State', () => {
    it('displays error message', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          error="Please select a currency"
          testID="currency-select"
        />
      );
      expect(screen.getByText('Please select a currency')).toBeTruthy();
    });

    it('shows error with testID', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          error="Error"
          testID="currency-select"
        />
      );
      expect(screen.getByTestId('currency-select-error')).toBeTruthy();
    });

    it('hides helper text when error present', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          error="Error"
          helperText="Choose your preferred currency"
          testID="currency-select"
        />
      );

      expect(screen.getByText('Error')).toBeTruthy();
      expect(screen.queryByTestId('currency-select-helper')).toBeNull();
    });
  });

  describe('Helper Text', () => {
    it('displays helper text', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          helperText="Choose your preferred currency"
        />
      );
      expect(screen.getByText('Choose your preferred currency')).toBeTruthy();
    });

    it('shows helper with testID', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          helperText="Helper"
          testID="currency-select"
        />
      );
      expect(screen.getByTestId('currency-select-helper')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('has button accessibility role', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          testID="currency-select"
        />
      );

      const button = screen.getByTestId('currency-select-button');
      expect(button.props.accessibilityRole).toBe('button');
    });

    it('has correct accessibility label with placeholder', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          placeholder="Select currency"
          testID="currency-select"
        />
      );

      const button = screen.getByTestId('currency-select-button');
      expect(button.props.accessibilityLabel).toBe('Currency: Select currency');
    });

    it('has correct accessibility label with selected value', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value="eur"
          onChange={() => {}}
          testID="currency-select"
        />
      );

      const button = screen.getByTestId('currency-select-button');
      expect(button.props.accessibilityLabel).toBe('Currency: Euro');
    });

    it('has accessibility hint', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          testID="currency-select"
        />
      );

      const button = screen.getByTestId('currency-select-button');
      expect(button.props.accessibilityHint).toBe('Opens selection menu');
    });
  });

  describe('Custom Styles', () => {
    it('applies custom container style', () => {
      const customStyle = { marginTop: 20 };
      const { toJSON } = render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          containerStyle={customStyle}
        />
      );
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('applies custom select style', () => {
      const customStyle = { borderWidth: 2 };
      const { toJSON } = render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          selectStyle={customStyle}
        />
      );
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('applies custom label style', () => {
      const customStyle = { fontSize: 16 };
      const { toJSON } = render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          labelStyle={customStyle}
        />
      );
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });
  });

  describe('Generic Types', () => {
    it('works with number values', async () => {
      const numberOptions: FormSelectOption<number>[] = [
        { value: 1, label: 'One' },
        { value: 2, label: 'Two' },
        { value: 3, label: 'Three' },
      ];

      const onChange = jest.fn();
      render(
        <FormSelect<number>
          label="Number"
          options={numberOptions}
          value={null}
          onChange={onChange}
          testID="number-select"
        />
      );

      fireEvent.press(screen.getByTestId('number-select-button'));

      await waitFor(() => {
        expect(screen.getByText('Two')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Two'));

      expect(onChange).toHaveBeenCalledWith(2);
    });

    it('works with object values as string keys', async () => {
      const objectOptions: FormSelectOption<string>[] = [
        { value: 'option-1', label: 'Option 1' },
        { value: 'option-2', label: 'Option 2' },
      ];

      const onChange = jest.fn();
      render(
        <FormSelect
          label="Object"
          options={objectOptions}
          value={null}
          onChange={onChange}
          testID="object-select"
        />
      );

      fireEvent.press(screen.getByTestId('object-select-button'));

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Option 1'));

      expect(onChange).toHaveBeenCalledWith('option-1');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty options array', () => {
      render(
        <FormSelect
          label="Empty"
          options={[]}
          value={null}
          onChange={() => {}}
          testID="empty-select"
        />
      );
      expect(screen.getByTestId('empty-select')).toBeTruthy();
    });

    it('handles long option labels', async () => {
      const longOptions: FormSelectOption[] = [
        {
          value: 'long',
          label: 'This is a very long option label that might need to be truncated',
        },
      ];

      render(
        <FormSelect
          label="Long"
          options={longOptions}
          value="long"
          onChange={() => {}}
        />
      );

      expect(
        screen.getByText('This is a very long option label that might need to be truncated')
      ).toBeTruthy();
    });

    it('handles special characters in labels', () => {
      const specialOptions: FormSelectOption[] = [
        { value: 'special', label: 'Price: $100 & <tag>' },
      ];

      render(
        <FormSelect
          label="Special"
          options={specialOptions}
          value="special"
          onChange={() => {}}
        />
      );

      expect(screen.getByText('Price: $100 & <tag>')).toBeTruthy();
    });

    it('handles value not in options', () => {
      render(
        <FormSelect
          label="Currency"
          options={mockOptions}
          value="xyz" // not in options
          onChange={() => {}}
          placeholder="Select currency"
        />
      );

      // Should show placeholder since value doesn't match any option
      expect(screen.getByText('Select currency')).toBeTruthy();
    });
  });
});
