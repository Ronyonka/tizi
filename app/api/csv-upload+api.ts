/**
 * Expo API Route: POST /api/csv-upload
 *
 * Accepts a CSV with columns:
 *   routine_name, day_of_week, exercise_name, muscle_group, sets, reps
 *
 * Parses the CSV, deduplicates against existing data, and writes new rows
 * to the exercises, routines, and routine_exercises Firestore collections.
 */


import {
    findExerciseByName,
    findRoutineByNameAndDay,
    getRoutineExercise,
} from '@/services/firestore-rest';

interface CsvRow {
  routine_name: string;
  day_of_week: string;
  exercise_name: string;
  muscle_group: string;
  sets: string;
  reps: string;
}

function parseCSV(raw: string): CsvRow[] {
  const lines = raw.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  const idx = {
    routine_name: headers.indexOf('routine_name'),
    day_of_week: headers.indexOf('day_of_week'),
    exercise_name: headers.indexOf('exercise_name'),
    muscle_group: headers.indexOf('muscle_group'),
    sets: headers.indexOf('sets'),
    reps: headers.indexOf('reps'),
  };

  return lines.slice(1).map((line) => {
    // Handle quoted CSV fields
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { cells.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    cells.push(current.trim());

    return {
      routine_name: cells[idx.routine_name] ?? '',
      day_of_week: cells[idx.day_of_week] ?? '',
      exercise_name: cells[idx.exercise_name] ?? '',
      muscle_group: cells[idx.muscle_group] ?? '',
      sets: cells[idx.sets] ?? '3',
      reps: cells[idx.reps] ?? '10',
    };
  }).filter((r) => r.routine_name && r.exercise_name);
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    let csvText = '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      csvText = body.csv as string;
    } else {
      csvText = await request.text();
    }

    if (!csvText) {
      return Response.json({ error: 'No CSV content provided' }, { status: 400 });
    }

    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return Response.json({ error: 'No valid rows found in CSV' }, { status: 400 });
    }

    // Local caches for the duration of this request to minimize Firestore queries
    const exerciseCache = new Map<string, { id: string; name: string; muscle_group: string }>();
    const routineCache = new Map<string, { id: string; name: string; day_of_week: string }>();
    const reSet = new Set<string>();

    const newExercises: { id: string; name: string; muscle_group: string }[] = [];
    const newRoutines: { id: string; name: string; day_of_week: string }[] = [];
    const newRoutineExercises: { routine_id: string; exercise_id: string; sets: string; reps: string }[] = [];

    const ts = Date.now();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      console.log(`[CSV] Processing row ${i + 1}/${rows.length}: ${row.exercise_name} in ${row.routine_name}`);
      const exKey = row.exercise_name.toLowerCase();
      const rtKey = `${row.routine_name.toLowerCase()}::${row.day_of_week.toLowerCase()}`;

      // 1. Resolve Exercise
      let exercise = exerciseCache.get(exKey);
      if (!exercise) {
        console.log(`[CSV] Finding exercise: ${row.exercise_name}`);
        const existing = await findExerciseByName(row.exercise_name);
        if (existing) {
          console.log(`[CSV] Found existing exercise: ${existing.id}`);
          exercise = existing;
        } else {
          console.log(`[CSV] Creating new exercise: ${row.exercise_name}`);
          const id = `ex_${ts}_${i}`;
          exercise = { id, name: row.exercise_name, muscle_group: row.muscle_group };
          newExercises.push(exercise);
        }
        exerciseCache.set(exKey, exercise);
      }

      // 2. Resolve Routine
      let routine = routineCache.get(rtKey);
      if (!routine) {
        console.log(`[CSV] Finding routine: ${row.routine_name} on ${row.day_of_week}`);
        const existing = await findRoutineByNameAndDay(row.routine_name, row.day_of_week);
        if (existing) {
          console.log(`[CSV] Found existing routine: ${existing.id}`);
          routine = existing;
        } else {
          console.log(`[CSV] Creating new routine: ${row.routine_name}`);
          const id = `routine_${ts}_${i}`;
          routine = { id, name: row.routine_name, day_of_week: row.day_of_week };
          newRoutines.push(routine);
        }
        routineCache.set(rtKey, routine);
      }

      // 3. Resolve Routine_Exercise link
      const exerciseId = exercise!.id;
      const routineId = routine!.id;
      const reKey = `${routineId}::${exerciseId}`;

      if (!reSet.has(reKey)) {
        console.log(`[CSV] Finding link: ${routineId} <-> ${exerciseId}`);
        const existingIdx = await getRoutineExercise(routineId, exerciseId);
        if (!existingIdx) {
          console.log(`[CSV] Creating new link`);
          newRoutineExercises.push({
            routine_id: routineId,
            exercise_id: exerciseId,
            sets: row.sets,
            reps: row.reps,
          });
        } else {
          console.log(`[CSV] Link exists`);
        }
        reSet.add(reKey);
      }
    }
    console.log(`[CSV] Deduplication complete. Writing ${newExercises.length} ex, ${newRoutines.length} rt, ${newRoutineExercises.length} links.`);

    // Write all new documents to Firestore using the stable REST service
    const { 
      appendExercise, 
      appendRoutine, 
      appendRoutineExercise 
    } = await import('@/services/firestore-rest');

    for (const ex of newExercises) {
      await appendExercise(ex);
    }

    for (const rt of newRoutines) {
      await appendRoutine(rt);
    }

    for (const re of newRoutineExercises) {
      await appendRoutineExercise(re);
    }

    return Response.json({
      success: true,
      summary: {
        rows_parsed: rows.length,
        exercises_added: newExercises.length,
        routines_added: newRoutines.length,
        routine_exercises_added: newRoutineExercises.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[CSV] Error during upload:`, error);
    return Response.json({ error: message }, { status: 500 });
  }
}
