import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const clientId = process.env.STRAVA_CLIENT_ID || '';
  const clientSecret = process.env.STRAVA_CLIENT_SECRET || '';
  const baseUrl = new URL(request.url).origin;
  const redirectUri = `${baseUrl}/api/strava/callback`;
  const authorizeUrl = clientId
    ? `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=read,activity:read_all`
    : null;

  let networkOk = false;
  let stravaStatus: number | null = null;
  try {
    const resp = await fetch('https://www.strava.com', { method: 'HEAD' });
    stravaStatus = resp.status;
    networkOk = resp.ok || (resp.status >= 200 && resp.status < 400);
  } catch {
    networkOk = false;
  }

  return Response.json({
    networkOk,
    stravaStatus,
    oauthConfigured: Boolean(clientId && clientSecret),
    redirectUri,
    authorizeUrl,
  });
}


