/**
 * Expo API Route: POST /api/csv-upload
 *
 * Accepts a CSV with columns:
 *   routine_name, day_of_week, exercise_name, muscle_group, sets, reps
 *
 * Parses the CSV, deduplicates against existing data, and writes new rows
 * to the Exercises, Routines, and Routine_Exercises tabs.
 */

import { SHEET_NAMES } from '@/config/googleSheets';
import {
    batchAppendRows,
    getExercises,
    getRoutineExercises,
    getRoutines,
} from '@/services/googleSheets';

interface CsvRow {
  routine_name: string;
  day_of_week: string;
  exercise_name: string;
  muscle_group: string;
  sets: number;
  reps: number;
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
      sets: Number(cells[idx.sets] ?? 3),
      reps: Number(cells[idx.reps] ?? 10),
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

    // Fetch existing data to deduplicate
    const [existingExercises, existingRoutines, existingRoutineExercises] = await Promise.all([
      getExercises(),
      getRoutines(),
      getRoutineExercises(),
    ]);

    // Build lookup maps (by normalised name)
    const exerciseMap = new Map(existingExercises.map((e) => [e.name.toLowerCase(), e]));
    const routineMap = new Map(
      existingRoutines.map((r) => [`${r.name.toLowerCase()}::${r.day_of_week.toLowerCase()}`, r])
    );
    const reSet = new Set(
      existingRoutineExercises.map((re) => `${re.routine_id}::${re.exercise_id}`)
    );

    const newExerciseRows: (string | number)[][] = [];
    const newRoutineRows: (string | number)[][] = [];
    const newReRows: (string | number)[][] = [];

    const ts = Date.now();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const exKey = row.exercise_name.toLowerCase();
      const rtKey = `${row.routine_name.toLowerCase()}::${row.day_of_week.toLowerCase()}`;

      // Upsert Exercise
      if (!exerciseMap.has(exKey)) {
        const id = `ex_${ts}_${i}`;
        const ex = { id, name: row.exercise_name, muscle_group: row.muscle_group };
        exerciseMap.set(exKey, ex);
        newExerciseRows.push([id, row.exercise_name, row.muscle_group]);
      }

      // Upsert Routine
      if (!routineMap.has(rtKey)) {
        const id = `routine_${ts}_${i}`;
        const rt = { id, name: row.routine_name, day_of_week: row.day_of_week };
        routineMap.set(rtKey, rt);
        newRoutineRows.push([id, row.routine_name, row.day_of_week]);
      }

      // Upsert Routine_Exercise
      const exerciseId = exerciseMap.get(exKey)!.id;
      const routineId = routineMap.get(rtKey)!.id;
      const reKey = `${routineId}::${exerciseId}`;

      if (!reSet.has(reKey)) {
        reSet.add(reKey);
        newReRows.push([routineId, exerciseId, row.sets, row.reps]);
      }
    }

    // Write all new rows in batch
    await Promise.all([
      newExerciseRows.length > 0
        ? batchAppendRows(SHEET_NAMES.EXERCISES, newExerciseRows)
        : Promise.resolve(),
      newRoutineRows.length > 0
        ? batchAppendRows(SHEET_NAMES.ROUTINES, newRoutineRows)
        : Promise.resolve(),
      newReRows.length > 0
        ? batchAppendRows(SHEET_NAMES.ROUTINE_EXERCISES, newReRows)
        : Promise.resolve(),
    ]);

    return Response.json({
      success: true,
      summary: {
        rows_parsed: rows.length,
        exercises_added: newExerciseRows.length,
        routines_added: newRoutineRows.length,
        routine_exercises_added: newReRows.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
