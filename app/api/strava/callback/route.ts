import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
export const runtime = 'nodejs';

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

    const athleteId = String(tokenData.athlete?.id ?? '');
    if (!athleteId) {
      return Response.json({ error: 'Missing athlete id' }, { status: 400 });
    }

    // Upsert a demo user for now (email unknown) and save tokens
    const user = await prisma.user.upsert({
      where: { email: `strava_${athleteId}@example.local` },
      update: {},
      create: { email: `strava_${athleteId}@example.local` },
    });

    await prisma.providerAccount.upsert({
      where: { provider_providerUserId: { provider: 'strava', providerUserId: athleteId } },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at * 1000) : null,
        userId: user.id,
      },
      create: {
        provider: 'strava',
        providerUserId: athleteId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at * 1000) : null,
        userId: user.id,
      },
    });
    // 接続直後に過去データのインポートをバックグラウンドで起動し、ホームへリダイレクト
    // 常に現在のオリジンを使用（クロスプロジェクト回避）
    const baseUrl = new URL(request.url).origin;
    try {
      fetch(`${baseUrl}/api/strava/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteId, years: 2 })
      }).catch(()=>{});
    } catch {}

    return Response.redirect(`${baseUrl}/?strava=connected&athleteId=${encodeURIComponent(athleteId)}`);
  } catch (e) {
    const message = (e as Error)?.message || 'Unknown error';
    console.error('Strava callback error:', message);
    return Response.json({ error: 'Internal server error', detail: message }, { status: 500 });
  }
}


