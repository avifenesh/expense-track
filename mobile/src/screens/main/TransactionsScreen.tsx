import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MainTabScreenProps } from '../../navigation/types';

export function TransactionsScreen(_props: MainTabScreenProps<'Transactions'>) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Transactions</Text>
          <Pressable style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          <Pressable style={[styles.filterChip, styles.filterChipActive]}>
            <Text style={[styles.filterText, styles.filterTextActive]}>All</Text>
          </Pressable>
          <Pressable style={styles.filterChip}>
            <Text style={styles.filterText}>Income</Text>
          </Pressable>
          <Pressable style={styles.filterChip}>
            <Text style={styles.filterText}>Expenses</Text>
          </Pressable>
        </View>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Transaction list will be implemented in task #75
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  addButton: {
    backgroundColor: '#38bdf8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  filterChipActive: {
    backgroundColor: '#38bdf8',
  },
  filterText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  filterTextActive: {
    color: '#0f172a',
    fontWeight: '600',
  },
  placeholder: {
    padding: 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  placeholderText: {
    color: '#64748b',
    textAlign: 'center',
  },
});
