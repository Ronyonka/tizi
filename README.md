# Tizi — Personal Gym Tracker

[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)]()
[![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)]()
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)]()

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
| Database | Firebase Firestore (JS SDK + REST API) |
| API layer | Expo API Routes (Node.js) using **Firestore REST API** |
| File import | `expo-document-picker` + `expo-file-system` |

---

## Features
- **Workout planning**: manual creation and CSV bulk import
- **Exercise library**: with muscle group tagging
- **Daily workout logging**: with sets, reps, and weight (KG)
- **Calendar view**: with streak tracking
- **Progress charts**: per exercise with 30D / 3M / All time filters
- **Push notifications**: for scheduled workouts

---

## Project Structure

```
app/
  _layout.tsx              # Root layout — forces dark theme
  (tabs)/
    _layout.tsx            # Bottom tab navigator (5 tabs)
    index.tsx              # Home screen (Realtime SDK reads)
    workouts.tsx           # Workouts screen (Realtime SDK reads)
    calendar.tsx           # Calendar screen
    progress.tsx           # Progress screen (Log deletion, Max Lift chart)
    settings.tsx           # Settings screen
  api/
    exercises+api.ts       # POST /api/exercises
    routines+api.ts        # POST /api/routines
    routines/
      [id]+api.ts          # PATCH /api/routines/:id, DELETE /api/routines/:id
    logs/
      [id]+api.ts          # DELETE /api/logs/:id
    progress+api.ts        # GET /api/progress (REST-based combined fetch)
    test-sheets+api.ts     # Health check (REST-based)

config/
  firebase.ts              # Firestore collection name constants

services/
  firebase.ts              # Firebase SDK init
  firestore.ts             # Client-side SDK helpers (listeners)
  firestore-rest.ts        # Server-side REST helpers (reliable writes)

constants/
  theme.ts                 # Dark gym-style design system
```

---

## Screenshots

*(Placeholder: Screenshots to be added later)*

---

## Environment Variables

A `.env.example` file is provided in the repository with the following required variables:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

---

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Tizi
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Copy the `.env.example` file to `.env` and fill in your Firebase credentials.
   ```bash
   cp .env.example .env
   ```
   📖 **[Firebase setup guide → docs/firebase.md](docs/firebase.md)**

4. **Run the app locally**
   ```bash
   npx expo start --clear
   ```
   Options:
   - **iOS Simulator** — press `i`
   - **Android Emulator** — press `a`
   - **Expo Go** — scan the QR code

5. **Verify the connection**
   ```bash
   curl http://localhost:8081/api/test-sheets
   ```

---

## Build Instructions (Android APK)

To build a sideloadable APK for Android using Expo Application Services (EAS):

```bash
eas build -p android --profile preview
```

---

## API Routes & Documentation

- 📖 **[Full API reference & Workouts docs → docs/workouts.md](docs/workouts.md)**
- 📖 **[CSV Bulk Import format → docs/workouts.md#csv-bulk-import](docs/workouts.md#csv-bulk-import)**
