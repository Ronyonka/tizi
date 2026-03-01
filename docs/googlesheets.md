# Google Sheets Integration

Tizi uses a Google Sheets spreadsheet as its database. All reads and writes happen **server-side** inside Expo API Routes using the `googleapis` Node.js SDK — the service account credentials are never exposed to the client bundle.

---

## Table of Contents

1. [How it works](#how-it-works)
2. [1 — Create a Google Cloud Project](#1--create-a-google-cloud-project)
3. [2 — Enable the Sheets API](#2--enable-the-sheets-api)
4. [3 — Create a Service Account](#3--create-a-service-account)
5. [4 — Set Up the Spreadsheet](#4--set-up-the-spreadsheet)
6. [5 — Configure Environment Variables](#5--configure-environment-variables)
7. [6 — Verify the Connection](#6--verify-the-connection)
8. [Spreadsheet Schema](#spreadsheet-schema)
9. [Service Layer Reference](#service-layer-reference)
10. [Security Notes](#security-notes)

---

## How it works

```
Mobile App (Expo Go / native)
        │
        │  HTTP fetch
        ▼
Expo API Routes  ──────────────────────────────────────────────────┐
(server-side Node.js)                                              │
  app/api/routines+api.ts                                          │ googleapis SDK
  app/api/exercises+api.ts                                         │ (service account JWT)
  app/api/routine-exercises+api.ts                                 │
  app/api/csv-upload+api.ts                                        ▼
  app/api/test-sheets+api.ts              Google Sheets REST API
        │                                         │
        │  calls                                  │
        ▼                                         ▼
services/googleSheets.ts           Your Google Spreadsheet
config/googleSheets.ts             (read from .env, never the client)
```

The mobile app never touches Google directly — it calls your own API routes, which run in Node.js and hold the credentials.

---

## 1 — Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project → New Project**
3. Give it a name (e.g. `tizi-gymtracker`) and click **Create**

---

## 2 — Enable the Sheets API

1. In your new project, go to **APIs & Services → Library**
2. Search for **Google Sheets API**
3. Click it and press **Enable**

---

## 3 — Create a Service Account

A service account is a non-human identity the app uses to authenticate with Google.

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → Service Account**
3. Fill in:
   - **Name**: `tizi-sheets` (or anything you like)
   - **Role**: *Editor* (so it can read and write)
4. Click **Done**
5. On the Credentials page, click the new service account's email to open it
6. Open the **Keys** tab → **Add Key → Create new key → JSON**
7. A `.json` file downloads — this contains your private key

> ⚠️ Keep this file private. Never commit it to git.

---

## 4 — Set Up the Spreadsheet

### Create the spreadsheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet
2. Name it something like **Tizi Gym Tracker**
3. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
   ```

### Share it with the service account

1. Click **Share** in the top-right of the spreadsheet
2. Paste the service account email (found in the JSON key file as `client_email`)
3. Set role to **Editor** and click **Send**

### Create the 4 tabs

Rename or create 4 sheets with **exactly** these names (case-sensitive):

| Tab name | Purpose |
|---|---|
| `Exercises` | Exercise library |
| `Routines` | Workout routines |
| `Routine_Exercises` | Which exercises belong to which routine |
| `Logs` | Workout logs (future use) |

### Add header rows

In **row 1** of each tab, add the following headers:

**Exercises**
```
id | name | muscle_group
```

**Routines**
```
id | name | day_of_week
```

**Routine_Exercises**
```
routine_id | exercise_id | sets | reps
```

**Logs**
```
id | date | routine_id | exercise_id | sets | reps | weight_kg
```

> The app skips row 1 (header) when reading — data starts from row 2.

---

## 5 — Configure Environment Variables

Open the downloaded JSON key file and copy the relevant fields into a `.env` file at the project root:

```env
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
```

**Tips:**
- The `GOOGLE_PRIVATE_KEY` value comes from the `private_key` field in the JSON file
- Keep the `\n` escape sequences as-is — the app replaces them with real newlines when loading
- Do **not** use the `EXPO_PUBLIC_` prefix — these are server-only credentials

The `.env` file is already covered by `.gitignore`. Once you've copied the values, delete the original JSON key file:

```bash
rm gymtracker-your-project-key.json
```

---

## 6 — Verify the Connection

With the dev server running (`npx expo start --clear`), hit the health-check endpoint:

```bash
curl http://localhost:8081/api/test-sheets
```

**Success:**
```json
{
  "success": true,
  "message": "Connection to Google Sheets successful"
}
```

**Failure:**
```json
{
  "success": false,
  "message": "Error: Could not load the default credentials."
}
```

Common failure reasons:
- Missing or wrong env vars in `.env`
- Service account email not shared on the spreadsheet
- `GOOGLE_PRIVATE_KEY` newlines not formatted correctly (should be `\n` in the `.env` string)

On app launch the root layout also calls this endpoint and logs the result to the Metro console.

---

## Spreadsheet Schema

### `Exercises`
| Column | Type | Notes |
|---|---|---|
| `id` | string | Auto-generated: `ex_<timestamp>` |
| `name` | string | e.g. Bench Press |
| `muscle_group` | string | e.g. Chest |

### `Routines`
| Column | Type | Notes |
|---|---|---|
| `id` | string | Auto-generated: `routine_<timestamp>` |
| `name` | string | e.g. Push Day A |
| `day_of_week` | string | Monday … Sunday |

### `Routine_Exercises`
| Column | Type | Notes |
|---|---|---|
| `routine_id` | string | FK → Routines.id |
| `exercise_id` | string | FK → Exercises.id |
| `sets` | number | |
| `reps` | number | |

### `Logs` *(ready for future use)*
| Column | Type | Notes |
|---|---|---|
| `id` | string | Auto-generated: `log_<timestamp>` |
| `date` | string | ISO date string |
| `routine_id` | string | FK → Routines.id |
| `exercise_id` | string | FK → Exercises.id |
| `sets` | number | |
| `reps` | number | |
| `weight_kg` | number | |

---

## Service Layer Reference

### `config/googleSheets.ts`
- `SHEET_NAMES` — object with tab name constants
- `SHEET_COLUMNS` — column headers for each tab
- `getConfig()` — reads and validates env vars; throws clear errors if missing

### `services/googleSheets.ts`

**Auth**
| Function | Description |
|---|---|
| `getSheetClient()` | Returns an authenticated `google.sheets` client |

**Generic helpers**
| Function | Description |
|---|---|
| `readSheet(tab, range?)` | Reads rows from a tab (skips header) |
| `appendRow(tab, values)` | Appends one row |
| `batchAppendRows(tab, rows)` | Appends multiple rows in one API call |

**Typed reads**
| Function | Returns |
|---|---|
| `getExercises()` | `Exercise[]` |
| `getRoutines()` | `Routine[]` |
| `getRoutineExercises()` | `RoutineExercise[]` |
| `getLogs()` | `Log[]` |

**Typed writes**
| Function | Description |
|---|---|
| `appendExercise(exercise)` | Add a new exercise |
| `appendRoutine(routine)` | Add a new routine |
| `updateRoutine(id, fields)` | Patch a routine's name or day |
| `deleteRoutine(id)` | Delete a routine row |
| `appendRoutineExercise(re)` | Link an exercise to a routine |
| `updateRoutineExercise(routineId, exerciseId, sets, reps)` | Update sets/reps |
| `deleteRoutineExercise(routineId, exerciseId)` | Remove a link |
| `deleteAllRoutineExercisesForRoutine(routineId)` | Remove all links for a routine |
| `appendLog(log)` | Append a workout log entry |
| `testConnection()` | Verify connectivity; throws on failure |

---

## Security Notes

| Rule | Why |
|---|---|
| Never use `EXPO_PUBLIC_` on credentials | That prefix embeds values into the JS bundle — visible to anyone who inspects the app |
| Never commit `.env` | Covered by `.gitignore` — contains your private key |
| Delete the JSON key file after copying | No need to keep it once values are in `.env` |
| Service account has Editor access — not Owner | Limits blast radius if the key is ever leaked |
| All Sheets calls go through server-side API routes | Credentials stay in Node.js; the mobile client only sees your own API responses |
