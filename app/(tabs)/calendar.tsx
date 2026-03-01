import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { Log, Routine } from '@/services/googleSheets';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const ACTIVITY_COLOR: Record<number, string> = {
  0: Colors.surface,
  1: Colors.primary,
  2: Colors.border,
  3: Colors.surfaceAlt,
};

interface ProcessedLog {
  date: string;
  name: string;
  sets: number;
  volume: string;
  pr: boolean;
  rawDate: Date;
}

export default function CalendarScreen() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ProcessedLog[]>([]);
  const [heatmap, setHeatmap] = useState<number[][]>([]);
  const [thisWeekActivity, setThisWeekActivity] = useState<number[]>(Array(7).fill(0));

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const [logsRes, routinesRes] = await Promise.all([
        fetch('/api/logs'),
        fetch('/api/routines')
      ]);
      
      const rawLogs: Log[] = await logsRes.json();
      const routines: Routine[] = await routinesRes.json();

      // Process logs for list
      const processed: ProcessedLog[] = [];
      const sessionsByDate: Record<string, Log[]> = {};

      rawLogs.forEach(log => {
        const dateKey = log.date.split(' ')[0]; // DD/MM/YYYY or similar
        if (!sessionsByDate[dateKey]) sessionsByDate[dateKey] = [];
        sessionsByDate[dateKey].push(log);
      });

      Object.entries(sessionsByDate).forEach(([dateStr, sessionLogs]) => {
        const routineId = sessionLogs[0].routine_id;
        const routine = routines.find(r => r.id === routineId);
        const totalVolume = sessionLogs.reduce((acc, l) => acc + (l.weight_kg * (parseInt(l.reps) || 0)), 0);
        
        // Simple logic for PR (could be more complex)
        const hasPR = false; 

        // Try to parse the date safely
        const parts = dateStr.split('/');
        const dateObj = parts.length === 3 
          ? new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
          : new Date(dateStr);

        processed.push({
          date: dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          name: routine?.name || 'Workout',
          sets: sessionLogs.length,
          volume: `${totalVolume.toLocaleString()} kg`,
          pr: hasPR,
          rawDate: dateObj
        });
      });

      // Sort by date desc
      processed.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
      setLogs(processed);

      // Generate heatmap for the last 4 weeks
      const heatmapWeeks: number[][] = [];
      
      // Start of current week (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0 for Mon, 6 for Sun
      const mondayOfThisWeek = new Date(now);
      mondayOfThisWeek.setDate(now.getDate() - dayOfWeek);
      mondayOfThisWeek.setHours(0, 0, 0, 0);

      // Start 3 weeks before this week
      const startDate = new Date(mondayOfThisWeek);
      startDate.setDate(mondayOfThisWeek.getDate() - 21);

      for (let w = 0; w < 4; w++) {
        const week: number[] = [];
        for (let d = 0; d < 7; d++) {
          const currentDay = new Date(startDate);
          currentDay.setDate(startDate.getDate() + (w * 7) + d);
          const dayStr = currentDay.toLocaleDateString();
          
          const hasWorkout = Object.keys(sessionsByDate).some(k => {
            const parts = k.split('/');
            const kDate = parts.length === 3 
              ? new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
              : new Date(k);
            return kDate.toLocaleDateString() === dayStr;
          });
          
          week.push(hasWorkout ? 1 : 0);
        }
        heatmapWeeks.push(week);
      }
      setHeatmap(heatmapWeeks);
      setThisWeekActivity(heatmapWeeks[3]);

    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.pageTitle}>Calendar</Text>
        <Text style={styles.pageSubtitle}>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>

        {/* Month Heat Map */}
        <View style={styles.heatMapCard}>
          <Text style={styles.cardLabel}>ACTIVITY OVERVIEW (PAST 4 WEEKS)</Text>
          {/* Day headers */}
          <View style={styles.dayRow}>
            {DAYS.map((d, i) => (
              <Text key={`d-${i}`} style={styles.dayLabel}>
                {d}
              </Text>
            ))}
          </View>
          {/* Weeks */}
          {heatmap.map((week, wi) => (
            <View key={`w-${wi}`} style={styles.dayRow}>
              {week.map((activity, di) => (
                <View
                  key={`c-${di}`}
                  style={[
                    styles.dayCell,
                    { backgroundColor: ACTIVITY_COLOR[activity] },
                    wi === 3 && styles.dayCellCurrentWeek,
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
              <View style={[styles.legendDot, { backgroundColor: Colors.surface }]} />
              <Text style={styles.legendText}>Rest</Text>
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
                  { backgroundColor: ACTIVITY_COLOR[thisWeekActivity[i]] },
                  thisWeekActivity[i] === 1 && styles.weekDayDotActive,
                ]}
              />
            </View>
          ))}
        </View>

        {/* Recent Logs */}
        <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
        {logs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No workout logs found yet. Start training! 👊</Text>
          </View>
        ) : (
          logs.map((log, i) => (
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
          ))
        )}
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { padding: Spacing.md },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

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

  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
