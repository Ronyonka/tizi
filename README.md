# Tizi — Personal Gym Tracker

[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)]()
[![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)]()
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)]()

A React Native / Expo workout tracker with a dark gym-style UI. Workouts and exercises are persisted to **Firebase Firestore**. The Firebase JS SDK runs completely client-side.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Expo](https://expo.dev) (SDK 54) with Expo Router (file-based routing) |
| Language | TypeScript |
| Navigation | React Navigation — bottom tab navigator via `expo-router` Tabs |
| UI | React Native (Vanilla StyleSheet, no Tailwind) |
| Icons | `@expo/vector-icons` — Ionicons |
| Database | Firebase Firestore (Realtime JS SDK) |
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

config/
  firebase.ts              # Firebase app configuration constants

services/
  firebase.ts              # Firebase SDK init
  firestore.ts             # Client-side Firestore SDK helpers

constants/
  theme.ts                 # Dark gym-style design system
```

---

## Screenshots

*(Placeholder: Screenshots to be added later)*

---

## Environment Variables

A `.env.example` file is provided. You should create a `.env.local` for running the app locally. Wait to configure production credentials before running the EAS commands.

Required variables:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
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
   Copy the `.env.example` file to `.env.local` and fill in your Firebase credentials.
   ```bash
   cp .env.example .env.local
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
   Press "Test Connection" from within the application's Settings tab to ensure you're securely hitting the Firebase DB.

---

## Build Instructions (Android APK)

To build a sideloadable APK for Android using Expo Application Services (EAS):

1. **Push Environment Secrets First**
   Ensure your `.env.local` has your true API keys, and map them to EAS so they're injected securely during compilation.
   ```bash
   eas env:push --environment production
   ```

2. **Run The Build**
   ```bash
   eas build -p android --profile preview
   ```

---

## API Routes & Documentation

- 📖 **[Full API reference & Workouts docs → docs/workouts.md](docs/workouts.md)**
- 📖 **[CSV Bulk Import format → docs/workouts.md#csv-bulk-import](docs/workouts.md#csv-bulk-import)**
