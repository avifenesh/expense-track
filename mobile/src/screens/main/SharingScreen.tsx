import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MainTabScreenProps } from '../../navigation/types';

export function SharingScreen(_props: MainTabScreenProps<'Sharing'>) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Sharing</Text>
          <Pressable style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Share</Text>
          </Pressable>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Net Balance</Text>
          <Text style={[styles.balanceAmount, styles.positiveBalance]}>
            +$125.00
          </Text>
          <Text style={styles.balanceSubtext}>You are owed overall</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared With You</Text>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Shared expenses will be implemented in a future task
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>You Shared</Text>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Expenses you shared will appear here
            </Text>
          </View>
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
  balanceCard: {
    padding: 24,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 4,
  },
  positiveBalance: {
    color: '#22c55e',
  },
  balanceSubtext: {
    fontSize: 14,
    color: '#64748b',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  placeholder: {
    padding: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  placeholderText: {
    color: '#64748b',
    textAlign: 'center',
  },
});
