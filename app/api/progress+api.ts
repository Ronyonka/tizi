/**
 * Expo API Route: /api/progress
 * GET — returns all exercises and all logs in a single response
 *       so the Progress screen only needs one round-trip.
 */

import { getExercises, getLogs } from '@/services/firestore-rest';

export async function GET() {
  try {
    const [exercises, logs] = await Promise.all([
      getExercises(),
      getLogs(),
    ]);

    return Response.json({ exercises, logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
