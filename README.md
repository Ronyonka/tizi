# Tizi — Gym Tracker App

A React Native / Expo workout tracker with a dark gym-style UI. Workouts and exercises are persisted to **Firebase Firestore**. The Firebase JS SDK runs client-side; Expo API routes have been migrated to use Firestore as the data access layer.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Expo](https://expo.dev) (SDK 54) with Expo Router (file-based routing) |
| Language | TypeScript |
| Navigation | React Navigation — bottom tab navigator via `expo-router` Tabs |
| UI | React Native (Vanilla StyleSheet, no Tailwind) |
| Icons | `@expo/vector-icons` — Ionicons |
| Database | Firebase Firestore (JS SDK) |
| API layer | Expo API Routes (server-side, runs in Node/Bun) |
| File import | `expo-document-picker` + `expo-file-system` |

---

## Project Structure

```
app/
  _layout.tsx              # Root layout — forces dark theme
  (tabs)/
    _layout.tsx            # Bottom tab navigator (5 tabs)
    index.tsx              # Home screen
    workouts.tsx           # Workouts screen (full CRUD + CSV import)
    calendar.tsx           # Calendar screen
    progress.tsx           # Progress screen
    settings.tsx           # Settings screen
  api/
    exercises+api.ts       # GET /api/exercises, POST /api/exercises
    routines+api.ts        # GET /api/routines, POST /api/routines
    routines/
      [id]+api.ts          # PATCH /api/routines/:id, DELETE /api/routines/:id
    routine-exercises+api.ts  # GET/POST/PATCH/DELETE /api/routine-exercises
    csv-upload+api.ts      # POST /api/csv-upload
    logs+api.ts            # GET /api/logs, POST /api/logs
    progress+api.ts        # GET /api/progress (exercises + logs combined)
    test-sheets+api.ts     # GET /api/test-sheets (connection health check)

config/
  googleSheets.ts          # Sheet tab names, column definitions, env validation (legacy)
  firebase.ts              # Firestore collection name constants

services/
  googleSheets.ts          # Legacy Google Sheets service
  firebase.ts              # Firebase app init + Firestore export (`db`)
  firestore.ts             # Primary Firestore data-access layer

constants/
  theme.ts                 # Dark gym-style design system (colors, spacing, typography, radii)
```

---

## Screens

### Home (`/`)
- Greeting with user's name and avatar initial
- "Today's Workout" logger (sets, weight, reps tracking)
- Upcoming schedule list for the next 3 days
- Saves session logs directly to Google Sheets

### Workouts (`/workouts`)
The core feature. Routines are fetched from Google Sheets and displayed grouped by day of the week.

- Add / edit / delete routines (name + day)
- Add exercises from the library or create new ones (name + muscle group + sets/reps)
- Edit sets × reps inline; remove exercises from routines
- CSV bulk import to populate Sheets in one go
- Manual sync / refresh button; error banner with retry

📖 **[Full Workouts screen docs → docs/workouts.md](docs/workouts.md)**

### Calendar (`/calendar`)
- Activity heatmap (4-week history grid)
- This-week indicator row
- Recent session log cards with routine details and volume

### Progress (`/progress`)
- Exercise list — every exercise in your library, with session count
- Tap any exercise to open a detail view:
  - Line chart of max weight lifted over time (custom pure-RN component, no extra packages)
  - **30D / 3M / All** time-range filter
  - Log history sorted newest → oldest (date · sets × reps · weight kg)
- Empty state placeholders when no data exists for a given period

### Settings (`/settings`)
- Profile card (name, email)
- Training preferences (plan, goal, rest timer)
- Toggle switches (push notifications, workout reminders, haptic feedback, metric/imperial)
- Data section (export, cloud backup, clear)
- About section (version, privacy, terms)
- Sign Out button

---

## Design System

All tokens live in `constants/theme.ts`.

| Token | Value | Purpose |
|---|---|---|
| `Colors.background` | `#0A0A0F` | Near-black app background |
| `Colors.surface` | `#13131A` | Cards and panels |
| `Colors.primary` | `#E8FF3D` | Electric lime — main accent |
| `Colors.secondary` | `#FF4D4D` | Red — alerts and destructive actions |
| `Colors.success` | `#4CFF91` | Green — positive indicators |
| `Colors.tabBar` | `#0F0F18` | Bottom tab bar |
| `Colors.tabActive` | `#E8FF3D` | Active tab icon / label |

---

## Database — Firebase Firestore

> **Note**: Tizi has migrated to Firestore. See [docs/googlesheets.md](docs/googlesheets.md) for the legacy setup documentation.

---

## API Routes

All routes are Expo API Routes (`+api.ts` files) running server-side.

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/exercises` | List / create exercises |
| `GET/POST` | `/api/routines` | List / create routines |
| `PATCH/DELETE` | `/api/routines/:id` | Update / delete routine (cascade) |
| `GET/POST/PATCH/DELETE` | `/api/routine-exercises` | Manage exercise-to-routine links |
| `POST` | `/api/csv-upload` | Bulk import from CSV |
| `GET/POST` | `/api/logs` | Fetch history / save workout logs |
| `GET` | `/api/progress` | Exercises + logs combined (used by Progress screen) |
| `GET` | `/api/test-sheets` | Sheets connection health check |

📖 **[Full API reference → docs/workouts.md#api-routes](docs/workouts.md#api-routes)**

---

## CSV Bulk Import

Upload a `.csv` file from the Workouts screen header (cloud-upload icon). Required columns:

```
routine_name, day_of_week, exercise_name, muscle_group, sets, reps
```

The import deduplicates against existing data and shows a summary (rows parsed, new routines/exercises/links added).

📖 **[Full CSV docs → docs/workouts.md#csv-bulk-import](docs/workouts.md#csv-bulk-import)**

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Firebase

Add your Firebase project credentials to `.env` (values come from the Firebase Console → Project Settings → Your apps):

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

📖 **[Firebase setup guide → docs/firebase.md](docs/firebase.md)**

### 3. Run the app

```bash
npx expo start --clear
```

Options:
- **iOS Simulator** — press `i`
- **Android Emulator** — press `a`
- **Expo Go** — scan the QR code
- **Web** — press `w`

### 4. Verify the connection

```bash
curl http://localhost:8081/api/test-sheets
# → { "success": true, "message": "Connection to Firestore successful" }
```
