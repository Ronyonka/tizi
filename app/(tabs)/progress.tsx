import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';

const TIME_RANGES = ['1W', '1M', '3M', '6M', '1Y', 'All'];

const STATS = [
  { label: 'Total Volume', value: '142k', unit: 'kg', change: '+8.3%', up: true },
  { label: 'Total Workouts', value: '48', unit: 'sessions', change: '+12%', up: true },
  { label: 'Avg Duration', value: '58', unit: 'min', change: '-4 min', up: false },
  { label: 'Best Streak', value: '14', unit: 'days', change: '+2', up: true },
];

const PRS = [
  { exercise: 'Bench Press', weight: '102.5 kg', date: 'Feb 20' },
  { exercise: 'Deadlift', weight: '180 kg', date: 'Feb 18' },
  { exercise: 'Squat', weight: '150 kg', date: 'Jan 30' },
  { exercise: 'OHP', weight: '72.5 kg', date: 'Jan 15' },
];

const BODY_STATS = [
  { label: 'Body Weight', values: [82, 81.5, 81, 80.5, 80, 79.8, 79.5] },
];

// Simple bar chart data (relative values 0–100)
const VOLUME_BARS = [60, 80, 45, 90, 75, 50, 100];
const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ProgressScreen() {
  const [activeRange, setActiveRange] = useState('1M');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.pageTitle}>Progress</Text>

        {/* Time Range Picker */}
        <View style={styles.rangeRow}>
          {TIME_RANGES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.rangeBtn, activeRange === r && styles.rangeBtnActive]}
              onPress={() => setActiveRange(r)}
            >
              <Text style={[styles.rangeBtnText, activeRange === r && styles.rangeBtnTextActive]}>
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
              <View style={styles.statValueRow}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statUnit}>{s.unit}</Text>
              </View>
              <View style={styles.statChangeRow}>
                <Text style={[styles.statChange, { color: s.up ? Colors.success : Colors.secondary }]}>
                  {s.up ? '↑' : '↓'} {s.change}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Volume Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.cardLabel}>WEEKLY VOLUME</Text>
          <View style={styles.barChart}>
            {VOLUME_BARS.map((v, i) => (
              <View key={i} style={styles.barGroup}>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { height: `${v}%` }]} />
                </View>
                <Text style={styles.barLabel}>{WEEK_LABELS[i]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* PRs */}
        <Text style={styles.sectionTitle}>PERSONAL RECORDS</Text>
        {PRS.map((pr, i) => (
          <View key={i} style={styles.prCard}>
            <View>
              <Text style={styles.prExercise}>{pr.exercise}</Text>
              <Text style={styles.prDate}>{pr.date}</Text>
            </View>
            <View style={styles.prWeightContainer}>
              <Text style={styles.prWeight}>{pr.weight}</Text>
              <Text style={styles.prTrophy}>🏆</Text>
            </View>
          </View>
        ))}
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { padding: Spacing.md },

  pageTitle: {
    fontSize: Typography.xxl,
    color: Colors.text,
    fontWeight: Typography.black,
    letterSpacing: Typography.tight,
    marginBottom: Spacing.md,
  },

  rangeRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: 4,
    marginBottom: Spacing.md,
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    borderRadius: Radii.sm,
  },
  rangeBtnActive: { backgroundColor: Colors.primary },
  rangeBtnText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  rangeBtnTextActive: { color: Colors.background, fontWeight: Typography.bold },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  statLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wide,
    marginBottom: Spacing.xs,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 4 },
  statValue: { fontSize: Typography.xxl, color: Colors.text, fontWeight: Typography.black },
  statUnit: { fontSize: Typography.xs, color: Colors.textSecondary },
  statChangeRow: { flexDirection: 'row' },
  statChange: { fontSize: Typography.xs, fontWeight: Typography.semibold },

  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  cardLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wider,
    marginBottom: Spacing.md,
  },
  barChart: {
    flexDirection: 'row',
    height: 120,
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  barGroup: { flex: 1, alignItems: 'center', height: '100%' },
  barTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radii.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radii.sm,
  },
  barLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },

  sectionTitle: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wider,
    marginBottom: Spacing.sm,
  },
  prCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  prExercise: { fontSize: Typography.md, color: Colors.text, fontWeight: Typography.semibold },
  prDate: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  prWeightContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  prWeight: { fontSize: Typography.lg, color: Colors.primary, fontWeight: Typography.black },
  prTrophy: { fontSize: Typography.md },
});
