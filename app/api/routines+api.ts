/**
 * Expo API Route: /api/routines
 * GET  — list all routines
 * POST — create a new routine
 */

import {
    appendRoutine,
    getRoutines,
} from '@/services/googleSheets';

export async function GET() {
  try {
    const routines = await getRoutines();
    return Response.json(routines);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, day_of_week } = body as { name: string; day_of_week: string };

    if (!name || !day_of_week) {
      return Response.json({ error: 'name and day_of_week are required' }, { status: 400 });
    }

    const id = `routine_${Date.now()}`;
    const routine = { id, name: name.trim(), day_of_week: day_of_week.trim() };
    await appendRoutine(routine);
    return Response.json(routine, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
