import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Simulated activity data: 0=rest, 1=done, 2=skipped, 3=planned
const WEEK_ACTIVITY = [1, 1, 0, 2, 1, 3, 3];

const MONTH_WEEKS = [
  [0, 0, 0, 1, 1, 0, 1],
  [1, 0, 1, 1, 0, 1, 1],
  [1, 2, 1, 0, 1, 1, 0],
  [1, 1, 0, 2, 1, 3, 3],
];

const ACTIVITY_COLOR: Record<number, string> = {
  0: Colors.surface,
  1: Colors.primary,
  2: Colors.border,
  3: Colors.surfaceAlt,
};

const LOGS = [
  { date: 'Mon, Feb 24', name: 'Push Day A', sets: 18, volume: '5,240 kg', pr: true },
  { date: 'Tue, Feb 25', name: 'Pull Day A', sets: 21, volume: '4,880 kg', pr: false },
  { date: 'Thu, Feb 27', name: 'Leg Day', sets: 24, volume: '7,110 kg', pr: true },
  { date: 'Sat, Mar 1', name: 'Push Day B', sets: 18, volume: '5,380 kg', pr: false },
];

export default function CalendarScreen() {
  const [selectedWeek] = useState(3); // 0-indexed, current week

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.pageTitle}>Calendar</Text>
        <Text style={styles.pageSubtitle}>March 2026</Text>

        {/* Month Heat Map */}
        <View style={styles.heatMapCard}>
          <Text style={styles.cardLabel}>MONTHLY OVERVIEW</Text>
          {/* Day headers */}
          <View style={styles.dayRow}>
            {DAYS.map((d, i) => (
              <Text key={`d-${i}`} style={styles.dayLabel}>
                {d}
              </Text>
            ))}
          </View>
          {/* Weeks */}
          {MONTH_WEEKS.map((week, wi) => (
            <View key={`w-${wi}`} style={styles.dayRow}>
              {week.map((activity, di) => (
                <View
                  key={`c-${di}`}
                  style={[
                    styles.dayCell,
                    { backgroundColor: ACTIVITY_COLOR[activity] },
                    wi === selectedWeek && styles.dayCellCurrentWeek,
                  ]}
                />
              ))}
            </View>
          ))}
          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendText}>Done</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.border }]} />
              <Text style={styles.legendText}>Skipped</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.surfaceAlt }]} />
              <Text style={styles.legendText}>Planned</Text>
            </View>
          </View>
        </View>

        {/* This week */}
        <Text style={styles.sectionTitle}>THIS WEEK</Text>
        <View style={styles.weekRow}>
          {DAYS.map((d, i) => (
            <View key={`wd-${i}`} style={styles.weekDay}>
              <Text style={styles.weekDayLabel}>{d}</Text>
              <View
                style={[
                  styles.weekDayDot,
                  { backgroundColor: ACTIVITY_COLOR[WEEK_ACTIVITY[i]] },
                  WEEK_ACTIVITY[i] === 1 && styles.weekDayDotActive,
                ]}
              />
            </View>
          ))}
        </View>

        {/* Recent Logs */}
        <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
        {LOGS.map((log, i) => (
          <View key={i} style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text style={styles.logDate}>{log.date}</Text>
              {log.pr && (
                <View style={styles.prBadge}>
                  <Text style={styles.prText}>🏆 PR</Text>
                </View>
              )}
            </View>
            <Text style={styles.logName}>{log.name}</Text>
            <View style={styles.logMeta}>
              <Text style={styles.logMetaText}>{log.sets} sets</Text>
              <Text style={styles.logMetaDot}>·</Text>
              <Text style={styles.logMetaText}>{log.volume}</Text>
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
  },
  pageSubtitle: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    marginTop: 2,
  },

  heatMapCard: {
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
    marginBottom: Spacing.sm,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    marginHorizontal: 2,
    borderRadius: Radii.sm,
  },
  dayCellCurrentWeek: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },

  legend: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: Typography.xs, color: Colors.textSecondary },

  sectionTitle: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wider,
    marginBottom: Spacing.sm,
  },

  weekRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  weekDay: { alignItems: 'center', gap: Spacing.xs },
  weekDayLabel: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.bold },
  weekDayDot: {
    width: 28,
    height: 28,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  weekDayDotActive: { borderColor: Colors.primary },

  logCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  logDate: { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: Typography.medium },
  prBadge: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.xs,
  },
  prText: { fontSize: Typography.xs, color: Colors.primary, fontWeight: Typography.bold },
  logName: { fontSize: Typography.md, color: Colors.text, fontWeight: Typography.semibold, marginBottom: 4 },
  logMeta: { flexDirection: 'row', gap: Spacing.xs },
  logMetaText: { fontSize: Typography.sm, color: Colors.textSecondary },
  logMetaDot: { color: Colors.textMuted },
});
