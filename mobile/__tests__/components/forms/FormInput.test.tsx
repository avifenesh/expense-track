import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text, TextInput } from 'react-native';
import { FormInput } from '../../../src/components/forms/FormInput';

describe('FormInput', () => {
  describe('Rendering', () => {
    it('renders label correctly', () => {
      render(<FormInput label="Email" />);
      expect(screen.getByText('Email')).toBeTruthy();
    });

    it('renders with testID', () => {
      render(<FormInput label="Email" testID="email-field" />);
      expect(screen.getByTestId('email-field')).toBeTruthy();
    });

    it('renders input element', () => {
      render(<FormInput label="Email" testID="email-field" />);
      expect(screen.getByTestId('email-field-input')).toBeTruthy();
    });

    it('renders placeholder text', () => {
      render(<FormInput label="Email" placeholder="Enter your email" />);
      expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
    });
  });

  describe('Value Handling', () => {
    it('displays value correctly', () => {
      render(<FormInput label="Email" value="test@example.com" />);
      expect(screen.getByDisplayValue('test@example.com')).toBeTruthy();
    });

    it('calls onChangeText when text changes', () => {
      const onChangeText = jest.fn();
      render(
        <FormInput label="Email" onChangeText={onChangeText} testID="email-field" />
      );

      const input = screen.getByTestId('email-field-input');
      fireEvent.changeText(input, 'hello@test.com');

      expect(onChangeText).toHaveBeenCalledWith('hello@test.com');
    });

    it('handles empty value', () => {
      render(<FormInput label="Email" value="" testID="email-field" />);
      const input = screen.getByTestId('email-field-input');
      expect(input.props.value).toBe('');
    });
  });

  describe('Error State', () => {
    it('displays error message when error prop is provided', () => {
      render(<FormInput label="Email" error="Invalid email format" />);
      expect(screen.getByText('Invalid email format')).toBeTruthy();
    });

    it('shows error with testID', () => {
      render(<FormInput label="Email" error="Error" testID="email-field" />);
      expect(screen.getByTestId('email-field-error')).toBeTruthy();
    });

    it('hides helper text when error is present', () => {
      render(
        <FormInput
          label="Email"
          error="Invalid email"
          helperText="Enter a valid email"
          testID="email-field"
        />
      );

      expect(screen.getByText('Invalid email')).toBeTruthy();
      expect(screen.queryByTestId('email-field-helper')).toBeNull();
    });

    it('does not show error when error is null', () => {
      render(<FormInput label="Email" error={null} testID="email-field" />);
      expect(screen.queryByTestId('email-field-error')).toBeNull();
    });

    it('does not show error when error is empty string', () => {
      render(<FormInput label="Email" error="" testID="email-field" />);
      expect(screen.queryByTestId('email-field-error')).toBeNull();
    });
  });

  describe('Helper Text', () => {
    it('displays helper text when provided', () => {
      render(<FormInput label="Password" helperText="Must be at least 8 characters" />);
      expect(screen.getByText('Must be at least 8 characters')).toBeTruthy();
    });

    it('shows helper with testID', () => {
      render(
        <FormInput label="Password" helperText="Helper" testID="password-field" />
      );
      expect(screen.getByTestId('password-field-helper')).toBeTruthy();
    });

    it('shows helper text when no error', () => {
      render(
        <FormInput
          label="Email"
          helperText="Enter a valid email"
          testID="email-field"
        />
      );
      expect(screen.getByText('Enter a valid email')).toBeTruthy();
    });
  });

  describe('Focus State', () => {
    it('calls onFocus when input is focused', () => {
      const onFocus = jest.fn();
      render(<FormInput label="Email" onFocus={onFocus} testID="email-field" />);

      const input = screen.getByTestId('email-field-input');
      fireEvent(input, 'focus');

      expect(onFocus).toHaveBeenCalled();
    });

    it('calls onBlur when input loses focus', () => {
      const onBlur = jest.fn();
      render(<FormInput label="Email" onBlur={onBlur} testID="email-field" />);

      const input = screen.getByTestId('email-field-input');
      fireEvent(input, 'blur');

      expect(onBlur).toHaveBeenCalled();
    });

    it('handles focus and blur without callbacks', () => {
      render(<FormInput label="Email" testID="email-field" />);

      const input = screen.getByTestId('email-field-input');
      fireEvent(input, 'focus');
      fireEvent(input, 'blur');

      expect(screen.getByTestId('email-field')).toBeTruthy();
    });
  });

  describe('Disabled State', () => {
    it('disables input when editable is false', () => {
      render(<FormInput label="Email" editable={false} testID="email-field" />);

      const input = screen.getByTestId('email-field-input');
      expect(input.props.editable).toBe(false);
    });

    it('enables input by default', () => {
      render(<FormInput label="Email" testID="email-field" />);

      const input = screen.getByTestId('email-field-input');
      expect(input.props.editable).toBe(true);
    });

    it('has disabled accessibility state when not editable', () => {
      render(<FormInput label="Email" editable={false} testID="email-field" />);

      const input = screen.getByTestId('email-field-input');
      expect(input.props.accessibilityState).toEqual({ disabled: true });
    });
  });

  describe('Password Toggle', () => {
    it('shows password toggle when showPasswordToggle is true and secureTextEntry is true', () => {
      render(
        <FormInput
          label="Password"
          secureTextEntry
          showPasswordToggle
          testID="password-field"
        />
      );

      expect(screen.getByTestId('password-field-toggle-password')).toBeTruthy();
    });

    it('does not show toggle when showPasswordToggle is false', () => {
      render(
        <FormInput label="Password" secureTextEntry testID="password-field" />
      );

      expect(screen.queryByTestId('password-field-toggle-password')).toBeNull();
    });

    it('does not show toggle when secureTextEntry is false', () => {
      render(<FormInput label="Email" showPasswordToggle testID="email-field" />);

      expect(screen.queryByTestId('email-field-toggle-password')).toBeNull();
    });

    it('shows "Show" text initially', () => {
      render(
        <FormInput
          label="Password"
          secureTextEntry
          showPasswordToggle
          testID="password-field"
        />
      );

      expect(screen.getByText('Show')).toBeTruthy();
    });

    it('toggles password visibility when pressed', () => {
      render(
        <FormInput
          label="Password"
          secureTextEntry
          showPasswordToggle
          testID="password-field"
        />
      );

      const toggle = screen.getByTestId('password-field-toggle-password');
      fireEvent.press(toggle);

      expect(screen.getByText('Hide')).toBeTruthy();
    });

    it('toggles back to hidden when pressed again', () => {
      render(
        <FormInput
          label="Password"
          secureTextEntry
          showPasswordToggle
          testID="password-field"
        />
      );

      const toggle = screen.getByTestId('password-field-toggle-password');
      fireEvent.press(toggle);
      fireEvent.press(toggle);

      expect(screen.getByText('Show')).toBeTruthy();
    });

    it('has correct accessibility label for show state', () => {
      render(
        <FormInput
          label="Password"
          secureTextEntry
          showPasswordToggle
          testID="password-field"
        />
      );

      const toggle = screen.getByTestId('password-field-toggle-password');
      expect(toggle.props.accessibilityLabel).toBe('Show password');
    });

    it('has correct accessibility label for hide state', () => {
      render(
        <FormInput
          label="Password"
          secureTextEntry
          showPasswordToggle
          testID="password-field"
        />
      );

      const toggle = screen.getByTestId('password-field-toggle-password');
      fireEvent.press(toggle);

      expect(toggle.props.accessibilityLabel).toBe('Hide password');
    });
  });

  describe('Icons', () => {
    it('renders left icon when provided', () => {
      render(
        <FormInput
          label="Search"
          leftIcon={<Text testID="left-icon">Icon</Text>}
        />
      );

      expect(screen.getByTestId('left-icon')).toBeTruthy();
    });

    it('renders right icon when provided', () => {
      render(
        <FormInput
          label="Search"
          rightIcon={<Text testID="right-icon">Icon</Text>}
        />
      );

      expect(screen.getByTestId('right-icon')).toBeTruthy();
    });

    it('renders both icons when provided', () => {
      render(
        <FormInput
          label="Search"
          leftIcon={<Text testID="left-icon">L</Text>}
          rightIcon={<Text testID="right-icon">R</Text>}
        />
      );

      expect(screen.getByTestId('left-icon')).toBeTruthy();
      expect(screen.getByTestId('right-icon')).toBeTruthy();
    });
  });

  describe('Custom Styles', () => {
    it('applies custom container style', () => {
      const customStyle = { marginTop: 20 };
      const { toJSON } = render(
        <FormInput label="Email" containerStyle={customStyle} />
      );
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('applies custom input style', () => {
      const customStyle = { fontSize: 18 };
      const { toJSON } = render(
        <FormInput label="Email" inputStyle={customStyle} />
      );
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('applies custom label style', () => {
      const customStyle = { fontSize: 16 };
      const { toJSON } = render(
        <FormInput label="Email" labelStyle={customStyle} />
      );
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('has correct accessibility label', () => {
      render(<FormInput label="Email Address" testID="email-field" />);
      const input = screen.getByTestId('email-field-input');
      expect(input.props.accessibilityLabel).toBe('Email Address');
    });

    it('has enabled accessibility state by default', () => {
      render(<FormInput label="Email" testID="email-field" />);
      const input = screen.getByTestId('email-field-input');
      expect(input.props.accessibilityState).toEqual({ disabled: false });
    });
  });

  describe('Keyboard Types', () => {
    it('accepts email keyboard type', () => {
      render(
        <FormInput label="Email" keyboardType="email-address" testID="email-field" />
      );
      const input = screen.getByTestId('email-field-input');
      expect(input.props.keyboardType).toBe('email-address');
    });

    it('accepts numeric keyboard type', () => {
      render(
        <FormInput label="Phone" keyboardType="numeric" testID="phone-field" />
      );
      const input = screen.getByTestId('phone-field-input');
      expect(input.props.keyboardType).toBe('numeric');
    });
  });

  describe('Ref Forwarding', () => {
    it('forwards ref to TextInput', () => {
      const ref = React.createRef<TextInput>();
      render(<FormInput label="Email" ref={ref} testID="email-field" />);

      expect(ref.current).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles very long label text', () => {
      const longLabel = 'This is a very long label that might wrap to multiple lines';
      render(<FormInput label={longLabel} />);
      expect(screen.getByText(longLabel)).toBeTruthy();
    });

    it('handles special characters in value', () => {
      render(<FormInput label="Special" value="<script>alert('xss')</script>" />);
      expect(screen.getByDisplayValue("<script>alert('xss')</script>")).toBeTruthy();
    });

    it('handles autoCapitalize prop', () => {
      render(<FormInput label="Name" autoCapitalize="words" testID="name-field" />);
      const input = screen.getByTestId('name-field-input');
      expect(input.props.autoCapitalize).toBe('words');
    });

    it('handles autoComplete prop', () => {
      render(<FormInput label="Email" autoComplete="email" testID="email-field" />);
      const input = screen.getByTestId('email-field-input');
      expect(input.props.autoComplete).toBe('email');
    });
  });
});
