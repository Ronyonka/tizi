/**
 * Firestore REST Service
 *
 * Final stable solution for Expo API Routes.
 * Uses the Firestore REST API via standard `fetch`, bypassing 
 * transport-level hangs (GRPC/WebSocket) encountered in both 
 * the JS Web SDK and the Firebase Admin SDK.
 */

const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ─── Interfaces ────────────────────────────────────────────────────────────

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
}

export interface Routine {
  id: string;
  name: string;
  day_of_week: string;
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
  sets: string;
  reps: string;
  weight_kg: number;
}

// ─── HELPER — Formatting ──────────────────────────────────────────────────

/**
 * Simplifies Firestore's verbose JSON format into a flat object.
 * e.g. { fields: { name: { stringValue: "Foo" } } } -> { name: "Foo" }
 */
function unwrap(fields: any = {}): any {
  const obj: any = {};
  for (const key in fields) {
    const valObj = fields[key];
    if ('stringValue' in valObj) obj[key] = valObj.stringValue;
    else if ('integerValue' in valObj) obj[key] = valObj.integerValue;
    else if ('doubleValue' in valObj) obj[key] = valObj.doubleValue;
    else if ('booleanValue' in valObj) obj[key] = valObj.booleanValue;
    else if ('timestampValue' in valObj) obj[key] = valObj.timestampValue;
    else if ('nullValue' in valObj) obj[key] = null;
  }
  return obj;
}

/**
 * Wraps a flat object into Firestore's verbose JSON format.
 */
function wrap(obj: any): any {
  const fields: any = {};
  for (const key in obj) {
    const val = obj[key];
    if (typeof val === 'string') fields[key] = { stringValue: val };
    else if (typeof val === 'number') {
      if (Number.isInteger(val)) fields[key] = { integerValue: String(val) };
      else fields[key] = { doubleValue: val };
    }
    else if (typeof val === 'boolean') fields[key] = { booleanValue: val };
    else if (val === null) fields[key] = { nullValue: "NULL_VALUE" };
  }
  return { fields };
}

// ─── CORE ──────────────────────────────────────────────────────────────────

async function restGet(collection: string, queryParams: string = ''): Promise<any[]> {
  const url = `${BASE_URL}/${collection}?key=${API_KEY}${queryParams}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`REST GET failed: ${res.statusText}`);
  const data = await res.json();
  if (!data.documents) return [];
  return data.documents.map((d: any) => ({
    ...unwrap(d.fields),
    id: d.name.split('/').pop(),
  }));
}

async function restSet(collection: string, id: string, data: any): Promise<void> {
  const url = `${BASE_URL}/${collection}/${id}?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'PATCH', // Update/Create document
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wrap(data)),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`REST SET failed: ${JSON.stringify(err)}`);
  }
}

async function restDelete(collection: string, id: string): Promise<void> {
  const url = `${BASE_URL}/${collection}/${id}?key=${API_KEY}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`REST DELETE failed: ${res.statusText}`);
}

// ─── READ ──────────────────────────────────────────────────────────────────

export async function getExercises(): Promise<Exercise[]> {
  return restGet('exercises') as Promise<Exercise[]>;
}

export async function getRoutines(): Promise<Routine[]> {
  return restGet('routines') as Promise<Routine[]>;
}

export async function getRoutineExercises(): Promise<RoutineExercise[]> {
  return restGet('routine_exercises') as Promise<RoutineExercise[]>;
}

export async function getLogs(): Promise<Log[]> {
  const logs = await restGet('logs');
  return logs.map(l => ({ ...l, weight_kg: Number(l.weight_kg) })) as Log[];
}

// ─── LOOKUP ───────────────────────────────────────────────────────────────

export async function findExerciseByName(name: string): Promise<Exercise | null> {
  const exercises = await getExercises();
  return exercises.find(e => e.name.toLowerCase() === name.toLowerCase()) || null;
}

export async function findRoutineByNameAndDay(name: string, day: string): Promise<Routine | null> {
  const routines = await getRoutines();
  return routines.find(r => 
    r.name.toLowerCase() === name.toLowerCase() && 
    r.day_of_week.toLowerCase() === day.toLowerCase()
  ) || null;
}

export async function getRoutineExercise(routineId: string, exercise_id: string): Promise<RoutineExercise | null> {
  const re = await getRoutineExercises();
  return re.find(r => r.routine_id === routineId && r.exercise_id === exercise_id) || null;
}

// ─── WRITE ─────────────────────────────────────────────────────────────────

export async function appendExercise(exercise: Exercise): Promise<void> {
  const id = exercise.id || `ex_${Date.now()}`;
  await restSet('exercises', id, { ...exercise, id, name_lowercase: exercise.name.toLowerCase() });
}

export async function appendRoutine(routine: Routine): Promise<void> {
  const id = routine.id || `routine_${Date.now()}`;
  await restSet('routines', id, { 
    ...routine, 
    id, 
    name_lowercase: routine.name.toLowerCase(), 
    day_of_week_lowercase: routine.day_of_week.toLowerCase() 
  });
}

export async function updateRoutine(id: string, fields: Partial<Routine>): Promise<void> {
  await restSet('routines', id, fields);
}

export async function deleteRoutine(id: string): Promise<void> {
  await restDelete('routines', id);
}

export async function appendRoutineExercise(re: RoutineExercise): Promise<void> {
  const id = `${re.routine_id}_${re.exercise_id}`;
  await restSet('routine_exercises', id, re);
}

export async function updateRoutineExercise(
  routineId: string,
  exerciseId: string,
  sets: string,
  reps: string
): Promise<void> {
  const id = `${routineId}_${exerciseId}`;
  await restSet('routine_exercises', id, { routine_id: routineId, exercise_id: exerciseId, sets, reps });
}

export async function deleteRoutineExercise(routineId: string, exerciseId: string): Promise<void> {
  const id = `${routineId}_${exerciseId}`;
  await restDelete('routine_exercises', id);
}

export async function deleteAllRoutineExercisesForRoutine(routineId: string): Promise<void> {
  const all = await getRoutineExercises();
  const toDelete = all.filter(re => re.routine_id === routineId);
  for (const re of toDelete) {
    await deleteRoutineExercise(re.routine_id, re.exercise_id);
  }
}

export async function deleteLog(id: string): Promise<void> {
  await restDelete('logs', id);
}

export async function appendLog(log: Omit<Log, 'id'> & { id?: string }): Promise<void> {
  const id = log.id || `log_${Date.now()}`;
  await restSet('logs', id, { ...log, id });
}

export async function batchAppendLogs(logs: (Omit<Log, 'id'> & { id?: string })[]): Promise<void> {
  // REST API doesn't support easy batching without transaction logic, 
  // so we sequential for now as simple fix.
  for (const log of logs) {
    await appendLog(log);
  }
}

// ─── UTILITY ───────────────────────────────────────────────────────────────

export async function testConnection(): Promise<void> {
  const exercises = await getExercises();
  console.log('[Firestore REST] ✅ Connection successful, found', exercises.length, 'exercises');
}
