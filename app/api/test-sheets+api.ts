import { testConnection } from '@/services/firestore-rest';

export async function GET() {
  try {
    await testConnection();
    return Response.json({
      success: true,
      message: 'Connection successful via Firestore REST API',
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({
      success: false,
      message: `Firestore REST connection failed: ${message}`,
    }, { status: 500 });
  }
}
