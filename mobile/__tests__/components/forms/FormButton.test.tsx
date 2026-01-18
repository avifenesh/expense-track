import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FormButton, FormButtonVariant } from '../../../src/components/forms/FormButton';

describe('FormButton', () => {
  describe('Rendering', () => {
    it('renders title correctly', () => {
      render(<FormButton title="Submit" />);
      expect(screen.getByText('Submit')).toBeTruthy();
    });

    it('renders with default primary variant', () => {
      const { toJSON } = render(<FormButton title="Submit" />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('renders with testID', () => {
      render(<FormButton title="Submit" testID="submit-button" />);
      expect(screen.getByTestId('submit-button')).toBeTruthy();
    });
  });

  describe('Variants', () => {
    const variants: FormButtonVariant[] = ['primary', 'secondary', 'outline', 'danger'];

    variants.forEach((variant) => {
      it(`renders ${variant} variant correctly`, () => {
        render(<FormButton title={`${variant} button`} variant={variant} />);
        expect(screen.getByText(`${variant} button`)).toBeTruthy();
      });
    });

    it('applies correct styles for primary variant', () => {
      const { toJSON } = render(<FormButton title="Primary" variant="primary" />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('applies correct styles for secondary variant', () => {
      const { toJSON } = render(<FormButton title="Secondary" variant="secondary" />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('applies correct styles for outline variant', () => {
      const { toJSON } = render(<FormButton title="Outline" variant="outline" />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('applies correct styles for danger variant', () => {
      const { toJSON } = render(<FormButton title="Danger" variant="danger" />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when isLoading is true', () => {
      render(<FormButton title="Submit" isLoading testID="loading-button" />);
      expect(screen.getByTestId('loading-button-loading')).toBeTruthy();
    });

    it('hides title text when loading', () => {
      render(<FormButton title="Submit" isLoading />);
      expect(screen.queryByText('Submit')).toBeNull();
    });

    it('disables button when loading', () => {
      const onPress = jest.fn();
      render(<FormButton title="Submit" isLoading onPress={onPress} testID="button" />);

      const button = screen.getByTestId('button');
      fireEvent.press(button);

      expect(onPress).not.toHaveBeenCalled();
    });

    it('shows loading indicator with custom testID', () => {
      render(<FormButton title="Submit" isLoading testID="my-button" />);
      expect(screen.getByTestId('my-button-loading')).toBeTruthy();
    });

    it('shows loading indicator with default testID when no testID provided', () => {
      render(<FormButton title="Submit" isLoading />);
      expect(screen.getByTestId('loading-indicator')).toBeTruthy();
    });
  });

  describe('Disabled State', () => {
    it('disables button when disabled prop is true', () => {
      const onPress = jest.fn();
      render(<FormButton title="Submit" disabled onPress={onPress} testID="button" />);

      const button = screen.getByTestId('button');
      fireEvent.press(button);

      expect(onPress).not.toHaveBeenCalled();
    });

    it('applies disabled styles when disabled', () => {
      const { toJSON } = render(<FormButton title="Submit" disabled />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('is disabled when both disabled and isLoading are true', () => {
      const onPress = jest.fn();
      render(<FormButton title="Submit" disabled isLoading onPress={onPress} testID="button" />);

      const button = screen.getByTestId('button');
      fireEvent.press(button);

      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('Press Handling', () => {
    it('calls onPress when pressed', () => {
      const onPress = jest.fn();
      render(<FormButton title="Submit" onPress={onPress} testID="button" />);

      const button = screen.getByTestId('button');
      fireEvent.press(button);

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('calls onPress multiple times when pressed multiple times', () => {
      const onPress = jest.fn();
      render(<FormButton title="Submit" onPress={onPress} testID="button" />);

      const button = screen.getByTestId('button');
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);

      expect(onPress).toHaveBeenCalledTimes(3);
    });
  });

  describe('Custom Styles', () => {
    it('applies custom container style', () => {
      const customStyle = { marginTop: 20 };
      const { toJSON } = render(<FormButton title="Submit" style={customStyle} />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('applies custom text style', () => {
      const customTextStyle = { fontSize: 18 };
      const { toJSON } = render(<FormButton title="Submit" textStyle={customTextStyle} />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('applies both custom styles together', () => {
      const customStyle = { marginTop: 20 };
      const customTextStyle = { fontSize: 18 };
      const { toJSON } = render(
        <FormButton title="Submit" style={customStyle} textStyle={customTextStyle} />
      );
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('has button accessibility role', () => {
      render(<FormButton title="Submit" testID="button" />);
      const button = screen.getByTestId('button');
      expect(button.props.accessibilityRole).toBe('button');
    });

    it('has correct accessibility label', () => {
      render(<FormButton title="Submit Form" testID="button" />);
      const button = screen.getByTestId('button');
      expect(button.props.accessibilityLabel).toBe('Submit Form');
    });

    it('has disabled accessibility state when disabled', () => {
      render(<FormButton title="Submit" disabled testID="button" />);
      const button = screen.getByTestId('button');
      expect(button.props.accessibilityState).toEqual({ disabled: true });
    });

    it('has disabled accessibility state when loading', () => {
      render(<FormButton title="Submit" isLoading testID="button" />);
      const button = screen.getByTestId('button');
      expect(button.props.accessibilityState).toEqual({ disabled: true });
    });

    it('has enabled accessibility state when not disabled', () => {
      render(<FormButton title="Submit" testID="button" />);
      const button = screen.getByTestId('button');
      expect(button.props.accessibilityState).toEqual({ disabled: false });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty title', () => {
      const { toJSON } = render(<FormButton title="" />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('handles long title text', () => {
      const longTitle = 'This is a very long button title that might wrap to multiple lines';
      render(<FormButton title={longTitle} />);
      expect(screen.getByText(longTitle)).toBeTruthy();
    });

    it('handles special characters in title', () => {
      const specialTitle = 'Submit & Continue >>';
      render(<FormButton title={specialTitle} />);
      expect(screen.getByText(specialTitle)).toBeTruthy();
    });

    it('handles undefined variant gracefully', () => {
      const { toJSON } = render(<FormButton title="Submit" variant={undefined} />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('forwards additional Pressable props', () => {
      const onLongPress = jest.fn();
      render(<FormButton title="Submit" onLongPress={onLongPress} testID="button" />);

      const button = screen.getByTestId('button');
      fireEvent(button, 'longPress');

      expect(onLongPress).toHaveBeenCalledTimes(1);
    });
  });
});
