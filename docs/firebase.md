# Firebase / Firestore Integration

Tizi uses **Firebase Firestore** as its database (migrating from Google Sheets). The Firebase JS SDK initialises entirely on the client side using `EXPO_PUBLIC_` environment variables — no service account or server-side credentials required.

---

## How it works

```
Mobile App (Expo Go / native)
        │
        │  onSnapshot (Realtime JS SDK)
        │  append, update, delete (JS SDK)
        ▼
Cloud Firestore
(gymtracker-d2a5f)
        ▲
        │
services/firestore.ts      (SDK)
config/firebase.ts         (Config)
```

Tizi uses a purely client-side data flow for maximum simplicity and real-time syncing:
1. **Reads**: Primary interactive screens (Home, Workouts, Progress) use the **Firebase JS SDK** with direct `onSnapshot` listeners. This ensures the UI is always in sync across devices with zero-effort realtime updates.
2. **Writes**: All mutations (Append, Update, Delete) are routed through the same **Firebase JS SDK**.

---

## Services Reference

### `services/firestore.ts` (Client-side SDK)
Used by the frontend for realtime listeners and reliable mutations.
- Calls `initializeApp()` once.
- Configures `localCache: memoryLocalCache()` and forces long-polling for stable Android connectivity without proxy servers.
- Exports `db` (Firestore instance) and all CRUD wrapper methods.

| Function group | Functions |
|---|---|
| **Routines** | `getRoutines()`, `appendRoutine(routine)`, `updateRoutine(id, fields)`, `deleteRoutine(id)` |
| **Routine Exercises** | `getRoutineExercises()`, `appendRoutineExercise(re)`, `deleteRoutineExercise(routine_id, exercise_id)` |
| **Logs** | `getLogs()`, `appendLog(log)`, `deleteLog(id)`, `batchAppendLogs(logs)` |
| **Utility** | `testConnection()` |

**Normalization & document IDs**
The service handles data normalization and ID generation identically for a seamless user experience.

| Collection | Document ID |
|---|---|
| `exercises` | `ex_<timestamp>` |
| `routines` | `routine_<timestamp>` |
| `routine_exercises` | `${routine_id}_${exercise_id}` |
| `logs` | `log_<timestamp>` |

---

---

## CSV Upload Deduplication

The CSV bulk upload securely deduplicates against Firestore directly from the user's JS bundle:

1. **Exercises**: Matched by `name` (case-insensitive) via `findExerciseByName`.
2. **Routines**: Matched by `name` + `day_of_week` (case-insensitive) via `findRoutineByNameAndDay`.
3. **Routine_Exercises**: Matched by `routine_id` + `exercise_id` (document ID lookups).

**Performance Features:**
- **In-memory Mapping**: Local JS maps (`exerciseCache`, `routineCache`) avoid redundant Firestore lookups for repeated items in the same CSV during the loop parsing phase.

---

## Security & Deployment Notes

| Rule | Why |
|---|---|
| `EXPO_PUBLIC_` is intentional | Firestore uses native Security Rules for access control, not secret backend keys |
| Never commit `.env.local` | Covered by `.gitignore`. `env.local` acts as the primary environment source for running locally. |
| Use Firestore Security Rules in production | Test-mode allows anyone to read/write — lock it down before launch |

### Syncing EAS Environment Variables
When publishing via EAS, you'll need to push your local environment keys to Expo safely (since they shouldn't be loaded directly to GitHub):
```bash
eas env:push --environment production
```
