import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { collection, COLLECTIONS, db, deleteLog, Exercise, Log, onSnapshot } from '@/services/firestore';

// ─── Types ─────────────────────────────────────────────────────────────────

type TimeRange = '30D' | '3M' | 'All';

interface ChartPoint {
  date: string;   // YYYY-MM-DD
  weight: number; // max weight logged that day for the exercise
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const TIME_RANGES: TimeRange[] = ['30D', '3M', 'All'];

/**
 * Normalise any log date string to YYYY-MM-DD.
 * Supports ISO-8601 (2026-03-01T…) and DD/MM/YYYY.
 */
function normaliseDateString(raw: string): string {
  if (!raw) return '';
  
  // If it's an ISO string (2026-03-01T22:13:03.000Z), take the first 10 chars
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    return raw.substring(0, 10);
  }

  const trimmed = raw.trim().split(' ')[0];

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m}-${d}`;
  }

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Fallback
  try {
    const dt = new Date(raw);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch {
    // ignore
  }
  return trimmed;
}

/**
 * Filter logs by time range (relative to today).
 */
function filterByRange(logs: Log[], range: TimeRange): Log[] {
  if (range === 'All') return logs;

  const now = new Date();
  const cutoff = new Date(now);
  if (range === '30D') cutoff.setDate(cutoff.getDate() - 30);
  else if (range === '3M') cutoff.setMonth(cutoff.getMonth() - 3);

  return logs.filter((log) => {
    const dateStr = normaliseDateString(log.date);
    if (!dateStr) return false;
    const logDate = new Date(dateStr);
    return logDate >= cutoff;
  });
}

/**
 * Aggregate logs into chart points:
 * one point per date, taking the max weight lifted on that day.
 */
function buildChartPoints(logs: Log[]): ChartPoint[] {
  const map: Record<string, number> = {};
  logs.forEach((log) => {
    const date = normaliseDateString(log.date);
    if (!date) return;
    const w = log.weight_kg ?? 0;
    if (!map[date] || w > map[date]) {
      map[date] = w;
    }
  });

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, weight]) => ({ date, weight }));
}

/**
 * Format a YYYY-MM-DD string to a short readable label like "Mar 1".
 */
function formatDateShort(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ─── Custom Line Chart ─────────────────────────────────────────────────────

const CHART_HEIGHT = 160;
const CHART_PADDING = { top: 16, bottom: 32, left: 40, right: 12 };

interface LineChartProps {
  points: ChartPoint[];
}

function LineChart({ points }: LineChartProps) {
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width - Spacing.md * 2 - Spacing.md * 2
  );

  const plotWidth  = containerWidth - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  // Compute min/max weight
  const weights = points.map((p) => p.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  // Map each point to pixel coordinates (relative to the plot area)
  const coords = points.map((p, i) => ({
    x: points.length === 1
      ? plotWidth / 2
      : (i / (points.length - 1)) * plotWidth,
    y: plotHeight - ((p.weight - minW) / range) * plotHeight,
  }));

  // Decide how many X-axis labels to show (avoid crowding)
  const maxLabels = Math.min(points.length, 5);
  const labelIndices: number[] = [];
  if (points.length > 0) {
    if (points.length <= maxLabels) {
      labelIndices.push(...points.map((_, i) => i));
    } else {
      for (let i = 0; i < maxLabels; i++) {
        labelIndices.push(Math.round((i / (maxLabels - 1)) * (points.length - 1)));
      }
    }
  }

  // Y-axis tick values
  const yTicks = [minW, minW + range / 2, maxW];

  return (
    <View
      style={[styles.chartContainer, { height: CHART_HEIGHT }]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Y-axis labels */}
      <View
        style={[
          styles.yAxis,
          {
            position: 'absolute',
            left: 0,
            top: CHART_PADDING.top,
            width: CHART_PADDING.left - 4,
            height: plotHeight,
          },
        ]}
      >
        {yTicks.map((tick, i) => (
          <Text
            key={i}
            style={[
              styles.axisLabel,
              {
                position: 'absolute',
                // top 0 = maxW, bottom = minW → reverse order
                top: i === 0
                  ? plotHeight - 10
                  : i === 1
                  ? plotHeight / 2 - 5
                  : -4,
                right: 4,
              },
            ]}
          >
            {tick % 1 === 0 ? tick : tick.toFixed(1)}
          </Text>
        ))}
      </View>

      {/* Plot area */}
      <View
        style={{
          position: 'absolute',
          left: CHART_PADDING.left,
          top: CHART_PADDING.top,
          width: plotWidth,
          height: plotHeight,
        }}
      >
        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((ratio) => (
          <View
            key={ratio}
            style={[
              styles.gridLine,
              { top: (1 - ratio) * plotHeight },
            ]}
          />
        ))}

        {/* Line segments between points */}
        {coords.map((c, i) => {
          if (i === 0) return null;
          const prev = coords[i - 1];
          const dx = c.x - prev.x;
          const dy = c.y - prev.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View
              key={`seg-${i}`}
              style={{
                position: 'absolute',
                left: prev.x,
                top: prev.y - 1,
                width: length,
                height: 2,
                backgroundColor: Colors.primary,
                borderRadius: 1,
                transformOrigin: '0 50%',
                transform: [{ rotate: `${angle}deg` }],
              }}
            />
          );
        })}

        {/* Data point dots */}
        {coords.map((c, i) => (
          <View
            key={`dot-${i}`}
            style={[
              styles.chartDot,
              { left: c.x - 4, top: c.y - 4 },
            ]}
          />
        ))}
      </View>

      {/* X-axis date labels */}
      {labelIndices.map((idx) => (
        <Text
          key={`xl-${idx}`}
          style={[
            styles.axisLabel,
            {
              position: 'absolute',
              left: CHART_PADDING.left + coords[idx]?.x - 20,
              top: CHART_PADDING.top + plotHeight + 6,
              width: 40,
              textAlign: 'center',
            },
          ]}
        >
          {formatDateShort(points[idx].date)}
        </Text>
      ))}
    </View>
  );
}

// ─── Exercise List Item ────────────────────────────────────────────────────

function ExerciseRow({
  exercise,
  logCount,
  onPress,
}: {
  exercise: Exercise;
  logCount: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.exerciseRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.exerciseRowLeft}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <View style={styles.muscleChip}>
          <Text style={styles.muscleChipText}>{exercise.muscle_group}</Text>
        </View>
      </View>
      <View style={styles.exerciseRowRight}>
        {logCount > 0 && (
          <Text style={styles.logCountText}>{logCount} {logCount === 1 ? 'session' : 'sessions'}</Text>
        )}
        <Text style={styles.arrowIcon}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const [loading, setLoading]              = useState(true);
  const [exercises, setExercises]          = useState<Exercise[]>([]);
  const [allLogs, setAllLogs]              = useState<Log[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [activeRange, setActiveRange]      = useState<TimeRange>('3M');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  // ── Fetch all data on mount and listen to changes ──────────────────────────
  useEffect(() => {
    let allExercises: Exercise[] = [];
    let logs: Log[] = [];
    let exercisesLoaded = false;
    let logsLoaded = false;

    const checkLoading = () => {
      if (exercisesLoaded && logsLoaded) {
        setLoading(false);
      }
    };

    const unsubExercises = onSnapshot(collection(db, COLLECTIONS.exercises), (snap) => {
      allExercises = snap.docs.map(d => ({ ...(d.data() as Exercise), id: d.id }));
      setExercises(allExercises);
      exercisesLoaded = true;
      checkLoading();
    }, (err) => {
      console.error('[ProgressScreen] Exercises listener error:', err);
      exercisesLoaded = true;
      checkLoading();
    });

    const unsubLogs = onSnapshot(collection(db, COLLECTIONS.logs), (snap) => {
      logs = snap.docs.map(d => {
        const data = d.data();
        return {
          id: String(data.id ?? d.id),
          date: String(data.date),
          routine_id: String(data.routine_id),
          exercise_id: String(data.exercise_id),
          sets: String(data.sets),
          reps: String(data.reps),
          weight_kg: Number(data.weight_kg),
        };
      });
      setAllLogs(logs);
      logsLoaded = true;
      checkLoading();
    }, (err) => {
      console.error('[ProgressScreen] Logs listener error:', err);
      logsLoaded = true;
      checkLoading();
    });

    return () => {
      unsubExercises();
      unsubLogs();
    };
  }, []);

  const confirmDeleteLog = (log: Log) => {
    Alert.alert(
      'Delete Log',
      'Are you sure you want to delete this log entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await deleteLog(log.id!);
              // Update local state by removing the log
              setAllLogs(prev => prev.filter(l => l.id !== log.id));
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete');
            }
          } 
        }
      ]
    );
  };

  // ── Derived data for selected exercise ───────────────────────────────────
  // Match both correct exercise IDs (ex_Y) and legacy composite IDs (routine_X_ex_Y)
  const exerciseLogs = selectedExercise
    ? allLogs.filter((l) => 
        l.exercise_id === selectedExercise.id || 
        l.exercise_id.endsWith('_' + selectedExercise.id)
      )
    : [];

  const filteredLogs = filterByRange(exerciseLogs, activeRange);

  // Sort newest first for the history list
  const historyLogs = [...filteredLogs].sort((a, b) => {
    const da = normaliseDateString(a.date);
    const db = normaliseDateString(b.date);
    return db.localeCompare(da);
  });

  const chartPoints = buildChartPoints(filteredLogs);

  // Number of logs per exercise (for the list)
  // Handle both correct exercise IDs and legacy composite IDs
  const logCountByExercise: Record<string, number> = {};
  exercises.forEach((ex) => {
    const count = allLogs.filter((l) => 
      l.exercise_id === ex.id || 
      l.exercise_id.endsWith('_' + ex.id)
    ).length;
    logCountByExercise[ex.id] = count;
  });

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // ── Exercise Detail View ──────────────────────────────────────────────────
  if (selectedExercise) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        >
          {/* Back button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setSelectedExercise(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backBtnText}>‹  All Exercises</Text>
          </TouchableOpacity>

          {/* Exercise header */}
          <Text style={styles.detailTitle}>{selectedExercise.name}</Text>
          <View style={styles.muscleChipLg}>
            <Text style={styles.muscleChipLgText}>{selectedExercise.muscle_group}</Text>
          </View>

          {/* Time range filter */}
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

          {/* Line Chart */}
          <View style={styles.chartCard}>
            <Text style={styles.cardLabel}>WEIGHT LIFTED OVER TIME (KG)</Text>
            {chartPoints.length === 0 ? (
              <View style={styles.emptyChart}>
                <Text style={styles.emptyChartText}>No data for this period</Text>
              </View>
            ) : (
              <LineChart points={chartPoints} />
            )}
          </View>

          {/* Log History */}
          <Text style={styles.sectionTitle}>LOG HISTORY</Text>
          {historyLogs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No sessions logged in this period.</Text>
            </View>
          ) : (
            historyLogs.map((log, i) => (
              <View key={log.id || i} style={styles.logCard}>
                <View style={styles.logDateCol}>
                  <Text style={styles.logDate}>{formatDateShort(normaliseDateString(log.date))}</Text>
                </View>
                <View style={styles.logDetails}>
                  <Text style={styles.logSetsReps}>
                    {log.sets} sets × {log.reps} reps
                  </Text>
                </View>
                <View style={styles.logWeightCol}>
                  <Text style={styles.logWeight}>{log.weight_kg}</Text>
                  <Text style={styles.logWeightUnit}>kg</Text>
                </View>
                <TouchableOpacity 
                  style={styles.deleteLogBtn} 
                  onPress={() => confirmDeleteLog(log)}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.secondary} />
                </TouchableOpacity>
              </View>
            ))
          )}

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Exercise List View ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <Text style={styles.pageTitle}>Progress</Text>
        <Text style={styles.pageSubtitle}>Tap an exercise to view your progress chart</Text>

        {exercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No exercises found. Add exercises in the Workouts tab first.
            </Text>
          </View>
        ) : (
          exercises.map((ex) => (
            <ExerciseRow
              key={ex.id}
              exercise={ex}
              logCount={logCountByExercise[ex.id] ?? 0}
              onPress={() => {
                setActiveRange('3M');
                setSelectedExercise(ex);
              }}
            />
          ))
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: Colors.background },
  container:        { flex: 1 },
  content:          { padding: Spacing.md },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── List view ─────────────────────────────────
  pageTitle: {
    fontSize: Typography.xxl,
    color: Colors.text,
    fontWeight: Typography.black,
    letterSpacing: Typography.tight,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },

  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exerciseRowLeft: { flex: 1, gap: 5 },
  exerciseRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  exerciseName: {
    fontSize: Typography.md,
    color: Colors.text,
    fontWeight: Typography.semibold,
  },
  logCountText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
  arrowIcon: {
    fontSize: 22,
    color: Colors.textMuted,
    lineHeight: 26,
  },

  muscleChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radii.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  muscleChipText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },

  // ── Detail view ───────────────────────────────
  backBtn: {
    marginBottom: Spacing.sm,
  },
  backBtnText: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.semibold,
  },
  detailTitle: {
    fontSize: Typography.xxl,
    color: Colors.text,
    fontWeight: Typography.black,
    letterSpacing: Typography.tight,
    marginBottom: Spacing.xs,
  },
  muscleChipLg: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radii.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: Spacing.md,
  },
  muscleChipLgText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },

  // ── Range filter ──────────────────────────────
  rangeRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: 4,
    marginBottom: Spacing.md,
    gap: 4,
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    borderRadius: Radii.sm,
  },
  rangeBtnActive: { backgroundColor: Colors.primary },
  rangeBtnText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  rangeBtnTextActive: {
    color: Colors.background,
    fontWeight: Typography.bold,
  },

  // ── Chart card ────────────────────────────────
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wider,
    marginBottom: Spacing.sm,
  },
  chartContainer: {
    position: 'relative',
    width: '100%',
  },
  emptyChart: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.border,
    opacity: 0.5,
  },
  chartDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  yAxis: {
    justifyContent: 'space-between',
  },
  axisLabel: {
    fontSize: 9,
    color: Colors.textMuted,
  },

  // ── Log history ───────────────────────────────
  sectionTitle: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wider,
    marginBottom: Spacing.sm,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  logDateCol: {
    width: 52,
  },
  logDate: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  logDetails: {
    flex: 1,
  },
  logSetsReps: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: Typography.semibold,
  },
  logWeightCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  logWeight: {
    fontSize: Typography.lg,
    color: Colors.primary,
    fontWeight: Typography.black,
  },
  logWeightUnit: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },

  // ── Shared empty state ────────────────────────
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
    lineHeight: 22,
  },
  deleteLogBtn: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
});
