/**
 * Expo API Route: GET /api/test-sheets
 *
 * Runs the Firestore connection test server-side and returns the result.
 * Accessible during development at: http://localhost:8081/api/test-sheets
 */

import { testConnection } from '@/services/firestore';

export async function GET() {
  try {
    await testConnection();
    return Response.json({ success: true, message: 'Connection to Firestore successful' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ success: false, message }, { status: 500 });
  }
}
