import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return Response.json({ error: `Strava authorization failed: ${error}` }, { status: 400 });
  }
  if (!code) {
    return Response.json({ error: 'No authorization code received' }, { status: 400 });
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json({ error: 'Strava credentials not configured' }, { status: 500 });
  }

  try {
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return Response.json({ error: tokenData?.message || 'Token exchange failed' }, { status: 400 });
    }

    console.log('STRAVA TOKEN (demo):', {
      access_token: tokenData.access_token?.substring(0, 10) + '...',
      refresh_token: tokenData.refresh_token?.substring(0, 10) + '...',
      athlete_id: tokenData.athlete?.id,
    });

    return Response.json({ success: true, message: 'Connected to Strava ✅' });
  } catch (e) {
    console.error('Strava callback error:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}


