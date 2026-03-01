/**
 * Expo API Route: /api/logs
 * POST — save multiple exercise logs
 */

import { batchAppendLogs, getLogs, Log } from '@/services/firestore';

export async function GET() {
  try {
    const logs = await getLogs();
    return Response.json(logs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { logs } = body as { logs: (Omit<Log, 'id'> & { id?: string })[] };

    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      return Response.json({ error: 'logs array is required' }, { status: 400 });
    }

    await batchAppendLogs(logs);
    return Response.json({ success: true, count: logs.length }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
