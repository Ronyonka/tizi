# Firebase / Firestore Integration

Tizi uses **Firebase Firestore** as its database (migrating from Google Sheets). The Firebase JS SDK initialises entirely on the client side using `EXPO_PUBLIC_` environment variables — no service account or server-side credentials required.

---

## How it works

```
Mobile App (Expo Go / native)
        │
        │  onSnapshot (Realtime JS SDK)
        ▼
Cloud Firestore ───────────────────────────────────────────────────┐
(gymtracker-d2a5f)                                                 │
        ▲                                                          │
        │  HTTP REST calls (fetch)                                 │
        │                                                          │
Expo API Routes                                                    │ Firestore JS SDK
(server-side Node.js)                                              │ (Client Read)
  app/api/*+api.ts                                                 │
        │                                                          │
        ▼                                                          │
services/firestore-rest.ts (REST) <────────────────────────────────┘
services/firestore.ts      (SDK)
config/firebase.ts         (Config)
```

Tizi uses a hybrid data flow for maximum reliability and performance:
1. **Reads (Client)**: Primary interactive screens (Home, Workouts, Progress) use the **Firebase JS SDK** with direct `onSnapshot` listeners. This ensures the UI is always in sync across devices with zero-effort realtime updates.
2. **Writes (Server)**: All mutations (Append, Update, Delete) are routed through **Expo API Routes**. These routes use the **Cloud Firestore REST API** via standard `fetch` calls.

> [!NOTE]
> **Why REST for the Backend?** 
> The Firestore JS SDK and Admin SDK rely on GRPC/Long-polling, which can sometimes hang or experience timeout issues in ephemeral serverless environments like Expo's development API server. Switching to the lightweight REST API ensures fast, stateless, and reliable writes.

---

## Services Reference

### `services/firestore.ts` (Client-side SDK)
Used by the frontend for realtime listeners and one-off fetches if needed.
- Calls `initializeApp()` once.
- Configures `localCache: memoryLocalCache()` for stable connectivity.
- Exports `db` (Firestore instance) and `app` (Firebase app).

### `services/firestore-rest.ts` (Server-side REST)
The primary data-access layer for **API Routes**. It wraps the [Firestore REST API](https://firebase.google.com/docs/firestore/reference/rest) to provide a familiar functional interface with automatic data (un)wrapping. Every function has the same name and signature as the SDK-based `services/firestore.ts` to allow for easy interchangeability.

| Function group | Functions |
|---|---|
| **Routines** | `getRoutines()`, `appendRoutine(routine)`, `updateRoutine(id, fields)`, `deleteRoutine(id)` |
| **Routine Exercises** | `getRoutineExercises()`, `appendRoutineExercise(re)`, `deleteRoutineExercise(routine_id, exercise_id)` |
| **Logs** | `getLogs()`, `appendLog(log)`, `deleteLog(id)`, `batchAppendLogs(logs)` |
| **Utility** | `testConnection()` |

**Normalization & document IDs**
The REST service handled data normalization (like `name_lowercase` fields) and ID generation (`routine_<timestamp>`, etc.) identically to the SDK version.

| Collection | Document ID |
|---|---|
| `exercises` | `ex_<timestamp>` |
| `routines` | `routine_<timestamp>` |
| `routine_exercises` | `${routine_id}_${exercise_id}` |
| `logs` | `log_<timestamp>` |

---

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
