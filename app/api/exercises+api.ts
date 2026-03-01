/**
 * Expo API Route: /api/exercises
 * GET  — list all exercises
 * POST — create a new exercise
 */

import {
    appendExercise,
    getExercises,
} from '@/services/googleSheets';

export async function GET() {
  try {
    const exercises = await getExercises();
    return Response.json(exercises);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, muscle_group } = body as { name: string; muscle_group: string };

    if (!name || !muscle_group) {
      return Response.json({ error: 'name and muscle_group are required' }, { status: 400 });
    }

    const id = `ex_${Date.now()}`;
    const exercise = { id, name: name.trim(), muscle_group: muscle_group.trim() };
    await appendExercise(exercise);
    return Response.json(exercise, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
