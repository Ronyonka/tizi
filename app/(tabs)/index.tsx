import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
    onSnapshot,
    query,
    where,
} from 'firebase/firestore';

import { COLLECTIONS } from '@/config/firebase';
import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { db } from '@/services/firebase';
import { batchAppendLogs, Exercise, Log, Routine, RoutineExercise } from '@/services/firestore';

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
  const [todayRoutine, setTodayRoutine] = useState<Routine | null>(null);
  const [exercises, setExercises] = useState<ExerciseWithTarget[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingWorkout[]>([]);
  const [logs, setLogs] = useState<Record<string, SetLog[]>>({});
  const [isCompleted, setIsCompleted] = useState(false);

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

      // 1. Process Today's Routine
      const routine = allRoutines.find((r) => r.day_of_week === todayDay);
      if (routine) {
        setTodayRoutine(routine);
        const routineExp = allRoutineExercises.filter(re => re.routine_id === routine.id);
        const joined: ExerciseWithTarget[] = routineExp.map((re) => {
          const ex = allExercises.find((e) => e.id === re.exercise_id);
          // If exercise is not yet loaded, we skip or show placeholder
          return ex ? { ...ex, ...re } : null;
        }).filter(Boolean) as ExerciseWithTarget[];
        
        setExercises(joined);

        // Update logs state - combine existing input with DB logs for today
        setLogs((prev) => {
          const newLogs: Record<string, SetLog[]> = { ...prev };
          joined.forEach((ex) => {
            const numSets = parseInt(ex.sets) || 3;
            const exLogs = todayLogs.filter(l => l.exercise_id === ex.id);
            
            // If we have DB logs for this exercise today, prioritize them
            if (exLogs.length > 0) {
              newLogs[ex.id] = exLogs
                .sort((a, b) => parseInt(a.sets) - parseInt(b.sets))
                .map(l => ({ weight: String(l.weight_kg), reps: String(l.reps) }));
            } 
            // Otherwise, if no local input exists yet for this exercise, initialize it
            else if (!newLogs[ex.id] || newLogs[ex.id].length === 0) {
              newLogs[ex.id] = Array(numSets).fill({ weight: '', reps: '' });
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
        const r = allRoutines.find(routine => routine.day_of_week === dayName);
        const dayLabel = idx === 0 ? 'Tomorrow' : dayName.slice(0, 3);
        
        if (!r) {
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
    const dateStr = new Date().toLocaleDateString();
    const qLogs = query(
      collection(db, COLLECTIONS.logs),
      where('date', '>=', dateStr),
      where('date', '<=', dateStr + ' \uf8ff')
    );
    
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      todayLogs = snap.docs.map(d => d.data() as Log);
      updateState();
      
      // If we have any logs for today, mark as completed but ONLY if 
      // we haven't manually toggled back to editing mode.
      if (todayLogs.length > 0) {
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
    };
  }, []);

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

  const completeWorkout = async () => {
    if (!todayRoutine) return;

    try {
      setSaving(true);
      const workoutLogs: Omit<Log, 'id'>[] = [];
      const timestamp = new Date().toISOString();
      const dateStr = new Date().toLocaleDateString();

      Object.entries(logs).forEach(([exerciseId, sets]) => {
        sets.forEach((set, idx) => {
          if (set.weight || set.reps) {
            workoutLogs.push({
              date: new Date().toISOString(),
              routine_id: todayRoutine.id,
              exercise_id: exerciseId,
              sets: String(idx + 1),
              reps: set.reps || '0',
              weight_kg: parseFloat(set.weight) || 0,
            });
          }
        });
      });

      if (workoutLogs.length === 0) {
        Alert.alert('Empty Workout', 'Please log at least one set before completing.');
        setSaving(false);
        return;
      }

      await batchAppendLogs(workoutLogs);

      setIsCompleted(true);
      Alert.alert('Success', 'Workout logged successfully! Great job 👊');
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

        {!todayRoutine ? (
          <View style={styles.restDayCard}>
            <Text style={styles.restDayTitle}>It's Rest Day! 🧘‍♂️</Text>
            <Text style={styles.restDaySub}>
              Recovery is where the growth happens. Take it easy today or do some light mobility work.
            </Text>
          </View>
        ) : (
          <>
            {/* Banner */}
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => isCompleted && setIsCompleted(false)}
            >
              <View style={[styles.banner, isCompleted && styles.bannerCompleted]}>
                <Text style={[styles.bannerLabel, isCompleted && styles.bannerLabelCompleted]}>
                  {isCompleted ? 'WORKOUT DONE' : "TODAY'S WORKOUT"}
                </Text>
                <Text style={styles.bannerTitle}>{todayRoutine.name}</Text>
                <Text style={styles.bannerSub}>
                  {isCompleted 
                    ? 'Great job today! Tap to view/edit logs.' 
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
                  onPress={completeWorkout}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={Colors.background} />
                  ) : (
                    <Text style={styles.completeBtnText}>Complete Workout</Text>
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
