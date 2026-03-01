import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';

const GREETING = 'Good morning';
const USERNAME = 'Ron';

const QUICK_STATS = [
  { label: 'Streak', value: '12', unit: 'days' },
  { label: 'Volume', value: '4.2', unit: 'k kg' },
  { label: 'PRs', value: '3', unit: 'this week' },
];

const UPCOMING = [
  { day: 'Today', name: 'Push Day A', tags: ['Chest', 'Shoulders', 'Triceps'] },
  { day: 'Tomorrow', name: 'Rest / Active Recovery', tags: ['Mobility', 'Stretch'] },
  { day: 'Wed', name: 'Pull Day A', tags: ['Back', 'Biceps'] },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{GREETING},</Text>
            <Text style={styles.username}>{USERNAME} 👊</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>R</Text>
          </View>
        </View>

        {/* Today's Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerLabel}>TODAY'S WORKOUT</Text>
          <Text style={styles.bannerTitle}>Push Day A</Text>
          <Text style={styles.bannerSub}>Chest · Shoulders · Triceps</Text>
          <View style={styles.startBtn}>
            <Text style={styles.startBtnText}>Start Workout →</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          {QUICK_STATS.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statUnit}>{s.unit}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Upcoming */}
        <Text style={styles.sectionTitle}>UPCOMING</Text>
        {UPCOMING.map((item) => (
          <View key={item.day} style={styles.scheduleCard}>
            <Text style={styles.scheduleDay}>{item.day}</Text>
            <View style={styles.scheduleInfo}>
              <Text style={styles.scheduleName}>{item.name}</Text>
              <View style={styles.tagRow}>
                {item.tags.map((t) => (
                  <View key={t} style={styles.tag}>
                    <Text style={styles.tagText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  greeting: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  username: {
    fontSize: Typography.xxl,
    color: Colors.text,
    fontWeight: Typography.black,
    letterSpacing: Typography.tight,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.background,
  },

  banner: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  bannerLabel: {
    fontSize: Typography.xs,
    color: Colors.primary,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wider,
    marginBottom: Spacing.xs,
  },
  bannerTitle: {
    fontSize: Typography.xxl,
    color: Colors.text,
    fontWeight: Typography.black,
    letterSpacing: Typography.tight,
  },
  bannerSub: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  startBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignSelf: 'flex-start',
  },
  startBtnText: {
    color: Colors.background,
    fontWeight: Typography.bold,
    fontSize: Typography.md,
  },

  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.xxl,
    color: Colors.text,
    fontWeight: Typography.black,
  },
  statUnit: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.semibold,
    letterSpacing: Typography.wide,
    textTransform: 'uppercase',
  },

  sectionTitle: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wider,
    marginBottom: Spacing.sm,
  },
  scheduleCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  scheduleDay: {
    fontSize: Typography.xs,
    color: Colors.primary,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wide,
    width: 52,
    textTransform: 'uppercase',
    paddingTop: 2,
  },
  scheduleInfo: { flex: 1 },
  scheduleName: {
    fontSize: Typography.md,
    color: Colors.text,
    fontWeight: Typography.semibold,
    marginBottom: Spacing.xs,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  tag: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
});
