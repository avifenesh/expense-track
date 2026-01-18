import React, { forwardRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
  Pressable,
} from 'react-native';

export interface FormInputProps extends Omit<TextInputProps, 'style'> {
  /** Input label text */
  label: string;
  /** Error message to display */
  error?: string | null;
  /** Helper text shown below input */
  helperText?: string;
  /** Custom container style */
  containerStyle?: ViewStyle;
  /** Custom input style */
  inputStyle?: TextStyle;
  /** Custom label style */
  labelStyle?: TextStyle;
  /** Left icon or element */
  leftIcon?: React.ReactNode;
  /** Right icon or element */
  rightIcon?: React.ReactNode;
  /** Show password toggle for secure text entry */
  showPasswordToggle?: boolean;
}

const COLORS = {
  background: 'rgba(255,255,255,0.1)',
  border: 'rgba(255,255,255,0.1)',
  borderFocused: '#38bdf8',
  borderError: '#ef4444',
  text: '#fff',
  label: '#e2e8f0',
  placeholder: '#64748b',
  error: '#ef4444',
  helper: '#94a3b8',
};

export const FormInput = forwardRef<TextInput, FormInputProps>(
  (
    {
      label,
      error,
      helperText,
      containerStyle,
      inputStyle,
      labelStyle,
      leftIcon,
      rightIcon,
      showPasswordToggle = false,
      secureTextEntry,
      editable = true,
      testID,
      ...textInputProps
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const hasError = Boolean(error);
    const isSecure = secureTextEntry && !isPasswordVisible;

    const getBorderColor = (): string => {
      if (hasError) return COLORS.borderError;
      if (isFocused) return COLORS.borderFocused;
      return COLORS.border;
    };

    const handleFocus = (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
      setIsFocused(true);
      textInputProps.onFocus?.(e);
    };

    const handleBlur = (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
      setIsFocused(false);
      textInputProps.onBlur?.(e);
    };

    const togglePasswordVisibility = () => {
      setIsPasswordVisible(!isPasswordVisible);
    };

    const inputContainerStyles: ViewStyle[] = [
      styles.inputContainer,
      { borderColor: getBorderColor() },
      !editable && styles.inputContainerDisabled,
    ].filter(Boolean) as ViewStyle[];

    const renderPasswordToggle = () => {
      if (!showPasswordToggle || !secureTextEntry) return null;

      return (
        <Pressable
          onPress={togglePasswordVisibility}
          hitSlop={8}
          testID={testID ? `${testID}-toggle-password` : 'toggle-password'}
          accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
          accessibilityRole="button"
        >
          <Text style={styles.passwordToggle}>
            {isPasswordVisible ? 'Hide' : 'Show'}
          </Text>
        </Pressable>
      );
    };

    return (
      <View style={[styles.container, containerStyle]} testID={testID}>
        <Text style={[styles.label, labelStyle]}>{label}</Text>
        <View style={inputContainerStyles}>
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              leftIcon && styles.inputWithLeftIcon,
              (rightIcon || showPasswordToggle) && styles.inputWithRightIcon,
              inputStyle,
            ]}
            placeholderTextColor={COLORS.placeholder}
            secureTextEntry={isSecure}
            editable={editable}
            onFocus={handleFocus}
            onBlur={handleBlur}
            testID={testID ? `${testID}-input` : undefined}
            accessibilityLabel={label}
            accessibilityState={{ disabled: !editable }}
            {...textInputProps}
          />
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
          {renderPasswordToggle()}
        </View>
        {hasError && (
          <Text
            style={styles.error}
            testID={testID ? `${testID}-error` : 'input-error'}
          >
            {error}
          </Text>
        )}
        {helperText && !hasError && (
          <Text
            style={styles.helper}
            testID={testID ? `${testID}-helper` : 'input-helper'}
          >
            {helperText}
          </Text>
        )}
      </View>
    );
  }
);

FormInput.displayName = 'FormInput';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.label,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderRadius: 12,
  },
  inputContainerDisabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  inputWithLeftIcon: {
    paddingLeft: 8,
  },
  inputWithRightIcon: {
    paddingRight: 8,
  },
  leftIcon: {
    paddingLeft: 16,
  },
  rightIcon: {
    paddingRight: 16,
  },
  error: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
  },
  helper: {
    color: COLORS.helper,
    fontSize: 12,
    marginTop: 4,
  },
  passwordToggle: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
    paddingRight: 16,
  },
});
