export const runtime = 'nodejs';

export async function GET() {
  const safe = (v?: string) => (v ? 'set' : 'missing');
  return Response.json({
    DATABASE_URL: safe(process.env.DATABASE_URL),
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || 'not set',
    STRAVA_CLIENT_ID: safe(process.env.STRAVA_CLIENT_ID),
    STRAVA_CLIENT_SECRET: safe(process.env.STRAVA_CLIENT_SECRET),
    GOOGLE_AI_API_KEY: safe(process.env.GOOGLE_AI_API_KEY),
    region: process.env.VERCEL_REGION || 'unknown',
    node: process.version
  });
}


