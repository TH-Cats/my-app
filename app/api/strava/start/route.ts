import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const baseUrl = process.env.PUBLIC_BASE_URL || new URL(request.url).origin;

  if (!clientId) {
    return Response.json({ error: 'STRAVA_CLIENT_ID not configured' }, { status: 500 });
  }

  const redirectUri = `${baseUrl}/api/strava/callback`;
  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=read,activity:read_all`;

  return Response.redirect(stravaAuthUrl);
}


