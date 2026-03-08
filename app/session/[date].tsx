/**
 * Session Detail Screen
 *
 * Displays the full workout session logged for a given date.
 * Supports inline editing of sets, reps, and weight_kg per exercise.
 * Navigated to from the Calendar screen via router.push('/session/[date]').
 */

import {
  collection,
  COLLECTIONS,
  db,
  Exercise,
  Log,
  onSnapshot,
  Routine,
  updateLog
} from '@/services/firestore';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMuscleColor } from '@/constants/muscleColors';
import { Colors, Radii, Spacing, Typography } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedLog extends Log {
  exerciseName: string;
  muscleGroup: string;
  routineName: string;
}

interface EditableFields {
  sets: string;
  reps: string;
  weight_kg: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format an ISO date string to a readable label, e.g. "Saturday, 1 March 2026" */
function formatDateLabel(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Normalise any date string to YYYY-MM-DD.
 * Mirrors the calendar screen logic.
 */
function normaliseDateString(raw: string): string {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.substring(0, 10);
  const trimmed = raw.trim().split(' ')[0];
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m}-${d}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  try {
    const dt = new Date(raw);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }
  } catch { /* ignore */ }
  return trimmed;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SessionDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();

  // State
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<EnrichedLog[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, EditableFields>>({});
  const [error, setError] = useState<string | null>(null);

  // Refs to track if user has unsaved changes
  const hasChanges = useRef(false);

  // ── Data fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!date) return;

    let exerciseMap: Record<string, Exercise> = {};
    let routineMap: Record<string, Routine> = {};
    let rawLogs: Log[] = [];
    let exercisesLoaded = false;
    let routinesLoaded = false;
    let logsLoaded = false;

    const enrichAndSet = () => {
      if (!exercisesLoaded || !routinesLoaded || !logsLoaded) return;

      const enriched: EnrichedLog[] = rawLogs.map((log) => {
        // Find the exercise that matches this log's exercise_id exactly, 
        // or matches the legacy composite format (e.g., routine_123_ex_456 ending with _ex_456)
        let ex: Exercise | undefined = exerciseMap[log.exercise_id];
        if (!ex && log.exercise_id.includes('_')) {
          ex = Object.values(exerciseMap).find(e => 
            log.exercise_id.endsWith('_' + e.id)
          );
        }

        const rt = routineMap[log.routine_id];
        return {
          ...log,
          exerciseName: ex?.name ?? 'Unknown Exercise',
          muscleGroup: ex?.muscle_group ?? 'Other',
          routineName: rt?.name ?? 'Unknown Routine',
        };
      });

      setLogs(enriched);
      setLoading(false);
    };

    // Listen to logs for this date
    const unsubLogs = onSnapshot(
      collection(db, COLLECTIONS.logs),
      (snap) => {
        rawLogs = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id ?? d.id),
              date: String(data.date),
              routine_id: String(data.routine_id),
              exercise_id: String(data.exercise_id),
              sets: Number(data.sets),
              reps: String(data.reps),
              weight_kg: Number(data.weight_kg),
            };
          })
          .filter((l) => normaliseDateString(l.date) === date);
        logsLoaded = true;
        enrichAndSet();
      },
      (err) => {
        console.error('[SessionDetail] Logs error:', err);
        setError('Failed to load workout data');
        setLoading(false);
      }
    );

    // Listen to exercises
    const unsubExercises = onSnapshot(
      collection(db, COLLECTIONS.exercises),
      (snap) => {
        exerciseMap = {};
        snap.docs.forEach((d) => {
          const ex = d.data() as Exercise;
          exerciseMap[ex.id ?? d.id] = { ...ex, id: ex.id ?? d.id };
        });
        exercisesLoaded = true;
        enrichAndSet();
      },
      (err) => {
        console.error('[SessionDetail] Exercises error:', err);
      }
    );

    // Listen to routines
    const unsubRoutines = onSnapshot(
      collection(db, COLLECTIONS.routines),
      (snap) => {
        routineMap = {};
        snap.docs.forEach((d) => {
          const rt = d.data() as Routine;
          routineMap[rt.id ?? d.id] = { ...rt, id: rt.id ?? d.id };
        });
        routinesLoaded = true;
        enrichAndSet();
      },
      (err) => {
        console.error('[SessionDetail] Routines error:', err);
      }
    );

    return () => {
      unsubLogs();
      unsubExercises();
      unsubRoutines();
    };
  }, [date]);

  // ── Edit mode handlers ────────────────────────────────────────────────────

  const enterEditMode = useCallback(() => {
    const initial: Record<string, EditableFields> = {};
    logs.forEach((log) => {
      initial[log.id] = {
        sets: String(log.sets),
        reps: String(log.reps),
        weight_kg: String(log.weight_kg),
      };
    });
    setEditValues(initial);
    hasChanges.current = false;
    setEditing(true);
  }, [logs]);

  const cancelEdit = useCallback(() => {
    if (hasChanges.current) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setEditing(false);
              hasChanges.current = false;
            },
          },
        ]
      );
    } else {
      setEditing(false);
    }
  }, []);

  const updateField = useCallback((logId: string, field: keyof EditableFields, value: string) => {
    hasChanges.current = true;
    setEditValues((prev) => ({
      ...prev,
      [logId]: { ...prev[logId], [field]: value },
    }));
  }, []);

  const saveChanges = useCallback(async () => {
    setSaving(true);
    try {
      const updates: Promise<void>[] = [];

      for (const log of logs) {
        const edited = editValues[log.id];
        if (!edited) continue;

        const newSets = edited.sets.trim();
        const newReps = edited.reps.trim();
        const newWeight = parseFloat(edited.weight_kg);
        const newSetsNum = parseInt(newSets, 10);

        // Only update if something actually changed
        const changed =
          newSetsNum !== log.sets ||
          newReps !== String(log.reps) ||
          newWeight !== log.weight_kg;

        if (changed) {
          const fields: Partial<Pick<Log, 'sets' | 'reps' | 'weight_kg'>> = {};
          if (!isNaN(newSetsNum) && newSetsNum !== log.sets) fields.sets = newSetsNum;
          if (newReps !== String(log.reps)) fields.reps = newReps;
          if (!isNaN(newWeight) && newWeight !== log.weight_kg) fields.weight_kg = newWeight;

          if (Object.keys(fields).length > 0) {
            updates.push(updateLog(log.id, fields));
          }
        }
      }

      await Promise.all(updates);
      setEditing(false);
      hasChanges.current = false;
      Alert.alert('✅ Saved', 'Session updated successfully.');
    } catch (err) {
      console.error('[SessionDetail] Save error:', err);
      Alert.alert(
        'Save Failed',
        err instanceof Error ? err.message : 'Could not save changes. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }, [logs, editValues]);

  // ── Back handler with discard guard ───────────────────────────────────────

  const handleBack = useCallback(() => {
    if (editing && hasChanges.current) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to leave?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard & Leave',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  }, [editing]);

  // ── Derived ────────────────────────────────────────────────────────────────

  // Get unique routine name (most logs for a date share the same routine)
  const routineName = logs.length > 0 ? logs[0].routineName : '';
  const dateLabel = date ? formatDateLabel(date) : '';

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.secondary} />
          <Text style={styles.emptyTitle}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {routineName || 'Workout Session'}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {dateLabel}
            </Text>
          </View>

          {logs.length > 0 && !editing && (
            <TouchableOpacity onPress={enterEditMode} style={styles.editBtn}>
              <Ionicons name="pencil" size={14} color={Colors.background} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}

          {editing && (
            <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Content ── */}
        {logs.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="barbell-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No workout data found for this day</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {logs.map((log) => {
              const muscleColor = getMuscleColor(log.muscleGroup);
              const ev = editValues[log.id];

              return (
                <View key={log.id} style={styles.card}>
                  {/* Exercise name + muscle pill */}
                  <View style={styles.cardHeader}>
                    <Text style={styles.exerciseName}>{log.exerciseName}</Text>
                    <View
                      style={[
                        styles.musclePill,
                        {
                          backgroundColor: muscleColor + '22',
                          borderColor: muscleColor + '66',
                        },
                      ]}
                    >
                      <Text style={[styles.musclePillText, { color: muscleColor }]}>
                        {log.muscleGroup}
                      </Text>
                    </View>
                  </View>

                  {/* View mode: static display */}
                  {!editing && (
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Sets</Text>
                        <Text style={styles.statValue}>{log.sets}</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Reps</Text>
                        <Text style={styles.statValue}>{log.reps}</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Weight</Text>
                        <Text style={styles.statValue}>{log.weight_kg} <Text style={styles.statUnit}>KG</Text></Text>
                      </View>
                    </View>
                  )}

                  {/* Edit mode: inputs */}
                  {editing && ev && (
                    <View style={styles.editRow}>
                      <View style={styles.editField}>
                        <Text style={styles.editFieldLabel}>Sets</Text>
                        <TextInput
                          style={styles.editInput}
                          value={ev.sets}
                          onChangeText={(v) => updateField(log.id, 'sets', v)}
                          keyboardType="numeric"
                          placeholderTextColor={Colors.textMuted}
                          selectTextOnFocus
                        />
                      </View>
                      <View style={styles.editField}>
                        <Text style={styles.editFieldLabel}>Reps</Text>
                        <TextInput
                          style={styles.editInput}
                          value={ev.reps}
                          onChangeText={(v) => updateField(log.id, 'reps', v)}
                          keyboardType="numeric"
                          placeholderTextColor={Colors.textMuted}
                          selectTextOnFocus
                        />
                      </View>
                      <View style={styles.editField}>
                        <Text style={styles.editFieldLabel}>Weight (KG)</Text>
                        <TextInput
                          style={styles.editInput}
                          value={ev.weight_kg}
                          onChangeText={(v) => updateField(log.id, 'weight_kg', v)}
                          keyboardType="decimal-pad"
                          placeholderTextColor={Colors.textMuted}
                          selectTextOnFocus
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Save button when editing */}
            {editing && (
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={saveChanges}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.background} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.background} />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <View style={{ height: Spacing.xxl }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    marginTop: Spacing.sm,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.text,
    letterSpacing: Typography.tight,
  },
  headerSubtitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  editBtnText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.background,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
  },

  // Empty state
  emptyTitle: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: {
    padding: Spacing.md,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  exerciseName: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  musclePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  musclePillText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },

  // View mode stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radii.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wide,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    fontSize: Typography.lg,
    color: Colors.text,
    fontWeight: Typography.bold,
  },
  statUnit: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.xs,
  },

  // Edit mode
  editRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  editField: {
    flex: 1,
  },
  editFieldLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wide,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  editInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: Typography.md,
    color: Colors.text,
    fontWeight: Typography.semibold,
    textAlign: 'center',
  },

  // Save button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    paddingVertical: Spacing.md - 2,
    marginTop: Spacing.md,
  },
  saveBtnText: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.background,
  },
});
