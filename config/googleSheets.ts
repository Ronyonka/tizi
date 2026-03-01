/**
 * Google Sheets API Configuration
 *
 * Environment variables are loaded from .env (server-side only).
 * Do NOT prefix these with EXPO_PUBLIC_ — that would expose the
 * private key to the client bundle.
 */

/** The 4 sheet tab names in the spreadsheet */
export const SHEET_NAMES = {
  EXERCISES: 'Exercises',
  ROUTINES: 'Routines',
  ROUTINE_EXERCISES: 'Routine_Exercises',
  LOGS: 'Logs',
} as const;

export type SheetName = (typeof SHEET_NAMES)[keyof typeof SHEET_NAMES];

/** Column headers for each sheet tab */
export const SHEET_COLUMNS = {
  EXERCISES: ['id', 'name', 'muscle_group'],
  ROUTINES: ['id', 'name', 'day_of_week'],
  ROUTINE_EXERCISES: ['routine_id', 'exercise_id', 'sets', 'reps'],
  LOGS: ['id', 'date', 'routine_id', 'exercise_id', 'sets', 'reps', 'weight_kg'],
} as const;

/** Loads and validates the configuration from environment variables */
export function getConfig() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!spreadsheetId) throw new Error('[GoogleSheets] Missing GOOGLE_SPREADSHEET_ID in environment');
  if (!serviceAccountEmail) throw new Error('[GoogleSheets] Missing GOOGLE_SERVICE_ACCOUNT_EMAIL in environment');
  if (!privateKey) throw new Error('[GoogleSheets] Missing GOOGLE_PRIVATE_KEY in environment');

  return {
    spreadsheetId,
    credentials: {
      client_email: serviceAccountEmail,
      // Replace escaped newlines from .env string format
      private_key: privateKey.replace(/\\n/g, '\n'),
    },
  };
}
