/**
 * Expo API Route: /api/routines/[id]
 * PATCH  — update routine name and/or day_of_week
 * DELETE — delete a routine and all its routine_exercise links
 */

import {
    deleteAllRoutineExercisesForRoutine,
    deleteRoutine,
    updateRoutine,
} from '@/services/firestore';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const body = await request.json();
    const { name, day_of_week } = body as { name?: string; day_of_week?: string };
    await updateRoutine(id, { name, day_of_week });
    return Response.json({ success: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    // First delete all associated routine_exercises to avoid orphan rows
    await deleteAllRoutineExercisesForRoutine(id);
    // Then delete the routine itself
    await deleteRoutine(id);
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
