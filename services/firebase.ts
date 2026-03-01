import { getApps, initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Prevent re-initialising when hot-reloading in Expo Go
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

/**
 * For Expo API Routes (Node.js), we use forceLongPolling to avoid gRPC/WebSocket 
 * hangs in the server environment. This is more reliable for server-side 
 * modular Firestore SDK usage in the local dev server.
 */
export const db = initializeFirestore(app, {
  // localCache: memoryLocalCache(), // Test if cache is causing hangs
  experimentalForceLongPolling: true,
});

export default app;
