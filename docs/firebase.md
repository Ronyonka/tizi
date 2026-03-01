# Firebase / Firestore Integration

Tizi uses **Firebase Firestore** as its database (migrating from Google Sheets). The Firebase JS SDK initialises entirely on the client side using `EXPO_PUBLIC_` environment variables — no service account or server-side credentials required.

---

## How it works

```
Mobile App (Expo Go / native)
        │
        │  Firestore JS SDK (client-side)
        ▼
services/firebase.ts  ──────────────────────────────────────────┐
  initializeApp(config)                                          │ HTTPS
  getFirestore()                                                 ▼
        │                                              Firebase Firestore
        │  exports `db`                                (gymtracker-d2a5f)
        ▼
config/firebase.ts
  COLLECTIONS.exercises
  COLLECTIONS.routines
  COLLECTIONS.routineExercises
  COLLECTIONS.logs
```

Unlike the previous Google Sheets integration, there are no server-side API routes involved — reads and writes go directly from the app to Firestore using the JS SDK, controlled by Firestore Security Rules.

---

## Collections

| Collection | Purpose |
|---|---|
| `exercises` | Exercise library (name, muscle group) |
| `routines` | Workout routines (name, day of week) |
| `routine_exercises` | Which exercises belong to which routine (sets, reps) |
| `logs` | Workout session history (date, exercise, sets, reps, weight) |

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
- Calls `initializeApp()` once (guarded by `getApps()` to survive Expo hot-reload)
- Exports `db` — the Firestore instance used throughout the app
- Exports `default app` — the Firebase app instance

### `config/firebase.ts`
- Exports `COLLECTIONS` — an object of collection name constants to avoid magic strings
- Exports `CollectionName` — a union type of all valid collection names

### `services/firestore.ts`
The primary data-access layer. Drop-in replacement for `services/googleSheets.ts` — every function has the same name, TypeScript types, and return shape.

| Function group | Functions |
|---|---|
| **Read** | `getExercises()`, `getRoutines()`, `getRoutineExercises()`, `getLogs()` |
| **Exercises** | `appendExercise(exercise)` |
| **Routines** | `appendRoutine(routine)`, `updateRoutine(id, fields)`, `deleteRoutine(id)`, `deleteAllRoutineExercisesForRoutine(routineId)` |
| **Routine Exercises** | `appendRoutineExercise(re)`, `updateRoutineExercise(routineId, exerciseId, sets, reps)`, `deleteRoutineExercise(routineId, exerciseId)` |
| **Logs** | `appendLog(log)`, `batchAppendLogs(logs)` |
| **Utility** | `testConnection()` |

**Document ID conventions**

| Collection | Document ID |
|---|---|
| `exercises` | `ex_<timestamp>` |
| `routines` | `routine_<timestamp>` |
| `routine_exercises` | `${routineId}_${exerciseId}` (composite) |
| `logs` | `log_<timestamp>` |

> `batchAppendLogs` splits writes into 500-document chunks to stay within Firestore's batch limit.

---

## Security Notes

| Rule | Why |
|---|---|
| `EXPO_PUBLIC_` is intentional for Firebase | Firestore uses Security Rules for access control, not secret keys |
| Never expose `GOOGLE_PRIVATE_KEY` with `EXPO_PUBLIC_` | That's a service account secret — it must stay server-side only |
| Never commit `.env` | Covered by `.gitignore` |
| Use Firestore Security Rules in production | Test-mode allows anyone to read/write — lock it down before launch |
