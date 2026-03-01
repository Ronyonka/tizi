# Tizi — Gym Tracker App

A React Native / Expo workout tracker with a dark gym-style UI. Workouts and exercises are persisted to a **Google Sheets spreadsheet** via server-side Expo API routes — no custom backend required.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Expo](https://expo.dev) (SDK 54) with Expo Router (file-based routing) |
| Language | TypeScript |
| Navigation | React Navigation — bottom tab navigator via `expo-router` Tabs |
| UI | React Native (Vanilla StyleSheet, no Tailwind) |
| Icons | `@expo/vector-icons` — Ionicons |
| Database | Google Sheets (via `googleapis` Node.js SDK) |
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
    test-sheets+api.ts     # GET /api/test-sheets (connection health check)

config/
  googleSheets.ts          # Sheet tab names, column definitions, env validation

services/
  googleSheets.ts          # Typed Google Sheets read/write service

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
- Time range selector (1W / 1M / 3M / 6M / 1Y / All)
- 2-column stats grid (Total Volume, Workouts, Exercises, Training Days)
- Weekly volume bar chart
- Personal Records (PR) list automatically tracked

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

## Google Sheets Database

Tizi uses a Google Sheets spreadsheet as its database. Routines, exercises, and logs are stored across 4 tabs (`Exercises`, `Routines`, `Routine_Exercises`, `Logs`). All reads and writes happen **server-side** inside Expo API routes using a service account — credentials are never exposed to the client bundle.

📖 **[Full setup guide → docs/googlesheets.md](docs/googlesheets.md)**

This covers: creating a GCP project, enabling the Sheets API, creating a service account, setting up the spreadsheet schema, configuring `.env`, and verifying the connection.

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

### 2. Configure Google Sheets

Create a service account, share the spreadsheet, and add credentials to `.env`.

📖 **[Full Google Sheets setup guide → docs/googlesheets.md](docs/googlesheets.md)**

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
# → { "success": true, "message": "Connection to Google Sheets successful" }
```
