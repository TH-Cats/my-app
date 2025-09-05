import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return Response.json({ error: `COROS authorization failed: ${error}` }, { status: 400 });
  }
  if (!code) {
    return Response.json({ error: 'No authorization code received' }, { status: 400 });
  }

  const tokenUrl = process.env.COROS_OAUTH_TOKEN_URL;
  const clientId = process.env.COROS_CLIENT_ID;
  const clientSecret = process.env.COROS_CLIENT_SECRET;
  const baseUrl = process.env.PUBLIC_BASE_URL;

  if (!tokenUrl || !clientId || !clientSecret || !baseUrl) {
    return Response.json({ error: 'COROS OAuth is not configured (missing envs)' }, { status: 500 });
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${baseUrl}/api/coros/callback`,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return Response.json({ error: tokenData?.error || 'Token exchange failed' }, { status: 400 });
    }

    console.log('COROS TOKEN (demo):', {
      access_token: tokenData?.access_token?.substring(0, 8) + '...',
      refresh_token: tokenData?.refresh_token?.substring(0, 8) + '...',
      expires_in: tokenData?.expires_in,
    });

    return Response.json({ success: true, message: 'Connected to COROS ✅' });
  } catch (e) {
    console.error('COROS callback error', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}


