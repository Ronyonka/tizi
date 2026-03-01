import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { Exercise, Log } from '@/services/googleSheets';

const TIME_RANGES = ['1W', '1M', '3M', '6M', '1Y', 'All'];

interface PR {
  exercise: string;
  weight: string;
  date: string;
}

interface Stat {
  label: string;
  value: string;
  unit: string;
  change?: string;
  up?: boolean;
}

export default function ProgressScreen() {
  const [activeRange, setActiveRange] = useState('1M');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stat[]>([]);
  const [prs, setPrs] = useState<PR[]>([]);
  const [volumeBars, setVolumeBars] = useState<number[]>([]);
  const [weekLabels, setWeekLabels] = useState<string[]>([]);

  useEffect(() => {
    calculateProgress();
  }, [activeRange]);

  const calculateProgress = async () => {
    try {
      setLoading(true);
      const [logsRes, exercisesRes] = await Promise.all([
        fetch('/api/logs'),
        fetch('/api/exercises'),
      ]);

      const rawLogs: Log[] = await logsRes.json();
      const allExercises: Exercise[] = await exercisesRes.json();

      // 1. Total Volume
      const totalVolume = rawLogs.reduce((acc, l) => acc + (l.weight_kg * (parseInt(l.reps) || 0)), 0);
      
      // 2. Total Workouts
      const uniqueDates = new Set(rawLogs.map(l => l.date.split(' ')[0]));
      const totalWorkouts = uniqueDates.size;

      // 3. PRs
      const prMap: Record<string, { weight: number, date: string }> = {};
      rawLogs.forEach(log => {
        if (!prMap[log.exercise_id] || log.weight_kg > prMap[log.exercise_id].weight) {
          prMap[log.exercise_id] = { weight: log.weight_kg, date: log.date.split(' ')[0] };
        }
      });

      const processedPrs: PR[] = Object.entries(prMap).map(([exId, data]) => {
        const ex = allExercises.find(e => e.id === exId);
        return {
          exercise: ex?.name || 'Unknown',
          weight: `${data.weight} kg`,
          date: data.date
        };
      }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

      setPrs(processedPrs);

      // 4. Streak (simplified)
      const sortedDates = Array.from(uniqueDates).sort().reverse();
      let streak = 0;
      if (sortedDates.length > 0) {
        // Just counting total for now as a placeholder for real streak logic
        streak = sortedDates.length; 
      }

      setStats([
        { label: 'Total Volume', value: totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : `${totalVolume}`, unit: 'kg' },
        { label: 'Total Workouts', value: `${totalWorkouts}`, unit: 'sessions' },
        { label: 'Exercises done', value: `${allExercises.length}`, unit: 'types' },
        { label: 'Training Days', value: `${streak}`, unit: 'days' },
      ]);

      // 5. Weekly Volume for Chart
      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const volumeData = Array(7).fill(0);
      
      const now = new Date();
      const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - dayOfWeek);
      monday.setHours(0,0,0,0);

      rawLogs.forEach(l => {
        const parts = l.date.split(' ')[0].split('/');
        const lDate = parts.length === 3 
          ? new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
          : new Date(l.date.split(' ')[0]);
        
        if (lDate >= monday) {
          const d = lDate.getDay() === 0 ? 6 : lDate.getDay() - 1;
          volumeData[d] += l.weight_kg * (parseInt(l.reps) || 0);
        }
      });

      const maxVolume = Math.max(...volumeData, 1);
      setVolumeBars(volumeData.map(v => (v / maxVolume) * 100));
      setWeekLabels(labels);

    } catch (error) {
      console.error('Error calculating progress:', error);
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
          {stats.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
              <View style={styles.statValueRow}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statUnit}>{s.unit}</Text>
              </View>
              {s.change && (
                <View style={styles.statChangeRow}>
                  <Text style={[styles.statChange, { color: s.up ? Colors.success : Colors.secondary }]}>
                    {s.up ? '↑' : '↓'} {s.change}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Volume Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.cardLabel}>WEEKLY VOLUME (THIS WEEK)</Text>
          <View style={styles.barChart}>
            {volumeBars.map((v, i) => (
              <View key={i} style={styles.barGroup}>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { height: `${v}%` }]} />
                </View>
                <Text style={styles.barLabel}>{weekLabels[i]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* PRs */}
        <Text style={styles.sectionTitle}>PERSONAL RECORDS</Text>
        {prs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No records yet. Keep pushing! 🏆</Text>
          </View>
        ) : (
          prs.map((pr, i) => (
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
