/**
 * Firestore Service
 *
 * Drop-in replacement for services/googleSheets.ts.
 * Every function has the same name, signature, and return shape —
 * the only difference is that data is stored in Firestore instead of
 * a Google Spreadsheet.
 *
 * Collection layout:
 *   exercises         → { id, name, muscle_group }
 *   routines          → { id, name, day_of_week }
 *   routine_exercises → { routine_id, exercise_id, sets, reps }
 *                       document ID: `${routineId}_${exerciseId}`
 *   logs              → { id, date, routine_id, exercise_id, sets, reps, weight_kg }
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';

import { COLLECTIONS } from '@/config/firebase';
import { db } from '@/services/firebase';

// Re-export for use by screen components that need realtime listeners
export { collection, COLLECTIONS, db, onSnapshot, query, where };

console.log('[Firestore] Initialized with Project ID:', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID);

// ─── TypeScript interfaces (identical to googleSheets.ts) ──────────────────

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  name_lowercase?: string; // For case-insensitive lookup
}

export interface Routine {
  id: string;
  name: string;
  day_of_week: string;
  name_lowercase?: string;        // For case-insensitive lookup
  day_of_week_lowercase?: string; // For case-insensitive lookup
}

export interface RoutineExercise {
  routine_id: string;
  exercise_id: string;
  sets: string;
  reps: string;
}

export interface Log {
  id: string;
  date: string;
  routine_id: string;
  exercise_id: string;
  sets: number;   // total sets performed in this session
  reps: string;   // reps per set (supports ranges like "8-12")
  weight_kg: number;
}

// ─── READ ──────────────────────────────────────────────────────────────────

export async function getExercises(): Promise<Exercise[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.exercises));
  return snap.docs.map((d) => d.data() as Exercise);
}

export async function getRoutines(): Promise<Routine[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.routines));
  return snap.docs.map((d) => d.data() as Routine);
}

export async function getRoutineExercises(): Promise<RoutineExercise[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.routineExercises));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      routine_id: String(data.routine_id),
      exercise_id: String(data.exercise_id),
      sets: String(data.sets),
      reps: String(data.reps),
    };
  });
}

export async function getLogs(): Promise<Log[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.logs));
  return snap.docs.map((d) => {
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
}

// ─── LOOKUP ───────────────────────────────────────────────────────────────

export async function findExerciseByName(name: string): Promise<Exercise | null> {
  const q = query(
    collection(db, COLLECTIONS.exercises),
    where('name_lowercase', '==', name.toLowerCase()),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as Exercise;
}

export async function findRoutineByNameAndDay(name: string, day: string): Promise<Routine | null> {
  const q = query(
    collection(db, COLLECTIONS.routines),
    where('name_lowercase', '==', name.toLowerCase()),
    where('day_of_week_lowercase', '==', day.toLowerCase()),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as Routine;
}

export async function getRoutineExercise(routineId: string, exercise_id: string): Promise<RoutineExercise | null> {
  try {
    const q = query(
      collection(db, COLLECTIONS.routineExercises),
      where('routine_id', '==', routineId),
      where('exercise_id', '==', exercise_id),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as RoutineExercise;
  } catch (error) {
    console.error(`[Firestore] getRoutineExercise error:`, error);
    throw error;
  }
}

// ─── WRITE — Exercises ─────────────────────────────────────────────────────

export async function appendExercise(exercise: Exercise): Promise<Exercise> {
  const existing = await findExerciseByName(exercise.name);
  if (existing) {
    console.log(`[Firestore] Exercise '${exercise.name}' already exists, returning existing.`);
    return existing;
  }

  const id = exercise.id || `ex_${Date.now()}`;
  const data = {
    ...exercise,
    id,
    name_lowercase: exercise.name.toLowerCase(),
  };
  console.log(`[Firestore] Attempting to write exercise: ${id}`);
  try {
    await setDoc(doc(db, COLLECTIONS.exercises, id), data);
    console.log(`[Firestore] ✅ Successfully wrote exercise: ${id}`);
    return data;
  } catch (error: any) {
    console.error(`[Firestore] ❌ Failed to write exercise: ${id}`, error.message);
    throw error;
  }
}

// ─── WRITE — Routines ──────────────────────────────────────────────────────

export async function appendRoutine(routine: Routine): Promise<Routine> {
  const existing = await findRoutineByNameAndDay(routine.name, routine.day_of_week);
  if (existing) {
    console.log(`[Firestore] Routine '${routine.name}' on '${routine.day_of_week}' already exists, returning existing.`);
    return existing;
  }

  const id = routine.id || `routine_${Date.now()}`;
  const data = {
    ...routine,
    id,
    name_lowercase: routine.name.toLowerCase(),
    day_of_week_lowercase: routine.day_of_week.toLowerCase(),
  };
  await setDoc(doc(db, COLLECTIONS.routines, id), data);
  return data;
}

export async function updateRoutine(
  id: string,
  fields: Partial<Pick<Routine, 'name' | 'day_of_week'>>
): Promise<void> {
  const ref = doc(db, COLLECTIONS.routines, id);
  await updateDoc(ref, fields as Record<string, unknown>);
}

export async function deleteRoutine(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.routines, id));
}

/**
 * Deletes all routine_exercises documents that belong to the given routine.
 * Used when deleting a routine so orphaned links are cleaned up.
 */
export async function deleteAllRoutineExercisesForRoutine(routineId: string): Promise<void> {
  const q = query(
    collection(db, COLLECTIONS.routineExercises),
    where('routine_id', '==', routineId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  // Use chunks to respect the 500-write limit for batches
  const CHUNK = 500;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * Identifies and deletes duplicate routines (same name and day).
 * Deletes associated routine_exercises when a routine is deleted.
 * Returns the number of duplicates removed.
 */
export async function removeDuplicateRoutines(): Promise<number> {
  const routines = await getRoutines();
  const seenKeys = new Set<string>();
  const duplicateIds: string[] = [];

  for (const routine of routines) {
    const key = `${routine.name.toLowerCase()}::${routine.day_of_week.toLowerCase()}`;
    if (seenKeys.has(key)) {
      duplicateIds.push(routine.id);
    } else {
      seenKeys.add(key);
    }
  }

  if (duplicateIds.length === 0) return 0;

  console.log(`[Firestore] Found ${duplicateIds.length} duplicate routines. Removing...`);

  // Delete duplicate routines and their associated routine_exercises
  for (const id of duplicateIds) {
    await deleteRoutine(id);
    await deleteAllRoutineExercisesForRoutine(id);
  }

  return duplicateIds.length;
}

// ─── WRITE — Routine Exercises ─────────────────────────────────────────────

export async function appendRoutineExercise(re: RoutineExercise): Promise<void> {
  const docId = `${re.routine_id}_${re.exercise_id}`;
  await setDoc(doc(db, COLLECTIONS.routineExercises, docId), re);
}

export async function updateRoutineExercise(
  routineId: string,
  exerciseId: string,
  sets: string,
  reps: string
): Promise<void> {
  const docId = `${routineId}_${exerciseId}`;
  await updateDoc(doc(db, COLLECTIONS.routineExercises, docId), { sets, reps });
}

export async function deleteRoutineExercise(
  routineId: string,
  exerciseId: string
): Promise<void> {
  const docId = `${routineId}_${exerciseId}`;
  await deleteDoc(doc(db, COLLECTIONS.routineExercises, docId));
}

// ─── WRITE — Logs ──────────────────────────────────────────────────────────

export async function appendLog(
  log: Omit<Log, 'id'> & { id?: string }
): Promise<void> {
  const id = log.id ?? `log_${Date.now()}`;
  await setDoc(doc(db, COLLECTIONS.logs, id), { ...log, id });
}

export async function batchAppendLogs(
  logs: (Omit<Log, 'id'> & { id?: string })[]
): Promise<void> {
  if (logs.length === 0) return;

  // Use deterministic IDs: date_routineId_exerciseId
  // This ensures saving the same exercise on the same day upserts (overwrites)
  // the existing document rather than creating duplicates.
  const deriveId = (log: Omit<Log, 'id'> & { id?: string }): string => {
    if (log.id) return log.id;
    const dateStr = log.date.substring(0, 10); // YYYY-MM-DD
    return `${dateStr}_${log.routine_id}_${log.exercise_id}`;
  };

  // Firestore batches are capped at 500 writes — chunk if needed
  const CHUNK = 500;
  for (let i = 0; i < logs.length; i += CHUNK) {
    const batch = writeBatch(db);
    logs.slice(i, i + CHUNK).forEach((log) => {
      const id = deriveId(log);
      batch.set(doc(db, COLLECTIONS.logs, id), { ...log, id });
    });
    await batch.commit();
  }
}

export async function deleteLog(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.logs, id));
}

export async function updateLog(
  id: string,
  fields: Partial<Pick<Log, 'sets' | 'reps' | 'weight_kg'>>
): Promise<void> {
  const ref = doc(db, COLLECTIONS.logs, id);
  await updateDoc(ref, fields as Record<string, unknown>);
}

// ─── UTILITY ───────────────────────────────────────────────────────────────

/**
 * Attempts to read one document from the exercises collection.
 * Returns { ok: true } on success or { ok: false, error } on failure.
 * Mirrors the intent of the Google Sheets testConnection().
 */
export async function testConnection(): Promise<void> {
  try {
    const q = query(collection(db, COLLECTIONS.exercises), limit(1));
    await getDocs(q);
    console.log('[Firestore] ✅ Connection successful');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Firestore] ❌ Connection failed: ${message}`);
    throw error;
  }
}
