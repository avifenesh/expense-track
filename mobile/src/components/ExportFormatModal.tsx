import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type ExportFormat = 'json' | 'csv';

interface ExportFormatModalProps {
  visible: boolean;
  isExporting: boolean;
  onClose: () => void;
  onSelectFormat: (format: ExportFormat) => void;
}

export function ExportFormatModal({
  visible,
  isExporting,
  onClose,
  onSelectFormat,
}: ExportFormatModalProps) {
  const handleClose = useCallback(() => {
    if (!isExporting) {
      onClose();
    }
  }, [isExporting, onClose]);

  const handleSelectJson = useCallback(() => {
    if (!isExporting) {
      onSelectFormat('json');
    }
  }, [isExporting, onSelectFormat]);

  const handleSelectCsv = useCallback(() => {
    if (!isExporting) {
      onSelectFormat('csv');
    }
  }, [isExporting, onSelectFormat]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      testID="export-format-modal"
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.title}>Export Data</Text>
          <Pressable
            style={styles.cancelButton}
            onPress={handleClose}
            disabled={isExporting}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            testID="export-format-modal.cancel"
          >
            <Text style={[styles.cancelButtonText, isExporting && styles.disabledText]}>
              Cancel
            </Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          {/* Description */}
          <Text style={styles.description}>
            Choose a format to export your data. You can share the exported file or save it to your device.
          </Text>

          {/* Loading overlay */}
          {isExporting && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#38bdf8" testID="export-format-modal.loading" />
              <Text style={styles.loadingText}>Exporting your data...</Text>
            </View>
          )}

          {/* Format options */}
          {!isExporting && (
            <View style={styles.optionsContainer}>
              <Pressable
                style={styles.optionButton}
                onPress={handleSelectJson}
                accessibilityRole="button"
                accessibilityLabel="Export as JSON"
                testID="export-format-modal.json"
              >
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>JSON</Text>
                  <Text style={styles.optionDescription}>
                    Structured data format. Best for importing into other apps or backup.
                  </Text>
                </View>
                <Text style={styles.optionArrow}>›</Text>
              </Pressable>

              <Pressable
                style={styles.optionButton}
                onPress={handleSelectCsv}
                accessibilityRole="button"
                accessibilityLabel="Export as CSV"
                testID="export-format-modal.csv"
              >
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>CSV</Text>
                  <Text style={styles.optionDescription}>
                    Spreadsheet format. Best for viewing in Excel, Google Sheets, etc.
                  </Text>
                </View>
                <Text style={styles.optionArrow}>›</Text>
              </Pressable>
            </View>
          )}

          {/* Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Your export will include all your transactions, budgets, categories, accounts, and holdings.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerSpacer: {
    width: 60,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingLeft: 16,
  },
  cancelButtonText: {
    color: '#38bdf8',
    fontSize: 16,
  },
  disabledText: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  description: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 24,
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  optionContent: {
    flex: 1,
    marginRight: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  optionArrow: {
    fontSize: 20,
    color: '#64748b',
  },
  infoContainer: {
    marginTop: 24,
    padding: 12,
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#38bdf8',
    textAlign: 'center',
    lineHeight: 18,
  },
});
