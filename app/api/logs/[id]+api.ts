/**
 * Expo API Route: /api/logs/[id]
 * DELETE — delete a specific workout log
 */


// Note: restDelete is not exported in firestore-rest.ts, I should check if I need it or use restDelete internal helper.
// Looking at firestore-rest.ts, I see `restDelete` is internal. 
// I'll check if I should add a wrapper or export it.

import { deleteLog } from '@/services/firestore-rest';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  let id = params?.id;

  // Fallback: Extract from URL if params is undefined (Expo Router quirk)
  if (!id) {
    const url = new URL(request.url);
    id = url.pathname.split('/').pop() || '';
  }

  if (!id || id === 'logs' || id === '[id]') {
    console.error(`[API] /api/logs/[id] DELETE: Invalid ID "${id}"`, { 
      params, 
      url: request.url 
    });
    return Response.json({ error: 'Valid Log ID is required' }, { status: 400 });
  }

  try {
    await deleteLog(id);
    return Response.json({ success: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
