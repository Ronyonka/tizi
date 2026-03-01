/**
 * Expo API Route: GET /api/test-sheets
 *
 * Runs the Google Sheets connection test server-side and returns the result.
 * Accessible during development at: http://localhost:8081/api/test-sheets
 */

import { testConnection } from '@/services/googleSheets';

export async function GET() {
  try {
    await testConnection();
    return Response.json({ success: true, message: 'Connection to Google Sheets successful' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ success: false, message }, { status: 500 });
  }
}
