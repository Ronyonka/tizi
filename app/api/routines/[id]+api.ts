/**
 * Expo API Route: /api/routines/[id]
 * PATCH  — update routine name and/or day_of_week
 * DELETE — delete a routine and all its routine_exercise links
 */

import {
    deleteAllRoutineExercisesForRoutine,
    deleteRoutine,
    updateRoutine,
} from '@/services/firestore-rest';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let id = params?.id;
  
  // Fallback: Extract from URL if params is undefined (Expo Router quirk)
  if (!id) {
    const url = new URL(request.url);
    id = url.pathname.split('/').pop() || '';
  }

  if (!id || id === 'routines' || id === '[id]') {
    console.error(`[API] /api/routines/[id] PATCH: Invalid ID "${id}"`, { 
      params, 
      url: request.url,
      pathname: new URL(request.url).pathname 
    });
    return Response.json({ error: 'Valid Routine ID is required' }, { status: 400 });
  }

  console.log(`[API] PATCH /api/routines/${id}`);

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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  let id = params?.id;

  // Fallback: Extract from URL if params is undefined (Expo Router quirk)
  if (!id) {
    const url = new URL(request.url);
    id = url.pathname.split('/').pop() || '';
  }

  if (!id || id === 'routines' || id === '[id]') {
    console.error(`[API] /api/routines/[id] DELETE: Invalid ID "${id}"`, { 
      params, 
      url: request.url,
      pathname: new URL(request.url).pathname 
    });
    return Response.json({ error: 'Valid Routine ID is required' }, { status: 400 });
  }

  console.log(`[API] DELETE /api/routines/${id}`);

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
