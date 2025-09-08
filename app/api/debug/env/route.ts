export const runtime = 'nodejs';

function parseDb(urlStr?: string) {
  try {
    if (!urlStr) return { set: false } as any;
    const u = new URL(urlStr);
    const [user, pwd] = (u.username || '').split(':');
    const host = u.hostname;
    const port = u.port;
    const db = (u.pathname || '').replace(/^\//, '');
    return {
      set: true,
      protocol: u.protocol.replace(':',''),
      user: user || u.username || 'postgres',
      host,
      port,
      db,
      // ヘッダのみ（PWは出さない）
      head: urlStr.slice(0, Math.min(60, urlStr.length))
    };
  } catch {
    return { set: true, parseError: true } as any;
  }
}

export async function GET() {
  const db = parseDb(process.env.DATABASE_URL);
  const direct = parseDb(process.env.DIRECT_URL);
  return Response.json({
    DATABASE_URL: db,
    DIRECT_URL: direct,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || 'not set',
    STRAVA_CLIENT_ID: Boolean(process.env.STRAVA_CLIENT_ID),
    STRAVA_CLIENT_SECRET: Boolean(process.env.STRAVA_CLIENT_SECRET),
    GOOGLE_AI_API_KEY: Boolean(process.env.GOOGLE_AI_API_KEY),
    region: process.env.VERCEL_REGION || 'unknown',
    node: process.version,
    notes: 'userは常にpostgresである必要があります。hostはdb.<ref>.supabase.co:5432が直結です。'
  });
}


