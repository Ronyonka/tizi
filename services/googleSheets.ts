/**
 * Google Sheets Service
 *
 * Provides typed read/write access to the workout spreadsheet.
 * Uses the googleapis Node.js SDK via service account authentication.
 *
 * ⚠️  This module must only be imported in server-side contexts
 *     (Expo API routes, scripts, etc.) — never in React Native components.
 */

import { getConfig, SHEET_NAMES, SheetName } from '@/config/googleSheets';
import { google } from 'googleapis';

// ─── TypeScript interfaces ─────────────────────────────────────────────────

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
  sets: number;
  reps: number;
}

export interface Log {
  id: string;
  date: string;
  routine_id: string;
  exercise_id: string;
  sets: number;
  reps: number;
  weight_kg: number;
}

// ─── Auth & client ─────────────────────────────────────────────────────────

/**
 * Builds an authenticated Google Sheets API client using the service account.
 */
export function getSheetClient() {
  const { credentials } = getConfig();

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

// ─── Generic helpers ───────────────────────────────────────────────────────

/**
 * Reads all rows from a named sheet tab.
 * Returns rows starting from row 2 (header skipped).
 */
export async function readSheet(tab: SheetName, range?: string): Promise<string[][]> {
  const { spreadsheetId } = getConfig();
  const sheets = getSheetClient();

  const fullRange = range ? `${tab}!${range}` : `${tab}!A2:Z`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: fullRange,
  });

  return (response.data.values as string[][] | null | undefined) ?? [];
}

/**
 * Appends a single row to a named sheet tab.
 */
export async function appendRow(tab: SheetName, values: (string | number)[]): Promise<void> {
  const { spreadsheetId } = getConfig();
  const sheets = getSheetClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [values],
    },
  });
}

/**
 * Appends multiple rows to a named sheet tab in a single API call.
 */
export async function batchAppendRows(
  tab: SheetName,
  rows: (string | number)[][]
): Promise<void> {
  if (rows.length === 0) return;
  const { spreadsheetId } = getConfig();
  const sheets = getSheetClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: rows,
    },
  });
}

/**
 * Gets the sheet metadata needed for batchUpdate operations (row deletion).
 * Returns the sheetId (numeric) for a given tab name.
 */
async function getSheetId(tab: SheetName): Promise<number> {
  const { spreadsheetId } = getConfig();
  const sheets = getSheetClient();

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });

  const sheet = response.data.sheets?.find(
    (s) => s.properties?.title === tab
  );

  if (sheet?.properties?.sheetId == null) {
    throw new Error(`[GoogleSheets] Tab "${tab}" not found in spreadsheet`);
  }

  return sheet?.properties?.sheetId ?? 0;
}

/**
 * Finds the 1-indexed row number (including header) of a row where column A matches `id`.
 * Returns -1 if not found.
 */
async function findRowIndexById(tab: SheetName, id: string): Promise<number> {
  const rows = await readSheet(tab); // starts at row 2
  const rowIndex = rows.findIndex((r) => r[0] === id);
  if (rowIndex === -1) return -1;
  return rowIndex + 2; // +1 for 0-index, +1 for header
}

/**
 * Updates the values of a specific row (1-indexed) in a tab.
 */
async function updateRow(
  tab: SheetName,
  rowIndex: number,
  values: (string | number)[]
): Promise<void> {
  const { spreadsheetId } = getConfig();
  const sheets = getSheetClient();

  const colEnd = String.fromCharCode(65 + values.length - 1); // A, B, C...
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A${rowIndex}:${colEnd}${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values],
    },
  });
}

/**
 * Deletes a specific row (1-indexed) from a tab using batchUpdate.
 */
async function deleteRow(tab: SheetName, rowIndex: number): Promise<void> {
  const { spreadsheetId } = getConfig();
  const sheets = getSheetClient();
  const sheetId = await getSheetId(tab);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // 0-indexed
              endIndex: rowIndex,       // exclusive
            },
          },
        },
      ],
    },
  });
}

// ─── Typed data-access: READ ───────────────────────────────────────────────

export async function getExercises(): Promise<Exercise[]> {
  const rows = await readSheet(SHEET_NAMES.EXERCISES);
  return rows.map(([id, name, muscle_group]) => ({ id, name, muscle_group }));
}

export async function getRoutines(): Promise<Routine[]> {
  const rows = await readSheet(SHEET_NAMES.ROUTINES);
  return rows.map(([id, name, day_of_week]) => ({ id, name, day_of_week }));
}

export async function getRoutineExercises(): Promise<RoutineExercise[]> {
  const rows = await readSheet(SHEET_NAMES.ROUTINE_EXERCISES);
  return rows.map(([routine_id, exercise_id, sets, reps]) => ({
    routine_id,
    exercise_id,
    sets: Number(sets),
    reps: Number(reps),
  }));
}

export async function getLogs(): Promise<Log[]> {
  const rows = await readSheet(SHEET_NAMES.LOGS);
  return rows.map(([id, date, routine_id, exercise_id, sets, reps, weight_kg]) => ({
    id,
    date,
    routine_id,
    exercise_id,
    sets: Number(sets),
    reps: Number(reps),
    weight_kg: Number(weight_kg),
  }));
}

// ─── Typed data-access: WRITE (Exercises) ─────────────────────────────────

export async function appendExercise(exercise: Exercise): Promise<void> {
  await appendRow(SHEET_NAMES.EXERCISES, [
    exercise.id,
    exercise.name,
    exercise.muscle_group,
  ]);
}

// ─── Typed data-access: WRITE (Routines) ──────────────────────────────────

export async function appendRoutine(routine: Routine): Promise<void> {
  await appendRow(SHEET_NAMES.ROUTINES, [
    routine.id,
    routine.name,
    routine.day_of_week,
  ]);
}

export async function updateRoutine(
  id: string,
  fields: Partial<Pick<Routine, 'name' | 'day_of_week'>>
): Promise<void> {
  const rowIndex = await findRowIndexById(SHEET_NAMES.ROUTINES, id);
  if (rowIndex === -1) throw new Error(`Routine "${id}" not found`);

  // Read existing row to preserve unchanged fields
  const rows = await readSheet(SHEET_NAMES.ROUTINES);
  const existing = rows.find((r) => r[0] === id);
  if (!existing) throw new Error(`Routine "${id}" not found`);

  const [existingId, existingName, existingDay] = existing;
  await updateRow(SHEET_NAMES.ROUTINES, rowIndex, [
    existingId,
    fields.name ?? existingName,
    fields.day_of_week ?? existingDay,
  ]);
}

export async function deleteRoutine(id: string): Promise<void> {
  const rowIndex = await findRowIndexById(SHEET_NAMES.ROUTINES, id);
  if (rowIndex === -1) throw new Error(`Routine "${id}" not found`);
  await deleteRow(SHEET_NAMES.ROUTINES, rowIndex);
}

// ─── Typed data-access: WRITE (Routine_Exercises) ─────────────────────────

export async function appendRoutineExercise(re: RoutineExercise): Promise<void> {
  await appendRow(SHEET_NAMES.ROUTINE_EXERCISES, [
    re.routine_id,
    re.exercise_id,
    re.sets,
    re.reps,
  ]);
}

export async function updateRoutineExercise(
  routineId: string,
  exerciseId: string,
  sets: number,
  reps: number
): Promise<void> {
  const rows = await readSheet(SHEET_NAMES.ROUTINE_EXERCISES);
  const rowIndex = rows.findIndex((r) => r[0] === routineId && r[1] === exerciseId);
  if (rowIndex === -1) throw new Error(`RoutineExercise not found`);

  await updateRow(SHEET_NAMES.ROUTINE_EXERCISES, rowIndex + 2, [
    routineId,
    exerciseId,
    sets,
    reps,
  ]);
}

export async function deleteRoutineExercise(
  routineId: string,
  exerciseId: string
): Promise<void> {
  const rows = await readSheet(SHEET_NAMES.ROUTINE_EXERCISES);
  const rowIndex = rows.findIndex((r) => r[0] === routineId && r[1] === exerciseId);
  if (rowIndex === -1) throw new Error(`RoutineExercise not found`);
  await deleteRow(SHEET_NAMES.ROUTINE_EXERCISES, rowIndex + 2);
}

/**
 * Deletes all Routine_Exercises rows for a given routine (used when deleting a routine).
 * Processes rows in reverse order so indices don't shift.
 */
export async function deleteAllRoutineExercisesForRoutine(routineId: string): Promise<void> {
  const rows = await readSheet(SHEET_NAMES.ROUTINE_EXERCISES);
  const indices: number[] = [];
  rows.forEach((r, i) => {
    if (r[0] === routineId) indices.push(i + 2); // 1-indexed with header
  });

  // Delete in reverse to preserve row indices
  for (const idx of indices.reverse()) {
    await deleteRow(SHEET_NAMES.ROUTINE_EXERCISES, idx);
  }
}

// ─── Logs ─────────────────────────────────────────────────────────────────

export async function appendLog(
  log: Omit<Log, 'id'> & { id?: string }
): Promise<void> {
  const id = log.id ?? `log_${Date.now()}`;
  await appendRow(SHEET_NAMES.LOGS, [
    id,
    log.date,
    log.routine_id,
    log.exercise_id,
    log.sets,
    log.reps,
    log.weight_kg,
  ]);
}

// ─── Connection test ───────────────────────────────────────────────────────

export async function testConnection(): Promise<void> {
  try {
    const { spreadsheetId } = getConfig();
    const sheets = getSheetClient();

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });

    const sheetTitles = response.data.sheets
      ?.map((s) => s.properties?.title)
      .join(', ');

    console.log(`[GoogleSheets] ✅ Connection successful — tabs: ${sheetTitles}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[GoogleSheets] ❌ Connection failed: ${message}`);
    throw error;
  }
}
