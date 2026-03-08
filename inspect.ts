import { getExercises, getLogs, getRoutines } from './services/firestore-rest';

async function run() {
  console.log('Fetching...');
  const logs = await getLogs();
  console.log('--- LOGS SAMPLE ---');
  console.log(logs.slice(0, 5));

  const ex = await getExercises();
  console.log('--- EXERCISES SAMPLE ---');
  console.log(ex.slice(0, 5));
}
run();
