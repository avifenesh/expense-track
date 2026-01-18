import React, { forwardRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';

export type CurrencyCode = 'USD' | 'EUR' | 'ILS';

export interface FormCurrencyInputProps extends Omit<TextInputProps, 'style' | 'value' | 'onChangeText' | 'keyboardType'> {
  /** Input label */
  label: string;
  /** Currency code */
  currency: CurrencyCode;
  /** Value in cents/minor units */
  value: number | null;
  /** Change handler - receives value in cents/minor units */
  onChangeValue: (value: number | null) => void;
  /** Error message */
  error?: string | null;
  /** Helper text */
  helperText?: string;
  /** Custom container style */
  containerStyle?: ViewStyle;
  /** Custom input style */
  inputStyle?: TextStyle;
  /** Custom label style */
  labelStyle?: TextStyle;
  /** Whether to allow negative values */
  allowNegative?: boolean;
  /** Maximum value in cents */
  maxValue?: number;
  /** Minimum value in cents */
  minValue?: number;
}

const CURRENCY_CONFIG: Record<CurrencyCode, { symbol: string; decimalPlaces: number }> = {
  USD: { symbol: '$', decimalPlaces: 2 },
  EUR: { symbol: '€', decimalPlaces: 2 },
  ILS: { symbol: '₪', decimalPlaces: 2 },
};

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
  symbol: '#94a3b8',
};

/**
 * Formats a value in cents to display string (e.g., 1234 -> "12.34")
 */
function formatCentsToDisplay(cents: number | null, decimalPlaces: number): string {
  if (cents === null) return '';
  const divisor = Math.pow(10, decimalPlaces);
  const value = cents / divisor;
  return value.toFixed(decimalPlaces);
}

/**
 * Parses display string to cents (e.g., "12.34" -> 1234)
 */
function parseDisplayToCents(display: string, decimalPlaces: number): number | null {
  if (!display || display === '' || display === '-') return null;

  // Remove any non-numeric characters except minus and decimal
  const cleaned = display.replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-') return null;

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;

  const multiplier = Math.pow(10, decimalPlaces);
  return Math.round(parsed * multiplier);
}

/**
 * Sanitizes input to only allow valid currency input characters
 */
function sanitizeInput(text: string, allowNegative: boolean): string {
  // Allow digits, one decimal point, and optionally one leading minus
  let result = text.replace(/[^\d.-]/g, '');

  // Handle negative sign
  if (!allowNegative) {
    result = result.replace(/-/g, '');
  } else {
    // Only allow minus at the start
    const hasLeadingMinus = result.startsWith('-');
    result = result.replace(/-/g, '');
    if (hasLeadingMinus) {
      result = '-' + result;
    }
  }

  // Only allow one decimal point
  const decimalIndex = result.indexOf('.');
  if (decimalIndex !== -1) {
    const beforeDecimal = result.slice(0, decimalIndex + 1);
    const afterDecimal = result.slice(decimalIndex + 1).replace(/\./g, '');
    result = beforeDecimal + afterDecimal;
  }

  return result;
}

export const FormCurrencyInput = forwardRef<TextInput, FormCurrencyInputProps>(
  (
    {
      label,
      currency,
      value,
      onChangeValue,
      error,
      helperText,
      containerStyle,
      inputStyle,
      labelStyle,
      allowNegative = false,
      maxValue,
      minValue,
      editable = true,
      testID,
      placeholder,
      ...textInputProps
    },
    ref
  ) => {
    const config = CURRENCY_CONFIG[currency];
    const [displayValue, setDisplayValue] = useState<string>(() =>
      formatCentsToDisplay(value, config.decimalPlaces)
    );
    const [isFocused, setIsFocused] = useState(false);

    const hasError = Boolean(error);

    // Sync display value with external value changes
    useEffect(() => {
      if (!isFocused) {
        setDisplayValue(formatCentsToDisplay(value, config.decimalPlaces));
      }
    }, [value, config.decimalPlaces, isFocused]);

    const getBorderColor = (): string => {
      if (hasError) return COLORS.borderError;
      if (isFocused) return COLORS.borderFocused;
      return COLORS.border;
    };

    const handleChangeText = useCallback(
      (text: string) => {
        const sanitized = sanitizeInput(text, allowNegative);

        // Limit decimal places
        const decimalIndex = sanitized.indexOf('.');
        if (decimalIndex !== -1) {
          const afterDecimal = sanitized.slice(decimalIndex + 1);
          if (afterDecimal.length > config.decimalPlaces) {
            return; // Don't allow more decimal places
          }
        }

        const cents = parseDisplayToCents(sanitized, config.decimalPlaces);

        // Apply min/max constraints - reject input that violates them
        if (cents !== null) {
          if (maxValue !== undefined && cents > maxValue) {
            return; // Don't update display or value when exceeding max
          }
          if (minValue !== undefined && cents < minValue) {
            return; // Don't update display or value when below min
          }
        }

        // Only update display after all validations pass
        setDisplayValue(sanitized);
        onChangeValue(cents);
      },
      [allowNegative, config.decimalPlaces, maxValue, minValue, onChangeValue]
    );

    const handleFocus = (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
      setIsFocused(true);
      textInputProps.onFocus?.(e);
    };

    const handleBlur = (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
      setIsFocused(false);
      // Format the display value on blur
      if (value !== null) {
        setDisplayValue(formatCentsToDisplay(value, config.decimalPlaces));
      }
      textInputProps.onBlur?.(e);
    };

    const inputContainerStyles: ViewStyle[] = [
      styles.inputContainer,
      { borderColor: getBorderColor() },
      !editable && styles.inputContainerDisabled,
    ].filter(Boolean) as ViewStyle[];

    return (
      <View style={[styles.container, containerStyle]} testID={testID}>
        <Text style={[styles.label, labelStyle]}>{label}</Text>
        <View style={inputContainerStyles}>
          <Text
            style={styles.currencySymbol}
            testID={testID ? `${testID}-symbol` : 'currency-symbol'}
          >
            {config.symbol}
          </Text>
          <TextInput
            ref={ref}
            style={[styles.input, inputStyle]}
            value={displayValue}
            onChangeText={handleChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder || '0.00'}
            placeholderTextColor={COLORS.placeholder}
            keyboardType="decimal-pad"
            editable={editable}
            testID={testID ? `${testID}-input` : undefined}
            accessibilityLabel={`${label} in ${currency}`}
            accessibilityState={{ disabled: !editable }}
            accessibilityHint={`Enter amount in ${currency}`}
            {...textInputProps}
          />
          <Text
            style={styles.currencyCode}
            testID={testID ? `${testID}-code` : 'currency-code'}
          >
            {currency}
          </Text>
        </View>
        {hasError && (
          <Text
            style={styles.error}
            testID={testID ? `${testID}-error` : 'currency-error'}
          >
            {error}
          </Text>
        )}
        {helperText && !hasError && (
          <Text
            style={styles.helper}
            testID={testID ? `${testID}-helper` : 'currency-helper'}
          >
            {helperText}
          </Text>
        )}
      </View>
    );
  }
);

FormCurrencyInput.displayName = 'FormCurrencyInput';

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
    paddingHorizontal: 16,
  },
  inputContainerDisabled: {
    opacity: 0.5,
  },
  currencySymbol: {
    fontSize: 18,
    color: COLORS.symbol,
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 18,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  currencyCode: {
    fontSize: 14,
    color: COLORS.symbol,
    marginLeft: 8,
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
});
