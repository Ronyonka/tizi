# Firebase / Firestore Integration

Tizi uses **Firebase Firestore** as its database (migrating from Google Sheets). The Firebase JS SDK initialises entirely on the client side using `EXPO_PUBLIC_` environment variables — no service account or server-side credentials required.

---

## How it works

```
Mobile App (Expo Go / native)
        │
        │  onSnapshot (Realtime)
        ▼
Firebase Firestore ────────────────────────────────────────────────┐
(gymtracker-d2a5f)                                                 │
        ▲                                                          │
        │  HTTP POST/PATCH/DELETE                                  │
        │                                                          │
Expo API Routes                                                    │ Firestore JS SDK
(server-side Node.js)                                              │ Client & Server
  app/api/exercises+api.ts                                         │
  app/api/routines+api.ts                                          │
  app/api/routine-exercises+api.ts                                 │
  app/api/csv-upload+api.ts                                        ▼
                                                    services/firestore.ts
                                                    config/firebase.ts
```

Tizi uses a hybrid data flow for efficiency and simplicity. **Reads** on the primary interactive screens (Home and Workouts) use direct Firestore `onSnapshot` listeners. This ensures the UI is always in sync across devices without manual polling. **Writes** (Create, Update, Delete) continue to be routed through **Expo API Routes** to maintain a clean command-line-testable API and allow for future server-side logic.

---

## Collections

| Collection | Purpose | Schema Details |
|---|---|---|
| `exercises` | Exercise library | `{ id, name, muscle_group, name_lowercase }` |
| `routines` | Workout routines | `{ id, name, day_of_week, name_lowercase, day_of_week_lowercase }` |
| `routine_exercises` | Exercise links | `{ routine_id, exercise_id, sets, reps }` |
| `logs` | Session history | `{ id, date, routine_id, exercise_id, sets, reps, weight_kg }` |

---

## Environment Variables

All six variables use the `EXPO_PUBLIC_` prefix so the Expo bundler includes them in the client JS bundle. This is safe because Firestore access is controlled by Security Rules, not by keeping credentials secret.

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

Find these values in the **Firebase Console → Project Settings → Your apps → SDK setup and configuration**.

---

## Setup

### 1 — Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**, follow the wizard
3. Disable Google Analytics if you don't need it

### 2 — Add a Web app

1. In your project, click the **</>** (Web) icon to register a new app
2. Give it a nickname (e.g. `tizi-expo`)
3. Copy the `firebaseConfig` object — those values map directly to the env vars above

> **Note**: Even though Tizi is a React Native / Expo app, you register it as a Web app in Firebase. The Firebase JS SDK is cross-platform and works the same way in Expo Go.

### 3 — Enable Firestore

1. In the Firebase Console, go to **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (you'll tighten the rules later) and pick a region close to you

### 4 — Configure `.env`

Paste the values from step 2 into your `.env` file at the project root.

### 5 — Security Rules

Once you move out of development, replace the default test-mode rules in **Firestore → Rules** with something appropriate. A minimal authenticated-only ruleset:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## File Reference

### `services/firebase.ts`
- Calls `initializeApp()` once (guarded by `getApps()` to survive Expo hot-reload).
- Configures `localCache: memoryLocalCache()` to ensure stable connectivity in the Node.js API Route environment (avoiding browser-only IndexedDB errors).
- Exports `db` — the Firestore instance.
- Exports `default app` — the Firebase app instance.

### `config/firebase.ts`
- Exports `COLLECTIONS` — an object of collection name constants to avoid magic strings
- Exports `CollectionName` — a union type of all valid collection names

### `services/firestore.ts`
The primary data-access layer. Drop-in replacement for `services/googleSheets.ts` — every function has the same name, TypeScript types, and return shape.

| Function group | Functions |
|---|---|
| **Read** | `getExercises()`, `getRoutines()`, `getRoutineExercises()`, `getLogs()` |
| **Lookup** | `findExerciseByName(name)`, `findRoutineByNameAndDay(name, day)`, `getRoutineExercise(routineId, exId)` |
| **Exercises** | `appendExercise(exercise)` |
| **Routines** | `appendRoutine(routine)`, `updateRoutine(id, fields)`, `deleteRoutine(id)`, `deleteAllRoutineExercisesForRoutine(routineId)` |
| **Routine Exercises** | `appendRoutineExercise(re)`, `updateRoutineExercise(routineId, exerciseId, sets, reps)`, `deleteRoutineExercise(routineId, exerciseId)` |
| **Logs** | `appendLog(log)`, `batchAppendLogs(logs)` |
| **Utility** | `testConnection()` |

**Normalization**
- Exercises and Routines include `_lowercase` fields to support case-insensitive Firestore queries without fetching entire collections.
- `appendExercise` and `appendRoutine` automatically handle this normalization.

**Document ID conventions**

| Collection | Document ID |
|---|---|
| `exercises` | `ex_<timestamp>` |
| `routines` | `routine_<timestamp>` |
| `routine_exercises` | `${routineId}_${exerciseId}` (composite) |
| `logs` | `log_<timestamp>` |

> `batchAppendLogs` splits writes into 500-document chunks to stay within Firestore's batch limit.

---

## CSV Upload Deduplication

The `POST /api/csv-upload` route implements targeted deduplication against Firestore:

1. **Exercises**: Matched by `name` (case-insensitive) via `findExerciseByName`.
2. **Routines**: Matched by `name` + `day_of_week` (case-insensitive) via `findRoutineByNameAndDay`.
3. **Routine_Exercises**: Matched by `routine_id` + `exercise_id` (document ID lookups).

**Performance Features:**
- **Request-level Caching**: Local caches (`exerciseCache`, `routineCache`) avoid redundant Firestore lookups for repeated items in the same CSV.
- **Batch Writing**: All new records are committed in a single, atomic `writeBatch`.

---

## Security Notes

| Rule | Why |
|---|---|
| `EXPO_PUBLIC_` is intentional for Firebase | Firestore uses Security Rules for access control, not secret keys |
| Never expose `GOOGLE_PRIVATE_KEY` with `EXPO_PUBLIC_` | That's a service account secret — it must stay server-side only |
| Never commit `.env` | Covered by `.gitignore` |
| Use Firestore Security Rules in production | Test-mode allows anyone to read/write — lock it down before launch |
