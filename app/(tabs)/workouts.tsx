/**
 * Workouts Screen
 *
 * Displays routines grouped by day of week.
 * Supports add/edit/delete for routines and exercises.
 * Syncs all data to Firestore via Expo API routes.
 * Supports CSV bulk-import.
 */

import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { collection, onSnapshot } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLLECTIONS } from '@/config/firebase';
import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { db } from '@/services/firebase';
import {
  appendExercise,
  appendRoutine,
  appendRoutineExercise,
  deleteAllRoutineExercisesForRoutine,
  deleteRoutine,
  deleteRoutineExercise,
  Exercise,
  findExerciseByName,
  findRoutineByNameAndDay,
  Routine,
  RoutineExercise,
  updateRoutine,
  updateRoutineExercise
} from '@/services/firestore';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

import { getMuscleColor, MUSCLE_GROUPS } from '@/constants/muscleColors';

// Removed getBaseUrl and apiFetch

// ─── Main Component ──────────────────────────────────────────────────────────

export default function WorkoutsScreen() {
  // Data
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [routineExercises, setRoutineExercises] = useState<RoutineExercise[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRoutines, setExpandedRoutines] = useState<Set<string>>(new Set());

  // Modal: Add/Edit Routine
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [routineName, setRoutineName] = useState('');
  const [routineDay, setRoutineDay] = useState(DAYS[0]);
  const [routineLoading, setRoutineLoading] = useState(false);

  // Modal: Add Exercise to Routine
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [targetRoutineId, setTargetRoutineId] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseTab, setExerciseTab] = useState<'search' | 'create'>('search');
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState(MUSCLE_GROUPS[0]);
  const [exSets, setExSets] = useState('3');
  const [exReps, setExReps] = useState('10');
  const [exerciseLoading, setExerciseLoading] = useState(false);

  // Modal: Edit sets/reps
  const [showEditSetsModal, setShowEditSetsModal] = useState(false);
  const [editingRE, setEditingRE] = useState<(RoutineExercise & { exercise_name: string }) | null>(null);
  const [editSets, setEditSets] = useState('3');
  const [editReps, setEditReps] = useState('10');
  const [editSetsLoading, setEditSetsLoading] = useState(false);

  // CSV uploading
  const [csvUploading, setCsvUploading] = useState(false);

  // Animation for loading pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (loading || syncing || csvUploading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [loading, syncing, csvUploading]);

  // ── Data loading ─────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    
    // Listen to Routines
    const unsubRoutines = onSnapshot(collection(db, COLLECTIONS.routines), (snap) => {
      setRoutines(snap.docs.map(d => ({ ...(d.data() as Routine), id: d.id })));
      setLoading(false);
    }, (err) => {
      console.error('[Workouts] Routines listener error:', err);
      setError(`Failed to load routines: ${err.message}`);
      setLoading(false);
    });

    // Listen to Exercises
    const unsubExercises = onSnapshot(collection(db, COLLECTIONS.exercises), (snap) => {
      setExercises(snap.docs.map(d => ({ ...(d.data() as Exercise), id: d.id })));
    }, (err) => {
      console.error('[Workouts] Exercises listener error:', err);
    });

    // Listen to Routine Exercises
    const unsubRE = onSnapshot(collection(db, COLLECTIONS.routineExercises), (snap) => {
      setRoutineExercises(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, // Spread document ID
          routine_id: String(data.routine_id),
          exercise_id: String(data.exercise_id),
          sets: String(data.sets),
          reps: String(data.reps),
        } as (RoutineExercise & { id: string });
      }));
    }, (err) => {
      console.error('[Workouts] Routine-exercises listener error:', err);
    });

    return () => {
      unsubRoutines();
      unsubExercises();
      unsubRE();
    };
  }, []);

  const refresh = useCallback(async () => {
    // Manual refresh is now mostly redundant but kept as a simple way to clear error status
    setError(null);
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────

  const exerciseMap = Object.fromEntries(exercises.map((e) => [e.id, e]));

  const routinesByDay = DAYS.reduce<Record<string, Routine[]>>((acc, day) => {
    acc[day] = routines.filter((r) => r.day_of_week === day);
    return acc;
  }, {});

  const unscheduled = routines.filter((r) => !DAYS.includes(r.day_of_week));

  // ── Routine CRUD ─────────────────────────────────────────────────────────

  function openAddRoutine() {
    setEditingRoutine(null);
    setRoutineName('');
    setRoutineDay(DAYS[0]);
    setShowRoutineModal(true);
  }

  function openEditRoutine(routine: Routine) {
    setEditingRoutine(routine);
    setRoutineName(routine.name);
    setRoutineDay(routine.day_of_week);
    setShowRoutineModal(true);
  }

  async function saveRoutine() {
    if (!routineName.trim()) {
      Alert.alert('Validation', 'Please enter a routine name.');
      return;
    }
    setRoutineLoading(true);
    try {
      if (editingRoutine) {
        // PATCH
        await updateRoutine(editingRoutine.id, {
          name: routineName.trim(),
          day_of_week: routineDay,
        });
      } else {
        // POST
        const newRoutineItem: Routine = {
          id: `routine_${Date.now()}`,
          name: routineName.trim(),
          day_of_week: routineDay,
        };
        const savedRoutine = await appendRoutine(newRoutineItem);
        setExpandedRoutines((prev) => new Set([...prev, savedRoutine.id]));
      }
      setShowRoutineModal(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save routine');
    } finally {
      setRoutineLoading(false);
    }
  }

  function confirmDeleteRoutine(routine: Routine) {
    Alert.alert(
      'Delete Routine',
      `Are you sure you want to delete "${routine.name}"? This will also remove all exercises in this routine.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRoutine(routine.id);
              await deleteAllRoutineExercisesForRoutine(routine.id);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete');
            }
          },
        },
      ]
    );
  }

  // ── Exercise CRUD ────────────────────────────────────────────────────────

  function openAddExercise(routineId: string) {
    setTargetRoutineId(routineId);
    setExerciseSearch('');
    setExerciseTab('search');
    setNewExName('');
    setNewExMuscle(MUSCLE_GROUPS[0]);
    setExSets('3');
    setExReps('10');
    setShowExerciseModal(true);
  }

  const filteredExercises = exercises.filter((e) => {
    const q = exerciseSearch.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.muscle_group.toLowerCase().includes(q);
  });

  // Exercises already in this routine
  const routineExIds = new Set(
    routineExercises
      .filter((re) => re.routine_id === targetRoutineId)
      .map((re) => re.exercise_id)
  );

  async function addExistingExercise(exercise: Exercise) {
    if (!targetRoutineId) return;
    if (routineExIds.has(exercise.id)) {
      Alert.alert('Already Added', `"${exercise.name}" is already in this routine.`);
      return;
    }
    setExerciseLoading(true);
    try {
      const newRE: RoutineExercise = {
        routine_id: targetRoutineId,
        exercise_id: exercise.id,
        sets: exSets,
        reps: exReps,
      };
      await appendRoutineExercise(newRE);
      setShowExerciseModal(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add exercise');
    } finally {
      setExerciseLoading(false);
    }
  }

  async function createAndAddExercise() {
    if (!newExName.trim()) {
      Alert.alert('Validation', 'Please enter an exercise name.');
      return;
    }
    if (!targetRoutineId) return;
    setExerciseLoading(true);
    try {
      // Create exercise first
      const newExItem: Exercise = {
        id: `ex_${Date.now()}`,
        name: newExName.trim(),
        muscle_group: newExMuscle,
      };
      const savedExItem = await appendExercise(newExItem);

      // Then link to routine
      const newRE: RoutineExercise = {
        routine_id: targetRoutineId,
        exercise_id: savedExItem.id,
        sets: exSets,
        reps: exReps,
      };
      await appendRoutineExercise(newRE);
      setShowExerciseModal(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create exercise');
    } finally {
      setExerciseLoading(false);
    }
  }

  function openEditSets(re: RoutineExercise) {
    const ex = exerciseMap[re.exercise_id];
    setEditingRE({ ...re, exercise_name: ex?.name ?? 'Unknown' });
    setEditSets(String(re.sets));
    setEditReps(String(re.reps));
    setShowEditSetsModal(true);
  }

  async function saveEditSets() {
    if (!editingRE) return;
    setEditSetsLoading(true);
    try {
      await updateRoutineExercise(editingRE.routine_id, editingRE.exercise_id, editSets, editReps);
      setShowEditSetsModal(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setEditSetsLoading(false);
    }
  }

  function confirmDeleteExercise(re: RoutineExercise, routine: Routine) {
    const ex = exerciseMap[re.exercise_id];
    Alert.alert(
      'Remove Exercise',
      `Remove "${ex?.name ?? 'this exercise'}" from "${routine.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRoutineExercise(re.routine_id, re.exercise_id);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove');
            }
          },
        },
      ]
    );
  }

  // ── CSV Upload ───────────────────────────────────────────────────────────

  async function handleCSVUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'text/comma-separated-values', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file?.uri) return;

      setCsvUploading(true);
      const csvStr = await FileSystem.readAsStringAsync(file.uri);

      // Simple CSV parser
      const lines = csvStr.split(/\r?\n/).filter(l => l.trim() !== '');
      if (lines.length < 2) throw new Error('CSV is empty or missing headers');
      
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Parse rows
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const rowStr = lines[i];
        const arr: string[] = [];
        let quote = false;
        let cell = '';
        for (let c of rowStr) {
          if (c === '"' && quote) quote = false;
          else if (c === '"' && !quote) quote = true;
          else if (c === ',' && !quote) { arr.push(cell.trim()); cell = ''; }
          else cell += c;
        }
        arr.push(cell.trim());
        
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => { obj[h] = arr[idx] || ''; });
        rows.push(obj);
      }

      let routinesAdded = 0;
      let exercisesAdded = 0;
      let linksAdded = 0;

      const ts = Date.now();
      const exerciseCache = new Map<string, Exercise | null>();
      const routineCache = new Map<string, Routine | null>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const exName = row['exercise'] || row['exercise name'] || row['name'];
        const rtName = row['routine'] || row['routine name'];
        const mGroup = row['muscle group'] || row['muscle_group'] || 'Other';
        const day = row['day'] || row['day of week'] || row['day_of_week'] || 'Monday';
        const sets = row['sets'] || '3';
        const reps = row['reps'] || '10';

        if (!exName || !rtName) continue;

        const exKey = exName.toLowerCase();
        let exercise = exerciseCache.get(exKey);
        if (exercise === undefined) {
          exercise = await findExerciseByName(exName);
          if (!exercise) {
            exercise = { id: `ex_${ts}_${i}`, name: exName, muscle_group: mGroup };
            exercise = await appendExercise(exercise);
            exercisesAdded++;
          }
          exerciseCache.set(exKey, exercise);
        }
        
        if (!exercise) continue;

        const rtKey = `${rtName.toLowerCase()}::${day.toLowerCase()}`;
        let routine = routineCache.get(rtKey);
        if (routine === undefined) {
          routine = await findRoutineByNameAndDay(rtName, day);
          if (!routine) {
            routine = { id: `rt_${ts}_${i}`, name: rtName, day_of_week: day };
            routine = await appendRoutine(routine);
            routinesAdded++;
          }
          routineCache.set(rtKey, routine);
        }
        
        if (!routine) continue;

        const newRE: RoutineExercise = {
          routine_id: routine.id,
          exercise_id: exercise.id,
          sets,
          reps
        };
        await appendRoutineExercise(newRE);
        linksAdded++;
      }

      Alert.alert(
        '✅ CSV Imported',
        `Parsed ${rows.length} rows\n• ${routinesAdded} new routines\n• ${exercisesAdded} new exercises\n• ${linksAdded} new exercise links`,
        [{ text: 'OK', onPress: refresh }]
      );
    } catch (err) {
      Alert.alert('Import Failed', err instanceof Error ? err.message : 'Could not import CSV');
    } finally {
      setCsvUploading(false);
    }
  }

  // ── Toggle expand ────────────────────────────────────────────────────────

  function toggleExpand(routineId: string) {
    setExpandedRoutines((prev) => {
      const next = new Set(prev);
      if (next.has(routineId)) { next.delete(routineId); }
      else { next.add(routineId); }
      return next;
    });
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  function renderExerciseRow(re: RoutineExercise, routine: Routine) {
    const ex = exerciseMap[re.exercise_id];
    if (!ex) return null;
    const color = getMuscleColor(ex.muscle_group);

    return (
      <View key={`${re.routine_id}_${re.exercise_id}`} style={styles.exerciseRow}>
        <View style={styles.exerciseLeft}>
          <View style={[styles.musclePill, { backgroundColor: color + '22', borderColor: color + '66' }]}>
            <Text style={[styles.musclePillText, { color }]}>{ex.muscle_group}</Text>
          </View>
          <Text style={styles.exerciseName}>{ex.name}</Text>
        </View>
        <View style={styles.exerciseRight}>
          <TouchableOpacity
            style={styles.setsRepsBadge}
            onPress={() => openEditSets(re)}
            activeOpacity={0.7}
          >
            <Text style={styles.setsRepsText}>{re.sets}×{re.reps}</Text>
            <Ionicons name="pencil" size={10} color={Colors.primary} style={{ marginLeft: 3 }} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => confirmDeleteExercise(re, routine)}
            style={styles.deleteExBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={14} color={Colors.secondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderRoutineCard(routine: Routine) {
    const isExpanded = expandedRoutines.has(routine.id);
    const res = routineExercises.filter((re) => re.routine_id === routine.id);

    return (
      <View key={routine.id} style={styles.routineCard}>
        {/* Card header */}
        <TouchableOpacity
          style={styles.routineHeader}
          onPress={() => toggleExpand(routine.id)}
          activeOpacity={0.7}
        >
          <View style={styles.routineHeaderLeft}>
            <Text style={styles.routineName}>{routine.name}</Text>
            <Text style={styles.routineSubtitle}>
              {res.length} {res.length === 1 ? 'exercise' : 'exercises'}
            </Text>
          </View>
          <View style={styles.routineHeaderRight}>
            <TouchableOpacity
              onPress={() => openEditRoutine(routine)}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil-outline" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDeleteRoutine(routine)}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.secondary} />
            </TouchableOpacity>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={Colors.textMuted}
            />
          </View>
        </TouchableOpacity>

        {/* Exercise list */}
        {isExpanded && (
          <View style={styles.exerciseList}>
            {res.length === 0 ? (
              <Text style={styles.emptyExercises}>No exercises yet</Text>
            ) : (
              res.map((re) => renderExerciseRow(re, routine))
            )}
            <TouchableOpacity
              style={styles.addExerciseBtn}
              onPress={() => openAddExercise(routine.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
              <Text style={styles.addExerciseBtnText}>Add Exercise</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  function renderDaySection(day: string) {
    const dayRoutines = routinesByDay[day] ?? [];
    if (dayRoutines.length === 0) return null;

    return (
      <View key={day} style={styles.daySection}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayLabel}>{day.toUpperCase()}</Text>
          <View style={styles.dayLine} />
        </View>
        {dayRoutines.map((r, i) => React.cloneElement(renderRoutineCard(r), { key: `${r.id}_${i}` }))}
      </View>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading routines…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Page Header ── */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Workouts</Text>
        <View style={styles.headerActions}>
          {/* CSV Upload button */}
          <TouchableOpacity
            style={[styles.iconHeaderBtn, csvUploading && styles.iconHeaderBtnLoading]}
            onPress={handleCSVUpload}
            disabled={csvUploading}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            {csvUploading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="cloud-upload-outline" size={22} color={Colors.textSecondary} />
            )}
          </TouchableOpacity>

          {/* Add routine button */}
          <TouchableOpacity style={styles.addBtn} onPress={openAddRoutine} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color={Colors.background} />
            <Text style={styles.addBtnText}>Routine</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.secondary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.errorRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Routine List ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {routines.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No routines yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "+ Routine" to create your first workout,{'\n'}or upload a CSV file.
            </Text>
          </View>
        ) : (
          <>
            {DAYS.map(renderDaySection)}
            {/* Unscheduled */}
            {unscheduled.length > 0 && (
              <View style={styles.daySection}>
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayLabel, { color: Colors.textMuted }]}>UNSCHEDULED</Text>
                  <View style={[styles.dayLine, { backgroundColor: Colors.border }]} />
                </View>
                {unscheduled.map(renderRoutineCard)}
              </View>
            )}
          </>
        )}
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Add / Edit Routine
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showRoutineModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRoutineModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowRoutineModal(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {editingRoutine ? 'Edit Routine' : 'New Routine'}
            </Text>

            {/* Name input */}
            <Text style={styles.fieldLabel}>Routine Name</Text>
            <TextInput
              style={styles.textInput}
              value={routineName}
              onChangeText={setRoutineName}
              placeholder="e.g. Push Day A"
              placeholderTextColor={Colors.textMuted}
              autoFocus
              returnKeyType="done"
            />

            {/* Day picker */}
            <Text style={styles.fieldLabel}>Day of Week</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayPicker}
            >
              {DAYS.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayChip,
                    routineDay === day && styles.dayChipActive,
                  ]}
                  onPress={() => setRoutineDay(day)}
                >
                  <Text
                    style={[
                      styles.dayChipText,
                      routineDay === day && styles.dayChipTextActive,
                    ]}
                  >
                    {day.slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Save button */}
            <TouchableOpacity
              style={[styles.primaryBtn, routineLoading && { opacity: 0.6 }]}
              onPress={saveRoutine}
              disabled={routineLoading}
            >
              {routineLoading ? (
                <ActivityIndicator size="small" color={Colors.background} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {editingRoutine ? 'Save Changes' : 'Create Routine'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Add Exercise to Routine
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showExerciseModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowExerciseModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowExerciseModal(false)} />
          <View style={[styles.sheet, styles.sheetTall]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add Exercise</Text>

            {/* Sets / Reps row (common to both tabs) */}
            <View style={styles.setsRepsRow}>
              <View style={styles.setsRepsField}>
                <Text style={styles.fieldLabel}>Sets</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setExSets((v) => String(Math.max(1, parseInt(v, 10) - 1)))}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.stepperInput}
                    value={exSets}
                    onChangeText={setExSets}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setExSets((v) => String(parseInt(v, 10) + 1))}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.setsRepsField}>
                <Text style={styles.fieldLabel}>Reps</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setExReps((v) => String(Math.max(1, parseInt(v, 10) - 1)))}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.stepperInput}
                    value={exReps}
                    onChangeText={setExReps}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setExReps((v) => String(parseInt(v, 10) + 1))}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Tab switcher */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, exerciseTab === 'search' && styles.tabBtnActive]}
                onPress={() => setExerciseTab('search')}
              >
                <Text style={[styles.tabBtnText, exerciseTab === 'search' && styles.tabBtnTextActive]}>
                  Search Library
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, exerciseTab === 'create' && styles.tabBtnActive]}
                onPress={() => setExerciseTab('create')}
              >
                <Text style={[styles.tabBtnText, exerciseTab === 'create' && styles.tabBtnTextActive]}>
                  Create New
                </Text>
              </TouchableOpacity>
            </View>

            {exerciseTab === 'search' ? (
              <>
                <TextInput
                  style={[styles.textInput, { marginBottom: Spacing.sm }]}
                  value={exerciseSearch}
                  onChangeText={setExerciseSearch}
                  placeholder="Search exercises…"
                  placeholderTextColor={Colors.textMuted}
                />
                <FlatList
                  data={filteredExercises}
                  keyExtractor={(item) => item.id}
                  style={styles.exercisePickerList}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <Text style={styles.emptyExercises}>No exercises found</Text>
                  }
                  renderItem={({ item }) => {
                    const color = getMuscleColor(item.muscle_group);
                    const alreadyAdded = routineExIds.has(item.id);
                    return (
                      <TouchableOpacity
                        style={[
                          styles.exercisePickerRow,
                          alreadyAdded && styles.exercisePickerRowDisabled,
                        ]}
                        onPress={() => addExistingExercise(item)}
                        disabled={alreadyAdded || exerciseLoading}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.exerciseName, alreadyAdded && { color: Colors.textMuted }]}>
                            {item.name}
                          </Text>
                          <View style={[styles.musclePill, { backgroundColor: color + '22', borderColor: color + '66', marginTop: 2, alignSelf: 'flex-start' }]}>
                            <Text style={[styles.musclePillText, { color }]}>{item.muscle_group}</Text>
                          </View>
                        </View>
                        {alreadyAdded ? (
                          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                        ) : exerciseLoading ? (
                          <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Exercise Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={newExName}
                  onChangeText={setNewExName}
                  placeholder="e.g. Barbell Squat"
                  placeholderTextColor={Colors.textMuted}
                />

                <Text style={styles.fieldLabel}>Muscle Group</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.musclePickerRow}
                >
                  {MUSCLE_GROUPS.map((mg) => {
                    const color = getMuscleColor(mg);
                    const isActive = newExMuscle === mg;
                    return (
                      <TouchableOpacity
                        key={mg}
                        style={[
                          styles.muscleChip,
                          {
                            backgroundColor: isActive ? color + '33' : Colors.surface,
                            borderColor: isActive ? color : Colors.border,
                          },
                        ]}
                        onPress={() => setNewExMuscle(mg)}
                      >
                        <Text style={[styles.muscleChipText, { color: isActive ? color : Colors.textSecondary }]}>
                          {mg}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: Spacing.md }, exerciseLoading && { opacity: 0.6 }]}
                  onPress={createAndAddExercise}
                  disabled={exerciseLoading}
                >
                  {exerciseLoading ? (
                    <ActivityIndicator size="small" color={Colors.background} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Create & Add</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Edit Sets / Reps
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showEditSetsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditSetsModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowEditSetsModal(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Edit Sets & Reps</Text>
            {editingRE && (
              <Text style={styles.sheetSubtitle}>{editingRE.exercise_name}</Text>
            )}

            <View style={styles.setsRepsRow}>
              <View style={styles.setsRepsField}>
                <Text style={styles.fieldLabel}>Sets</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setEditSets((v) => String(Math.max(1, parseInt(v, 10) - 1)))}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.stepperInput}
                    value={editSets}
                    onChangeText={setEditSets}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setEditSets((v) => String(parseInt(v, 10) + 1))}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.setsRepsField}>
                <Text style={styles.fieldLabel}>Reps</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setEditReps((v) => String(Math.max(1, parseInt(v, 10) - 1)))}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.stepperInput}
                    value={editReps}
                    onChangeText={setEditReps}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setEditReps((v) => String(parseInt(v, 10) + 1))}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, editSetsLoading && { opacity: 0.6 }]}
              onPress={saveEditSets}
              disabled={editSetsLoading}
            >
              {editSetsLoading ? (
                <ActivityIndicator size="small" color={Colors.background} />
              ) : (
                <Text style={styles.primaryBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
  },

  // ── Header ──
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  pageTitle: {
    fontSize: Typography.xxl,
    color: Colors.text,
    fontWeight: Typography.black,
    letterSpacing: Typography.tight,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHeaderBtnLoading: { opacity: 0.7 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  addBtnText: {
    color: Colors.background,
    fontWeight: Typography.bold,
    fontSize: Typography.sm,
  },

  // ── Error banner ──
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.secondary + '22',
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.secondary + '44',
  },
  errorText: { flex: 1, color: Colors.secondary, fontSize: Typography.sm },
  errorRetry: {
    color: Colors.primary,
    fontWeight: Typography.bold,
    fontSize: Typography.sm,
  },

  // ── Scroll ──
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.xs },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.lg,
    color: Colors.textSecondary,
    fontWeight: Typography.semibold,
  },
  emptySubtitle: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Day section ──
  daySection: { marginBottom: Spacing.lg },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  dayLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.black,
    color: Colors.primary,
    letterSpacing: Typography.wider,
  },
  dayLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.primary + '33',
  },

  // ── Routine card ──
  routineCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  routineHeaderLeft: { flex: 1 },
  routineName: {
    fontSize: Typography.md,
    color: Colors.text,
    fontWeight: Typography.semibold,
  },
  routineSubtitle: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  routineHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBtn: {
    padding: 4,
  },

  // ── Exercise rows ──
  exerciseList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    paddingTop: 4,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '66',
  },
  exerciseLeft: { flex: 1, gap: 4 },
  exerciseName: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: Typography.medium,
  },
  musclePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  musclePillText: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    letterSpacing: 0.2,
  },
  exerciseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  setsRepsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '22',
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
  },
  setsRepsText: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.primary,
  },
  deleteExBtn: { padding: 4 },

  emptyExercises: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    paddingVertical: Spacing.sm,
    textAlign: 'center',
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    alignSelf: 'center',
  },
  addExerciseBtnText: {
    color: Colors.primary,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },

  // ── Modals / Sheets ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: Colors.surfaceAlt,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  sheetTall: { maxHeight: '85%' },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: Radii.full,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: Typography.xl,
    color: Colors.text,
    fontWeight: Typography.bold,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },

  // Fields
  fieldLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.semibold,
    letterSpacing: Typography.wide,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: Typography.md,
    padding: Spacing.md,
  },

  // Day picker
  dayPicker: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  dayChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayChipText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  dayChipTextActive: {
    color: Colors.background,
    fontWeight: Typography.bold,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: 3,
    marginVertical: Spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    borderRadius: Radii.sm,
  },
  tabBtnActive: { backgroundColor: Colors.surfaceAlt },
  tabBtnText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    fontWeight: Typography.medium,
  },
  tabBtnTextActive: {
    color: Colors.text,
    fontWeight: Typography.semibold,
  },

  // Exercise picker list
  exercisePickerList: { flex: 1, marginBottom: Spacing.sm },
  exercisePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '55',
  },
  exercisePickerRowDisabled: { opacity: 0.5 },

  // Muscle chips
  musclePickerRow: { gap: Spacing.xs, paddingVertical: Spacing.xs },
  muscleChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  muscleChipText: { fontSize: Typography.xs, fontWeight: Typography.semibold },

  // Steppers
  setsRepsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  setsRepsField: { flex: 1 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
  },
  stepperBtnText: {
    color: Colors.primary,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  stepperInput: {
    flex: 1,
    textAlign: 'center',
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    paddingVertical: Spacing.sm,
  },

  // Primary button
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  primaryBtnText: {
    color: Colors.background,
    fontWeight: Typography.bold,
    fontSize: Typography.md,
  },
});
