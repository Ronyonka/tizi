import * as dotenv from 'dotenv';
import { getExercises, getLogs } from './services/firestore-rest';
dotenv.config();
dotenv.config({ path: '.env.local' });

async function run() {
  console.log('Fetching from Firebase Project ID:', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
  
  try {
    const logs = await getLogs();
    console.log('--- LOGS SAMPLE ---');
    console.log(logs.slice(0, 3));

    const ex = await getExercises();
    console.log('--- EXERCISES SAMPLE ---');
    console.log(ex.slice(0, 3));
  } catch (err) {
    console.error('Error fetching data:', err);
  }
}

run();
