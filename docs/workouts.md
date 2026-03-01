# Workouts Screen

Deep-dive documentation for the Workouts screen in Tizi — covering the data model, UI flow, API routes, service functions, CSV import format, and error handling patterns.

---

## Table of Contents

1. [Overview](#overview)
2. [Data Model](#data-model)
3. [Architecture & Data Flow](#architecture--data-flow)
4. [UI Reference](#ui-reference)
5. [API Routes](#api-routes)
6. [CSV Bulk Import](#csv-bulk-import)
7. [Service Layer Reference](#service-layer-reference)
8. [Error Handling](#error-handling)

---

## Overview

The Workouts screen is the core feature of Tizi. It lets users build a weekly workout plan by creating **Routines** (named workout sessions tied to a day of the week) and populating them with **Exercises** (each with a default set/rep count). All data is persisted to **Firebase Firestore** in real time.

```
Routine
  └── name: "Push Day A"
  └── day_of_week: "Monday"
  └── exercises:
        ├── Bench Press — 4 × 8
        ├── Overhead Press — 3 × 10
        └── Lateral Raise — 3 × 15
```

---

## Data Model

Four Firestore collections are involved:

### `Exercises`

A shared library of exercises. An exercise can appear in many routines.

| Column | Type | Auto-generated? | Notes |
|---|---|---|---|
| `id` | string | ✅ `ex_<timestamp>` | Primary key |
| `name` | string | — | e.g. `Bench Press` |
| `muscle_group` | string | — | e.g. `Chest` |
| `name_lowercase` | string | ✅ | For case-insensitive lookup |

Supported muscle groups: `Chest`, `Back`, `Shoulders`, `Biceps`, `Triceps`, `Legs`, `Quads`, `Hamstrings`, `Glutes`, `Calves`, `Core`, `Abs`, `Cardio`, `Full Body`, `Other`.

### `Routines`

One row per routine. Routines are assigned to a day of the week.

| Column | Type | Auto-generated? | Notes |
|---|---|---|---|
| `id` | string | ✅ `routine_<timestamp>` | Primary key |
| `name` | string | — | e.g. `Push Day A` |
| `day_of_week` | string | — | `Monday` … `Sunday` |
| `name_lowercase` | string | ✅ | For case-insensitive lookup |
| `day_of_week_lowercase` | string | ✅ | For case-insensitive lookup |

### `Routine_Exercises`

Junction table. One row per exercise-in-a-routine, storing the default set/rep prescription.

| Column | Type | Notes |
|---|---|---|
| `routine_id` | string | FK → `Routines.id` |
| `exercise_id` | string | FK → `Exercises.id` |
| `sets` | number | Default sets for this slot |
| `reps` | number | Default reps per set |

> **Note:** The `logs` collection is used for recording actual workout performance (weight and reps) from the Home screen.

---

## Architecture & Data Flow

```
workouts.tsx  (React Native — client-side)
    │
    │  onSnapshot (Realtime Read)
    ▼
Firebase Firestore
    ▲
    │  HTTP mutation (relative URL)
    ▼
Expo API Routes  (Node.js — server-side)
    ├── /api/routines             (POST)
    ├── /api/routines/:id         (PATCH, DELETE)
    ├── /api/exercises            (POST)
    ├── /api/routine-exercises    (POST, PATCH, DELETE)
    └── /api/csv-upload           (POST)
    │
    │  Firestore JS SDK
    ▼
services/firestore.ts
```

### On mount

The Workouts screen sets up three separate Firestore listeners (`onSnapshot`) for `routines`, `exercises`, and `routine_exercises`. This ensures the UI stays perfectly in sync with the database at all times.

### On mutation

All add, edit, and delete operations are performed via **API Routes**. 
1. **API call** — the corresponding route writes to Firestore.
2. **Realtime Update** — as soon as the write is committed to Firestore, the `onSnapshot` listeners on the client trigger an automatic UI update.
3. **Error** — an Alert is shown if the API call fails.

---

## UI Reference

### Screen layout

```
┌─────────────────────────────────────────┐
│  Workouts            [↑CSV] [↺] [+Routine] │  ← Header
├─────────────────────────────────────────┤
│  MONDAY ──────────────────────────────── │  ← Day section
│  ┌─────────────────────────────────────┐ │
│  │  Push Day A           [✏] [🗑] [v] │ │  ← Routine card (collapsed)
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │  Pull Day A           [✏] [🗑] [^] │ │  ← Routine card (expanded)
│  │ ─────────────────────────────────── │ │
│  │  [Chest]  Bench Press    [4×8 ✏] 🗑 │ │  ← Exercise row
│  │  [Back]   Pull-up        [3×10✏] 🗑 │ │
│  │           + Add Exercise            │ │
│  └─────────────────────────────────────┘ │
│  TUESDAY ─────────────────────────────── │
│  ...                                    │
└─────────────────────────────────────────┘
```

### Interactions

| Action | How |
|---|---|
| Expand / collapse routine | Tap anywhere on the routine card header |
| Add routine | Tap `+ Routine` in the header |
| Edit routine name / day | Tap the pencil icon on the routine card |
| Delete routine | Tap the trash icon on the routine card (confirms first; cascade-deletes all its exercise links) |
| Add exercise to routine | Expand the routine → tap `+ Add Exercise` |
| Edit sets/reps | Tap the `4×8` badge on an exercise row |
| Remove exercise from routine | Tap the trash icon on the exercise row (confirms first) |
| CSV import | Tap the cloud-upload icon in the header |

### Add Routine modal

- **Routine Name** — free text input
- **Day of Week** — horizontal scrollable chip picker (Mon–Sun abbreviations)

### Add Exercise bottom sheet (two tabs)

**Search Library tab**
- Live search bar filtering by exercise name or muscle group
- Exercises already in the routine shown as disabled (with a checkmark)
- Tap any result to instantly add it with the current sets/reps

**Create New tab**
- Exercise name text input
- Muscle group picker — horizontal coloured chips
- Sets/reps steppers (shared with the Search tab, at the top of the sheet)

### Muscle group colours

Each muscle group has a unique colour used for pill badges throughout the UI:

| Group | Colour |
|---|---|
| Chest | `#FF6B6B` (coral red) |
| Back | `#4ECDC4` (teal) |
| Shoulders | `#45B7D1` (sky blue) |
| Biceps | `#96CEB4` (sage green) |
| Quads | `#DDA0DD` (plum) |
| Core / Abs | `#98FB98` / `#7DCEA0` (greens) |
| Cardio | `#FF4D4D` (red) |
| Full Body | `#E8FF3D` (lime — primary) |

---

## API Routes

All routes are defined as Expo API Route files (`+api.ts`) and run server-side.

### `GET /api/routines`

Returns all routines from the `routines` collection.

**Response** `200`
```json
[
  { "id": "routine_1234", "name": "Push Day A", "day_of_week": "Monday" }
]
```

---

### `POST /api/routines`

Creates a new routine and appends it to the `routines` collection.

**Body**
```json
{ "name": "Push Day A", "day_of_week": "Monday" }
```

**Response** `201`
```json
{ "id": "routine_1234", "name": "Push Day A", "day_of_week": "Monday" }
```

---

### `PATCH /api/routines/:id`

Updates an existing routine's name and/or day.

**Body** (all fields optional)
```json
{ "name": "Push Day B", "day_of_week": "Thursday" }
```

**Response** `200`
```json
{ "success": true, "id": "routine_1234" }
```

---

### `DELETE /api/routines/:id`

Deletes a routine **and all its `Routine_Exercises` rows** (cascade delete).

**Response** `200`
```json
{ "success": true }
```

---

### `GET /api/exercises`

Returns all exercises from the `exercises` collection.

**Response** `200`
```json
[
  { "id": "ex_5678", "name": "Bench Press", "muscle_group": "Chest" }
]
```

**Query params**
- *(none — returns all exercises)*

---

### `POST /api/exercises`

Creates a new exercise.

**Body**
```json
{ "name": "Bench Press", "muscle_group": "Chest" }
```

**Response** `201`
```json
{ "id": "ex_5678", "name": "Bench Press", "muscle_group": "Chest" }
```

---

### `GET /api/routine-exercises`

Returns routine-exercise links. Optionally filter by routine.

**Query params**
- `?routineId=routine_1234` — only return links for that routine

**Response** `200`
```json
[
  { "routine_id": "routine_1234", "exercise_id": "ex_5678", "sets": 4, "reps": 8 }
]
```

---

### `POST /api/routine-exercises`

Links an exercise to a routine with a set/rep prescription.

**Body**
```json
{ "routine_id": "routine_1234", "exercise_id": "ex_5678", "sets": 4, "reps": 8 }
```

**Response** `201` — the same object.

---

### `PATCH /api/routine-exercises`

Updates the sets/reps for an existing link (looked up by `routine_id` + `exercise_id`).

**Body**
```json
{ "routine_id": "routine_1234", "exercise_id": "ex_5678", "sets": 5, "reps": 6 }
```

**Response** `200` — the same object.

---

### `DELETE /api/routine-exercises`

Removes a single exercise from a routine.

**Body**
```json
{ "routine_id": "routine_1234", "exercise_id": "ex_5678" }
```

**Response** `200`
```json
{ "success": true }
```

---

### `POST /api/csv-upload`

Bulk-imports data from a CSV. Deduplicates against existing Firestore data before writing.

See [CSV Bulk Import](#csv-bulk-import) for full details.

---

## CSV Bulk Import

### How it works

1. User taps the cloud-upload icon in the Workouts screen header
2. `expo-document-picker` opens the native file picker — select a `.csv` file
3. `expo-file-system` reads the file content as a string
4. The CSV text is `POST`-ed to `/api/csv-upload` as `{ "csv": "..." }`
5. The server parses the CSV, performs targeted Firestore lookups for each row to deduplicate, then commits all new records in a single `writeBatch`.
6. A summary Alert is shown: rows parsed / new routines / new exercises / new links
7. The screen refreshes from Firestore

### Deduplication logic

- **Exercises**: deduplicated by `name` (case-insensitive). If an exercise with the same name already exists, the existing record is reused — a duplicate document is not added.
- **Routines**: deduplicated by `name + day_of_week` (both case-insensitive). Same name on a different day = different routine.
- **Routine_Exercises**: deduplicated by `routine_id + exercise_id`. If the link already exists, it is skipped (the existing sets/reps are preserved).

### CSV format

**Required columns** (header row mandatory, order doesn't matter):

| Column | Required | Notes |
|---|---|---|
| `routine_name` | ✅ | Name of the routine |
| `day_of_week` | ✅ | `Monday` … `Sunday` (case-insensitive) |
| `exercise_name` | ✅ | Name of the exercise |
| `muscle_group` | ✅ | Any muscle group string |
| `sets` | ✅ | Integer |
| `reps` | ✅ | Integer |

**Example file:**

```csv
routine_name,day_of_week,exercise_name,muscle_group,sets,reps
Push Day A,Monday,Bench Press,Chest,4,8
Push Day A,Monday,Overhead Press,Shoulders,3,10
Push Day A,Monday,Lateral Raise,Shoulders,3,15
Pull Day A,Tuesday,Pull-up,Back,4,8
Pull Day A,Tuesday,Barbell Row,Back,4,10
Pull Day A,Tuesday,Bicep Curl,Biceps,3,12
Leg Day,Wednesday,Barbell Squat,Quads,4,6
Leg Day,Wednesday,Romanian Deadlift,Hamstrings,3,10
Leg Day,Wednesday,Leg Press,Quads,3,12
```

**API response:**

```json
{
  "success": true,
  "summary": {
    "rows_parsed": 9,
    "exercises_added": 9,
    "routines_added": 3,
    "routine_exercises_added": 9
  }
}
```

### Notes

- Quoted CSV fields (values containing commas) are handled correctly
- Blank rows and rows with empty `routine_name` or `exercise_name` are silently skipped
- The `sets` and `reps` columns fall back to `3` and `10` respectively if missing or non-numeric

---

## Service Layer Reference

The functions below live in `services/firestore.ts` and are called from the API routes.

### Read functions

| Function | Returns | Description |
|---|---|---|
| `getExercises()` | `Exercise[]` | All documents from `exercises` collection |
| `getRoutines()` | `Routine[]` | All documents from `routines` collection |
| `getRoutineExercises()` | `RoutineExercise[]` | All documents from `routine_exercises` collection |

### Lookup functions

| Function | Returns | Description |
|---|---|---|
| `findExerciseByName(name)` | `Exercise \| null` | Case-insensitive lookup using `name_lowercase` |
| `findRoutineByNameAndDay(name, day)` | `Routine \| null` | Case-insensitive lookup using `_lowercase` fields |
| `getRoutineExercise(rtId, exId)` | `RE \| null` | Lookup using composite ID: `${rtId}_${exId}` |

### Write functions — Routines

| Function | Description |
|---|---|
| `appendRoutine(routine)` | Appends a new document to `routines` |
| `updateRoutine(id, fields)` | Finds document by id, patches `name` and/or `day_of_week` |
| `deleteRoutine(id)` | Finds document by id, deletes it |
| `deleteAllRoutineExercisesForRoutine(routineId)` | Deletes all `routine_exercises` documents for a given routine |

### Write functions — Exercises

| Function | Description |
|---|---|
| `appendExercise(ex)` | Appends a new document to `exercises` |

### Write functions — Routine_Exercises

| Function | Description |
|---|---|
| `appendRoutineExercise(re)` | Appends a new link document |
| `updateRoutineExercise(routineId, exerciseId, sets, reps)` | Finds link document and updates sets/reps |
| `deleteRoutineExercise(routineId, exerciseId)` | Finds and deletes the link document |

### Batch / generic helpers

| Function | Description |
|---|---|
| `batchAppendLogs(logs)` | High-level helper for saving session logs (chunks in 500s) |
| `testConnection()` | Verifies Firestore connectivity |

---

## Error Handling

### Screen-level errors

On load failure an error banner is shown at the top of the screen with a **Retry** button that re-fetches all data.

### Mutation errors

Each create/update/delete action wraps the API call in a `try/catch` and shows an `Alert` on failure. The local state is *not* rolled back — the optimistic update stands and the user can tap the refresh button to re-sync if needed.

### API route errors

All API routes return a consistent error shape:

```json
{ "error": "human-readable message here" }
```

With the appropriate HTTP status code (`400` for validation, `500` for service errors).

### Common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Screen shows "Failed to load data" on open | Firestore connection issue | Check `curl localhost:8081/api/test-sheets` and verify `.env` values |
| "Routine not found" on delete | Document was already deleted, or ID mismatch | Refresh the screen |
| CSV import succeeds but no new documents appear | All rows were deduplicated as already existing | Check existing data in Firestore |
| Sets/reps not updating | Document lookup failed (routine_id + exercise_id not found) | Refresh to re-sync, then retry |
