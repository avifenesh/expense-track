import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  PressableProps,
} from 'react-native';

export type FormButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

export interface FormButtonProps extends Omit<PressableProps, 'style'> {
  /** Button text */
  title: string;
  /** Button variant */
  variant?: FormButtonVariant;
  /** Loading state shows spinner */
  isLoading?: boolean;
  /** Custom container style */
  style?: ViewStyle;
  /** Custom text style */
  textStyle?: TextStyle;
}

const COLORS = {
  primary: '#38bdf8',
  primaryText: '#0f172a',
  secondary: 'rgba(255,255,255,0.1)',
  secondaryText: '#fff',
  outline: 'transparent',
  outlineText: '#38bdf8',
  outlineBorder: '#38bdf8',
  danger: '#ef4444',
  dangerText: '#fff',
  disabled: 0.7,
};

export function FormButton({
  title,
  variant = 'primary',
  isLoading = false,
  disabled,
  style,
  textStyle,
  testID,
  ...pressableProps
}: FormButtonProps) {
  const isDisabled = disabled || isLoading;

  const getBackgroundColor = (): string => {
    switch (variant) {
      case 'primary':
        return COLORS.primary;
      case 'secondary':
        return COLORS.secondary;
      case 'outline':
        return COLORS.outline;
      case 'danger':
        return COLORS.danger;
      default:
        return COLORS.primary;
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'primary':
        return COLORS.primaryText;
      case 'secondary':
        return COLORS.secondaryText;
      case 'outline':
        return COLORS.outlineText;
      case 'danger':
        return COLORS.dangerText;
      default:
        return COLORS.primaryText;
    }
  };

  const getBorderStyle = (): ViewStyle => {
    if (variant === 'outline') {
      return {
        borderWidth: 1,
        borderColor: COLORS.outlineBorder,
      };
    }
    return {};
  };

  const buttonStyles: ViewStyle[] = [
    styles.button,
    { backgroundColor: getBackgroundColor() },
    getBorderStyle(),
    isDisabled && styles.buttonDisabled,
    style,
  ].filter(Boolean) as ViewStyle[];

  const textStyles: TextStyle[] = [
    styles.buttonText,
    { color: getTextColor() },
    textStyle,
  ].filter(Boolean) as TextStyle[];

  return (
    <Pressable
      style={buttonStyles}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      accessibilityLabel={title}
      {...pressableProps}
    >
      {isLoading ? (
        <ActivityIndicator
          color={getTextColor()}
          testID={testID ? `${testID}-loading` : 'loading-indicator'}
        />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: COLORS.disabled,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
