/**
 * Expo API Route: /api/routine-exercises
 * GET    ?routineId=x  — list all routine-exercise links (optionally filtered)
 * POST   — add an exercise to a routine
 * PATCH  — update sets/reps for a routine-exercise link
 * DELETE — remove an exercise from a routine
 */

import {
    appendRoutineExercise,
    deleteRoutineExercise,
    getRoutineExercises,
    updateRoutineExercise,
} from '@/services/firestore-rest';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const routineId = url.searchParams.get('routineId');
    const all = await getRoutineExercises();
    const result = routineId ? all.filter((re) => re.routine_id === routineId) : all;
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { routine_id, exercise_id, sets, reps } = body as {
      routine_id: string;
      exercise_id: string;
      sets: string;
      reps: string;
    };

    if (!routine_id || !exercise_id) {
      return Response.json({ error: 'routine_id and exercise_id are required' }, { status: 400 });
    }

    const re = { routine_id, exercise_id, sets: String(sets), reps: String(reps) };
    await appendRoutineExercise(re);
    return Response.json(re, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { routine_id, exercise_id, sets, reps } = body as {
      routine_id: string;
      exercise_id: string;
      sets: string;
      reps: string;
    };

    await updateRoutineExercise(routine_id, exercise_id, String(sets), String(reps));
    return Response.json({ routine_id, exercise_id, sets, reps });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { routine_id, exercise_id } = body as {
      routine_id: string;
      exercise_id: string;
    };

    await deleteRoutineExercise(routine_id, exercise_id);
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
