import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  Platform,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

export type DatePickerMode = 'date' | 'time' | 'datetime';

export interface FormDatePickerProps {
  /** Field label */
  label: string;
  /** Selected date value */
  value: Date | null;
  /** Change handler */
  onChange: (date: Date | null) => void;
  /** Picker mode */
  mode?: DatePickerMode;
  /** Placeholder text */
  placeholder?: string;
  /** Minimum selectable date */
  minimumDate?: Date;
  /** Maximum selectable date */
  maximumDate?: Date;
  /** Error message */
  error?: string | null;
  /** Helper text */
  helperText?: string;
  /** Whether picker is disabled */
  disabled?: boolean;
  /** Custom container style */
  containerStyle?: ViewStyle;
  /** Custom button style */
  buttonStyle?: ViewStyle;
  /** Custom label style */
  labelStyle?: TextStyle;
  /** Date format options */
  formatOptions?: Intl.DateTimeFormatOptions;
  /** Test ID */
  testID?: string;
}

const COLORS = {
  background: 'rgba(255,255,255,0.1)',
  border: 'rgba(255,255,255,0.1)',
  borderError: '#ef4444',
  text: '#fff',
  label: '#e2e8f0',
  placeholder: '#64748b',
  error: '#ef4444',
  helper: '#94a3b8',
  modalBackground: '#0f172a',
  modalOverlay: 'rgba(0,0,0,0.7)',
  primary: '#38bdf8',
  itemBorder: 'rgba(255,255,255,0.1)',
  disabled: '#475569',
};

const DEFAULT_FORMAT_OPTIONS: Record<DatePickerMode, Intl.DateTimeFormatOptions> = {
  date: { year: 'numeric', month: 'short', day: 'numeric' },
  time: { hour: '2-digit', minute: '2-digit' },
  datetime: {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
};

function formatDate(
  date: Date | null,
  mode: DatePickerMode,
  formatOptions?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '';
  const options = formatOptions || DEFAULT_FORMAT_OPTIONS[mode];
  return date.toLocaleString('en-US', options);
}

export function FormDatePicker({
  label,
  value,
  onChange,
  mode = 'date',
  placeholder = 'Select date',
  minimumDate,
  maximumDate,
  error,
  helperText,
  disabled = false,
  containerStyle,
  buttonStyle,
  labelStyle,
  formatOptions,
  testID,
}: FormDatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);

  const hasError = Boolean(error);

  const openPicker = () => {
    if (!disabled) {
      setTempDate(value || new Date());
      setShowPicker(true);
    }
  };

  const closePicker = () => {
    setShowPicker(false);
    setTempDate(null);
  };

  const handleConfirm = () => {
    if (tempDate) {
      onChange(tempDate);
    }
    closePicker();
  };

  const handleClear = () => {
    onChange(null);
    closePicker();
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selectedDate) {
        onChange(selectedDate);
      }
    } else {
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const getBorderColor = (): string => {
    if (hasError) return COLORS.borderError;
    return COLORS.border;
  };

  const buttonStyles: ViewStyle[] = [
    styles.button,
    { borderColor: getBorderColor() },
    disabled && styles.buttonDisabled,
    buttonStyle,
  ].filter(Boolean) as ViewStyle[];

  const displayText = value
    ? formatDate(value, mode, formatOptions)
    : placeholder;

  const renderIOSPicker = () => {
    if (Platform.OS !== 'ios') return null;

    return (
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
        testID={testID ? `${testID}-modal` : undefined}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Pressable
                onPress={closePicker}
                hitSlop={8}
                testID={testID ? `${testID}-cancel` : undefined}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.headerButtonText}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>{label}</Text>
              <Pressable
                onPress={handleConfirm}
                hitSlop={8}
                testID={testID ? `${testID}-confirm` : undefined}
                accessibilityRole="button"
                accessibilityLabel="Confirm"
              >
                <Text style={[styles.headerButtonText, styles.confirmButton]}>
                  Done
                </Text>
              </Pressable>
            </View>

            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={tempDate || new Date()}
                mode={mode}
                display="spinner"
                onChange={handleDateChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                textColor={COLORS.text}
                testID={testID ? `${testID}-picker` : undefined}
              />
            </View>

            {value && (
              <Pressable
                style={styles.clearButton}
                onPress={handleClear}
                testID={testID ? `${testID}-clear` : undefined}
                accessibilityRole="button"
                accessibilityLabel="Clear date"
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  const renderAndroidPicker = () => {
    if (Platform.OS !== 'android' || !showPicker) return null;

    return (
      <DateTimePicker
        value={tempDate || new Date()}
        mode={mode}
        onChange={handleDateChange}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        testID={testID ? `${testID}-picker` : undefined}
      />
    );
  };

  return (
    <View style={[styles.container, containerStyle]} testID={testID}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      <Pressable
        style={buttonStyles}
        onPress={openPicker}
        disabled={disabled}
        testID={testID ? `${testID}-button` : undefined}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayText}`}
        accessibilityState={{ disabled }}
        accessibilityHint="Opens date picker"
      >
        <Text
          style={[
            styles.buttonText,
            !value && styles.placeholderText,
            disabled && styles.textDisabled,
          ]}
        >
          {displayText}
        </Text>
        <Text style={[styles.icon, disabled && styles.textDisabled]}>{'\u{1F4C5}'}</Text>
      </Pressable>

      {hasError && (
        <Text style={styles.error} testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Text>
      )}
      {helperText && !hasError && (
        <Text style={styles.helper} testID={testID ? `${testID}-helper` : undefined}>
          {helperText}
        </Text>
      )}

      {renderIOSPicker()}
      {renderAndroidPicker()}
    </View>
  );
}

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
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  placeholderText: {
    color: COLORS.placeholder,
  },
  textDisabled: {
    color: COLORS.disabled,
  },
  icon: {
    fontSize: 18,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.modalOverlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.modalBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.itemBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerButtonText: {
    fontSize: 16,
    color: COLORS.placeholder,
  },
  confirmButton: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  pickerContainer: {
    padding: 16,
  },
  clearButton: {
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.itemBorder,
  },
  clearButtonText: {
    fontSize: 16,
    color: COLORS.error,
  },
});
