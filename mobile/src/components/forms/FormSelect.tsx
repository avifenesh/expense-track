import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';

export interface FormSelectOption<T = string> {
  /** Unique option value */
  value: T;
  /** Display label */
  label: string;
  /** Whether option is disabled */
  disabled?: boolean;
}

export interface FormSelectProps<T = string> {
  /** Select label */
  label: string;
  /** Available options */
  options: FormSelectOption<T>[];
  /** Currently selected value */
  value: T | null;
  /** Change handler */
  onChange: (value: T) => void;
  /** Placeholder text when no value selected */
  placeholder?: string;
  /** Error message */
  error?: string | null;
  /** Helper text */
  helperText?: string;
  /** Whether select is disabled */
  disabled?: boolean;
  /** Custom container style */
  containerStyle?: ViewStyle;
  /** Custom select button style */
  selectStyle?: ViewStyle;
  /** Custom label style */
  labelStyle?: TextStyle;
  /** Modal title */
  modalTitle?: string;
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
  selectedBackground: 'rgba(56,189,248,0.1)',
};

export function FormSelect<T = string>({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  error,
  helperText,
  disabled = false,
  containerStyle,
  selectStyle,
  labelStyle,
  modalTitle,
  testID,
}: FormSelectProps<T>) {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const hasError = Boolean(error);
  const selectedOption = options.find((opt) => opt.value === value);

  const openModal = () => {
    if (!disabled) {
      setIsModalVisible(true);
    }
  };

  const closeModal = () => {
    setIsModalVisible(false);
  };

  const handleSelect = (option: FormSelectOption<T>) => {
    if (!option.disabled) {
      onChange(option.value);
      closeModal();
    }
  };

  const getBorderColor = (): string => {
    if (hasError) return COLORS.borderError;
    return COLORS.border;
  };

  const selectButtonStyles: ViewStyle[] = [
    styles.selectButton,
    { borderColor: getBorderColor() },
    disabled && styles.selectButtonDisabled,
    selectStyle,
  ].filter(Boolean) as ViewStyle[];

  const renderOption = ({ item }: { item: FormSelectOption<T> }) => {
    const isSelected = item.value === value;
    const isOptionDisabled = item.disabled;

    return (
      <Pressable
        style={[
          styles.optionItem,
          isSelected && styles.optionItemSelected,
          isOptionDisabled && styles.optionItemDisabled,
        ]}
        onPress={() => handleSelect(item)}
        disabled={isOptionDisabled}
        testID={testID ? `${testID}-option-${item.value}` : undefined}
        accessibilityRole="menuitem"
        accessibilityState={{ selected: isSelected, disabled: isOptionDisabled }}
      >
        <Text
          style={[
            styles.optionText,
            isSelected && styles.optionTextSelected,
            isOptionDisabled && styles.optionTextDisabled,
          ]}
        >
          {item.label}
        </Text>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, containerStyle]} testID={testID}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      <Pressable
        style={selectButtonStyles}
        onPress={openModal}
        disabled={disabled}
        testID={testID ? `${testID}-button` : undefined}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedOption?.label || placeholder}`}
        accessibilityState={{ disabled }}
        accessibilityHint="Opens selection menu"
      >
        <Text
          style={[
            styles.selectText,
            !selectedOption && styles.placeholderText,
            disabled && styles.textDisabled,
          ]}
          numberOfLines={1}
        >
          {selectedOption?.label || placeholder}
        </Text>
        <Text style={[styles.chevron, disabled && styles.textDisabled]}>▼</Text>
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

      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
        testID={testID ? `${testID}-modal` : undefined}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle || label}</Text>
              <Pressable
                onPress={closeModal}
                hitSlop={8}
                testID={testID ? `${testID}-close` : undefined}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>

            <FlatList
              data={options}
              renderItem={renderOption}
              keyExtractor={(item) => String(item.value)}
              style={styles.optionList}
              showsVerticalScrollIndicator={false}
              testID={testID ? `${testID}-options-list` : undefined}
            />
          </View>
        </View>
      </Modal>
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
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    minHeight: 52,
  },
  selectButtonDisabled: {
    opacity: 0.5,
  },
  selectText: {
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
  chevron: {
    fontSize: 12,
    color: COLORS.placeholder,
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
    maxHeight: '70%',
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
  closeButton: {
    fontSize: 18,
    color: COLORS.placeholder,
    padding: 4,
  },
  optionList: {
    padding: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  optionItemSelected: {
    backgroundColor: COLORS.selectedBackground,
  },
  optionItemDisabled: {
    opacity: 0.5,
  },
  optionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  optionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  optionTextDisabled: {
    color: COLORS.disabled,
  },
  checkmark: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
