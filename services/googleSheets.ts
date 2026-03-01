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
 * @param tab  One of the SHEET_NAMES values
 * @param range Optional A1 notation override (e.g. "A2:G"). Defaults to the whole sheet.
 * @returns     Array of string arrays (rows), with the header row skipped.
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
 * @param tab    One of the SHEET_NAMES values
 * @param values Array of cell values to append
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

// ─── Typed data-access functions ───────────────────────────────────────────

/**
 * Returns all exercises from the Exercises tab.
 * Columns: id | name | muscle_group
 */
export async function getExercises(): Promise<Exercise[]> {
  const rows = await readSheet(SHEET_NAMES.EXERCISES);
  return rows.map(([id, name, muscle_group]) => ({ id, name, muscle_group }));
}

/**
 * Returns all routines from the Routines tab.
 * Columns: id | name | day_of_week
 */
export async function getRoutines(): Promise<Routine[]> {
  const rows = await readSheet(SHEET_NAMES.ROUTINES);
  return rows.map(([id, name, day_of_week]) => ({ id, name, day_of_week }));
}

/**
 * Returns all routine–exercise links from the Routine_Exercises tab.
 * Columns: routine_id | exercise_id | sets | reps
 */
export async function getRoutineExercises(): Promise<RoutineExercise[]> {
  const rows = await readSheet(SHEET_NAMES.ROUTINE_EXERCISES);
  return rows.map(([routine_id, exercise_id, sets, reps]) => ({
    routine_id,
    exercise_id,
    sets: Number(sets),
    reps: Number(reps),
  }));
}

/**
 * Returns all workout logs from the Logs tab.
 * Columns: id | date | routine_id | exercise_id | sets | reps | weight_kg
 */
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

/**
 * Appends a new workout log entry to the Logs tab.
 * The `id` is generated as a timestamp-based string if not provided.
 */
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

/**
 * Verifies connectivity to the spreadsheet.
 * Call this on app launch to surface auth/config errors early.
 */
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
