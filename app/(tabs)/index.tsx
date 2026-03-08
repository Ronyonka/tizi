import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';

import { COLLECTIONS } from '@/config/firebase';
import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { db } from '@/services/firebase';
import { batchAppendLogs, deleteLog, Exercise, Log, Routine, RoutineExercise } from '@/services/firestore';

const USERNAME = 'Ron';

interface ExerciseWithTarget extends Exercise, RoutineExercise {}

interface SetLog {
  weight: string;
  reps: string;
}

interface UpcomingWorkout {
  day: string;
  name: string;
  tags: string[];
}

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRoutineName, setActiveRoutineName] = useState<string | null | undefined>(undefined);
  const [todayRoutine, setTodayRoutine] = useState<Routine | null>(null);
  const [exercises, setExercises] = useState<ExerciseWithTarget[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingWorkout[]>([]);
  const [logs, setLogs] = useState<Record<string, SetLog[]>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isEditingRef = useRef(false);
  const [todayLogIds, setTodayLogIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Use a ref for activeRoutineName to avoid re-triggering the data listener effect
  const activeRoutineRef = useRef<string | null | undefined>(undefined);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  useEffect(() => {
    // ── Realtime listeners ──────────────────────────────────────────────────
    
    // We need routines, routine-exercises, and exercises to build the screen.
    // Instead of complex joined queries, we can listen to the collections
    // and re-calculate the derived state locally. This keeps the logic simple
    // and ensures consistency.

    let allRoutines: Routine[] = [];
    let allRoutineExercises: RoutineExercise[] = [];
    let allExercises: Exercise[] = [];
    let todayLogs: Log[] = [];

    const updateState = () => {
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const now = new Date();
      const todayDay = daysOfWeek[now.getDay()];

      const currentActiveRoutine = activeRoutineRef.current;
      if (currentActiveRoutine === undefined) return; // Wait until fetched

      // 1. Process Today's Routine
      const routine = allRoutines.find((r) => 
        r.day_of_week === todayDay && 
        (currentActiveRoutine === null || r.name === currentActiveRoutine)
      );

      if (routine && currentActiveRoutine !== null) {
        setTodayRoutine(routine);
        const routineExp = allRoutineExercises.filter(re => re.routine_id === routine.id);
        const joined: ExerciseWithTarget[] = routineExp.map((re) => {
          const ex = allExercises.find((e) => e.id === re.exercise_id);
          // Spread re first, then ex, so exercise.id isn't overridden by routine_exercise doc id
          return ex ? { ...re, ...ex } : null;
        }).filter(Boolean) as ExerciseWithTarget[];
        
        setExercises(joined);

        // Update logs state - combine existing input with DB logs for today
        setLogs((prev) => {
          const newLogs: Record<string, SetLog[]> = { ...prev };
          joined.forEach((ex) => {
            const numSets = parseInt(ex.sets) || 3;
            // New model: at most one log doc per exercise per day
            const logDoc = todayLogs.find(l => 
              l.exercise_id === ex.id || l.exercise_id.endsWith('_' + ex.id)
            );
            
            // If we have a DB log for this exercise today, reconstruct set rows from it
            if (logDoc) {
              const storedSets = Number(logDoc.sets) || 1;
              const row = { weight: String(logDoc.weight_kg), reps: String(logDoc.reps) };
              newLogs[ex.id] = Array(storedSets).fill(null).map(() => ({ ...row }));
            } 
            // Otherwise, if no local input exists yet for this exercise, initialize it
            else if (!newLogs[ex.id] || newLogs[ex.id].length === 0) {
              newLogs[ex.id] = Array(numSets).fill(null).map(() => ({ weight: '', reps: '' }));
            }
          });
          return newLogs;
        });
      } else {
        setTodayRoutine(null);
        setExercises([]);
      }

      // 2. Process Upcoming
      const upcomingDayNames: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const nextDate = new Date();
        nextDate.setDate(now.getDate() + i);
        upcomingDayNames.push(daysOfWeek[nextDate.getDay()]);
      }

      const upcomingData: UpcomingWorkout[] = upcomingDayNames.map((dayName, idx) => {
        const r = allRoutines.find(routine => 
          routine.day_of_week === dayName && 
          (currentActiveRoutine === null || routine.name === currentActiveRoutine)
        );
        const dayLabel = idx === 0 ? 'Tomorrow' : dayName.slice(0, 3);
        
        if (!r || currentActiveRoutine === null) {
          return { day: dayLabel, name: 'Rest Day', tags: ['Recovery'] };
        }

        const reList = allRoutineExercises.filter(re => re.routine_id === r.id);
        const muscleGroups = new Set<string>();
        reList.forEach(re => {
          const ex = allExercises.find(e => e.id === re.exercise_id);
          if (ex?.muscle_group) muscleGroups.add(ex.muscle_group);
        });

        return {
          day: dayLabel,
          name: r.name,
          tags: Array.from(muscleGroups)
        };
      });

      setUpcoming(upcomingData);
      setLoading(false);
    };

    // Listen to active routine preference separately to drive state updates
    const unsubPref = onSnapshot(doc(db, COLLECTIONS.settings, 'user_preferences'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const newRoutine = data.active_routine_name || null;
        activeRoutineRef.current = newRoutine;
        setActiveRoutineName(newRoutine);
        updateState(); // Re-run calculations with the new ref value
      } else {
        activeRoutineRef.current = null;
        setActiveRoutineName(null);
        updateState();
      }
    });

    // Listen to Routines
    const unsubRoutines = onSnapshot(collection(db, COLLECTIONS.routines), (snap) => {
      allRoutines = snap.docs.map(d => ({ ...(d.data() as Routine), id: d.id }));
      updateState();
    }, (err) => {
      console.error('[Home] Routines listener error:', err);
      setLoading(false);
    });

    // Listen to Routine Exercises
    const unsubRE = onSnapshot(collection(db, COLLECTIONS.routineExercises), (snap) => {
      allRoutineExercises = snap.docs.map(d => ({ ...(d.data() as RoutineExercise), id: d.id }));
      updateState();
    }, (err) => {
      console.error('[Home] Routine-exercises listener error:', err);
    });

    // Listen to Exercises
    const unsubExercises = onSnapshot(collection(db, COLLECTIONS.exercises), (snap) => {
      allExercises = snap.docs.map(d => ({ ...(d.data() as Exercise), id: d.id }));
      updateState();
    }, (err) => {
      console.error('[Home] Exercises listener error:', err);
    });

    // Listen to Logs for today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const qLogs = query(
      collection(db, COLLECTIONS.logs),
      where('date', '>=', startOfDay.toISOString()),
      where('date', '<=', endOfDay.toISOString())
    );
    
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      todayLogs = snap.docs.map(d => {
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
      });
      // Track log IDs for edit/delete operations
      setTodayLogIds(todayLogs.map(l => l.id));
      updateState();
      
      // If we have any logs for today, mark as completed but ONLY if 
      // we haven't manually toggled back to editing mode.
      if (todayLogs.length > 0 && !isEditingRef.current) {
        setIsCompleted(true);
      }
    }, (err) => {
      console.error('[Home] Logs listener error:', err);
    });

    return () => {
      unsubRoutines();
      unsubRE();
      unsubExercises();
      unsubLogs();
      unsubPref();
    };
  }, []); // Run ONCE on mount to set up listeners

  const handleLogChange = (exerciseId: string, setIndex: number, field: keyof SetLog, value: string) => {
    setLogs((prev) => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((set, i) =>
        i === setIndex ? { ...set, [field]: value } : set
      ),
    }));
  };

  const addSet = (exerciseId: string) => {
    setLogs((prev) => ({
      ...prev,
      [exerciseId]: [...prev[exerciseId], { weight: '', reps: '' }],
    }));
  };

  const removeSet = (exerciseId: string, setIndex: number) => {
    setLogs((prev) => ({
      ...prev,
      [exerciseId]: prev[exerciseId].filter((_, i) => i !== setIndex),
    }));
  };

  const saveWorkout = async () => {
    if (!todayRoutine) return;

    try {
      setSaving(true);
      const workoutLogs: Omit<Log, 'id'>[] = [];

      Object.entries(logs).forEach(([exerciseId, sets]) => {
        // Collect only sets that have been filled in
        const filledSets = sets.filter(s => s.weight || s.reps);
        if (filledSets.length === 0) return;
        // One log document per exercise — store total sets, reps/weight from first set
        const first = filledSets[0];
        workoutLogs.push({
          date: new Date().toISOString(),
          routine_id: todayRoutine.id,
          exercise_id: exerciseId,
          sets: filledSets.length,
          reps: first.reps || '0',
          weight_kg: parseFloat(first.weight) || 0,
        });
      });

      if (workoutLogs.length === 0) {
        Alert.alert('Empty Workout', 'Please log at least one set before saving.');
        setSaving(false);
        return;
      }

      // If editing, delete old logs first
      if (isEditing && todayLogIds.length > 0) {
        await Promise.all(todayLogIds.map(id => deleteLog(id)));
      }

      await batchAppendLogs(workoutLogs);

      setIsCompleted(true);
      setIsEditing(false);
      isEditingRef.current = false;
      Alert.alert('Success', isEditing ? 'Workout updated! 💪' : 'Workout logged successfully! Great job 👊');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save workout logs';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text style={styles.username}>{USERNAME} 👊</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{USERNAME[0]}</Text>
          </View>
        </View>

        {activeRoutineName === null ? (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateIconWrapper}>
              <Text style={{ fontSize: 48 }}>🤔</Text>
            </View>
            <Text style={styles.emptyStateTitle}>No Active Routine</Text>
            <Text style={styles.emptyStateSubtitle}>
              You haven't selected an active routine yet. Go to Settings to choose what you're currently following.
            </Text>
            <TouchableOpacity 
              style={styles.settingsNavBtn} 
              onPress={() => router.push('/(tabs)/settings')}
              activeOpacity={0.8}
            >
              <Text style={styles.settingsNavBtnText}>Go to Settings</Text>
            </TouchableOpacity>
          </View>
        ) : !todayRoutine ? (
          <View style={styles.restDayCard}>
            <Text style={styles.restDayTitle}>It's Rest Day! 🧘‍♂️</Text>
            <Text style={styles.restDaySub}>
              Your "{activeRoutineName}" routine has no workout scheduled for today.{'\n'}Take it easy today or do some light mobility work.
            </Text>
          </View>
        ) : (
          <>
            {/* Banner */}
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => {
                if (isCompleted) {
                  setIsCompleted(false);
                  setIsEditing(true);
                  isEditingRef.current = true;
                }
              }}
            >
              <View style={[styles.banner, isCompleted && styles.bannerCompleted]}>
                <Text style={[styles.bannerLabel, isCompleted && styles.bannerLabelCompleted]}>
                  {isCompleted ? 'WORKOUT DONE' : isEditing ? 'EDITING WORKOUT' : "TODAY'S WORKOUT"}
                </Text>
                <Text style={styles.bannerTitle}>{todayRoutine.name}</Text>
                <Text style={styles.bannerSub}>
                  {isCompleted 
                    ? 'Great job today! Tap to edit logs.' 
                    : isEditing
                    ? 'Modify your sets below and save.'
                    : new Date().toLocaleDateString('en-US', { weekday: 'long' })}
                </Text>
              </View>
            </TouchableOpacity>

            {!isCompleted && (
              <>
                {/* Exercises */}
                <Text style={styles.sectionTitle}>EXERCISES</Text>
                {exercises.map((ex) => (
                  <View key={ex.id} style={styles.exerciseCard}>
                    <View style={styles.exerciseHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exerciseName}>{ex.name}</Text>
                        <Text style={styles.exerciseTarget}>Target: {ex.sets} sets × {ex.reps} reps</Text>
                      </View>
                      <Text style={styles.exerciseMuscle}>{ex.muscle_group}</Text>
                    </View>

                    {/* Sets Header */}
                    <View style={styles.setsHeader}>
                      <Text style={[styles.setHeaderText, { width: 40 }]}>Set</Text>
                      <Text style={[styles.setHeaderText, { flex: 1 }]}>Weight (KG)</Text>
                      <Text style={[styles.setHeaderText, { flex: 1 }]}>Reps</Text>
                      <View style={{ width: 30 }} />
                    </View>

                    {/* Logs */}
                    {logs[ex.id]?.map((set, idx) => (
                      <View key={idx} style={styles.setRow}>
                        <Text style={styles.setNumber}>{idx + 1}</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="numeric"
                          value={set.weight}
                          onChangeText={(val) => handleLogChange(ex.id, idx, 'weight', val)}
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="numeric"
                          value={set.reps}
                          onChangeText={(val) => handleLogChange(ex.id, idx, 'reps', val)}
                        />
                        <TouchableOpacity onPress={() => removeSet(ex.id, idx)} style={styles.removeSetBtn}>
                          <Text style={styles.removeSetText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}

                    <TouchableOpacity onPress={() => addSet(ex.id)} style={styles.addSetBtn}>
                      <Text style={styles.addSetBtnText}>+ Add Set</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.completeBtn, saving && styles.disabledBtn]}
                  onPress={saveWorkout}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={Colors.background} />
                  ) : (
                    <Text style={styles.completeBtnText}>
                      {isEditing ? 'Update Workout' : 'Complete Workout'}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {/* Upcoming */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.md }]}>UPCOMING</Text>
        {upcoming.map((item, i) => (
          <View key={i} style={styles.scheduleCard}>
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
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

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
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  bannerCompleted: {
    backgroundColor: Colors.surface, // Stay consistent with normal state if possible or use a subtle change
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  bannerLabel: {
    fontSize: Typography.xs,
    color: Colors.primary,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wider,
    marginBottom: Spacing.xs,
  },
  bannerLabelCompleted: {
    color: Colors.primary,
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
  },

  restDayCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    marginBottom: Spacing.md,
  },
  restDayTitle: {
    fontSize: Typography.xl,
    color: Colors.text,
    fontWeight: Typography.bold,
    marginBottom: Spacing.sm,
  },
  restDaySub: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  sectionTitle: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wider,
    marginBottom: Spacing.sm,
  },
  exerciseCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  exerciseName: {
    fontSize: Typography.lg,
    color: Colors.text,
    fontWeight: Typography.bold,
  },
  exerciseTarget: {
    fontSize: Typography.sm,
    color: Colors.primary,
    marginTop: 2,
  },
  exerciseMuscle: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  setsHeader: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  setHeaderText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    textTransform: 'uppercase',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  setNumber: {
    width: 40,
    fontSize: Typography.md,
    color: Colors.textSecondary,
    fontWeight: Typography.bold,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    color: Colors.text,
    fontSize: Typography.md,
    textAlign: 'center',
  },
  removeSetBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeSetText: {
    color: Colors.secondary,
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
  },
  
  emptyStateContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyStateIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyStateTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptyStateSubtitle: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  settingsNavBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: Radii.md,
    width: '100%',
    alignItems: 'center',
  },
  settingsNavBtnText: {
    color: Colors.background,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },

  addSetBtn: {
    marginTop: Spacing.xs,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.sm,
    borderStyle: 'dashed',
  },
  addSetBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },

  completeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  completeBtnText: {
    color: Colors.background,
    fontSize: Typography.lg,
    fontWeight: Typography.black,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
