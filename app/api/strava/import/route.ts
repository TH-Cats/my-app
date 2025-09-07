import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

async function getStravaAccount(userEmail: string) {
  const user = await prisma.user.findUnique({ where: { email: userEmail }, include: { accounts: true } });
  if (!user) return null;
  const account = user.accounts.find(a => a.provider === 'strava');
  if (!account) return null;
  return { user, account } as const;
}

async function resolveAccountByDefault() {
  // 1) env 既定のathleteId
  const def = process.env.STRAVA_DEFAULT_ATHLETE_ID;
  if (def) {
    const viaEnv = await getStravaAccount(`strava_${def}@example.local`);
    if (viaEnv) return viaEnv;
  }
  // 2) DB上で最初のStravaアカウント
  const prov = await prisma.providerAccount.findFirst({
    where: { provider: 'strava' },
    orderBy: { updatedAt: 'desc' },
  });
  if (!prov) return null;
  const user = await prisma.user.findUnique({ where: { id: prov.userId } });
  if (!user) return null;
  return { user, account: prov } as const;
}

async function importForAthlete(athleteId: string, limitOrYears: number, startPage = 1, maxPages = 1) {
  // Prefer direct provider account lookup
  let user = null as any;
  let account = await prisma.providerAccount.findUnique({
    where: { provider_providerUserId: { provider: 'strava', providerUserId: String(athleteId) } },
  });
  if (account) {
    user = await prisma.user.findUnique({ where: { id: account.userId } });
  }
  if (!account || !user) {
    // Fallback to legacy email mapping if needed
    const legacyEmail = `strava_${athleteId}@example.local`;
    const legacy = await getStravaAccount(legacyEmail);
    if (!legacy) {
      return Response.json({ error: 'Strava account not found in DB', suggestion: '設定から再度Strava連携を実行してください' }, { status: 404 });
    }
    user = legacy.user;
    account = legacy.account as any;
  }
  if (!account) {
    return Response.json({ error: 'Strava account not found after lookup' }, { status: 404 });
  }
  const accessToken = account.accessToken;

  // トークンの有効性を確認（タイムアウト付き）
  console.log('Checking token validity...');
  let testRes: Response;
  try {
    testRes = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000) // 15s timeout
    });
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError';
    console.error('Token validation request failed:', err);
    return Response.json({
      error: isTimeout ? 'Request timeout when contacting Strava (token check)' : 'Failed to contact Strava (token check)',
      suggestion: 'Please retry connecting your Strava account',
    }, { status: isTimeout ? 408 : 502 });
  }

  if (!testRes.ok) {
    console.error('Token validation failed:', testRes.status, testRes.statusText);
    // アクセストークンの自動リフレッシュ（401時）
    if (testRes.status === 401 && account.refreshToken) {
      try {
        const clientId = process.env.STRAVA_CLIENT_ID;
        const clientSecret = process.env.STRAVA_CLIENT_SECRET;
        if (!clientId || !clientSecret) throw new Error('Strava credentials not configured');
        const refreshResp = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: account.refreshToken,
          })
        });
        const refreshData = await refreshResp.json();
        if (refreshResp.ok && refreshData?.access_token) {
          await prisma.providerAccount.update({
            where: { provider_providerUserId: { provider: 'strava', providerUserId: String(athleteId) } },
            data: {
              accessToken: refreshData.access_token,
              refreshToken: refreshData.refresh_token ?? account.refreshToken,
              expiresAt: refreshData.expires_at ? new Date(refreshData.expires_at * 1000) : account.expiresAt ?? null,
            }
          });
          // リフレッシュ後に再実行
          return importForAthlete(athleteId, limitOrYears);
        }
        console.error('Refresh failed:', refreshData);
      } catch (err) {
        console.error('Token refresh error:', err);
      }
    }
    return Response.json({
      error: 'Strava access token is invalid or expired',
      status: testRes.status,
      suggestion: 'Please reconnect your Strava account'
    }, { status: 401 });
  }

  const athlete = await testRes.json();
  console.log('Token valid, athlete:', athlete.id, athlete.username);
  // Treat the second argument as years if >= 5, otherwise as per_page limit for legacy use
  const years = limitOrYears && limitOrYears > 100 ? 2 : 2; // default 2 years
  const afterEpoch = Math.floor((Date.now() - years * 365 * 24 * 3600 * 1000) / 1000);
  let page = Math.max(1, startPage);
  const perPage = 200; // Strava max
  let created = 0;
  let processedPages = 0;
  let lastBatchLen = 0;
  while (true) {
    const url = `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}&after=${afterEpoch}`;
    console.log('Fetching Strava activities:', { url, page, afterEpoch });

    let res;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });
    } catch (fetchError) {
      if ((fetchError as any)?.name === 'TimeoutError') {
        return Response.json({
          error: 'Request timeout - Strava API took too long to respond',
          suggestion: 'Try again later or reduce the date range'
        }, { status: 408 });
      }
      console.error('Fetch activities failed:', fetchError);
      return Response.json({ error: 'Failed to fetch from Strava', detail: (fetchError as any)?.message || String(fetchError) }, { status: 502 });
    }

    console.log('Strava API response:', { status: res.status, statusText: res.statusText });

    let activities;
    try {
      const responseText = await res.text();
      console.log('Raw response preview:', responseText.substring(0, 200));

      if (!res.ok) {
        // レート制限の場合
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          return Response.json({
            error: 'Strava API rate limit exceeded',
            retryAfter: retryAfter ? `${retryAfter} seconds` : 'unknown',
            suggestion: 'Please wait before retrying'
          }, { status: 429 });
        }

        return Response.json({
          error: 'Failed to fetch activities',
          status: res.status,
          statusText: res.statusText,
          response: responseText.substring(0, 500)
        }, { status: 400 });
      }

      activities = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return Response.json({
        error: 'Invalid response from Strava API',
        parseError: (parseError as any).message
      }, { status: 502 });
    }
    if (!Array.isArray(activities) || activities.length === 0) { lastBatchLen = 0; break; }
    lastBatchLen = activities.length;
    for (const a of activities as any[]) {
      const sport = (a.sport_type || a.type || '').toLowerCase();
      if (sport === 'walk' || sport === 'walking') continue; // exclude walking

      try {
        // アクティビティデータの検証
        if (!a.id) {
          console.warn('Skipping activity without ID:', a);
          continue;
        }

        const activityData = {
          type: a.sport_type || a.type || null,
          startTime: a.start_date ? new Date(a.start_date) : null,
          durationSec: a.elapsed_time ?? null,
          distanceM: a.distance ? Math.round(a.distance) : null,
          elevationM: a.total_elevation_gain ? Math.round(a.total_elevation_gain) : null,
          avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
          avgCadence: a.average_cadence ? Math.round(a.average_cadence) : null,
          caloriesKcal: a.calories ? Math.round(a.calories) : null,
          raw: a,
        };

        await prisma.activity.upsert({
          where: { provider_providerId: { provider: 'strava', providerId: String(a.id) } },
          update: activityData,
          create: {
            provider: 'strava',
            providerId: String(a.id),
            userId: user.id,
            ...activityData,
          },
        });

        created += 1;

        // 進捗表示（100件ごとに）
        if (created % 100 === 0) {
          console.log(`Processed ${created} activities...`);
        }

      } catch (dbError) {
        console.error('Database error for activity', a.id, ':', dbError);
        // データベースエラーの場合も処理を継続
      }
    }
    processedPages += 1;
    if (activities.length < perPage) break;
    if (processedPages >= Math.max(1, maxPages)) break;
    page += 1;
    if (page > 50) break; // safety
  }
  const hasMore = lastBatchLen === perPage && page < 50;
  return Response.json({ ok: true, imported: created, range: { years }, nextPage: page + 1, hasMore });
}

export async function POST(request: NextRequest) {
  try {
    const { athleteId, years = 2, startPage = 1, maxPages = 1 } = await request.json().catch(() => ({}));
    if (athleteId) {
      return importForAthlete(String(athleteId), Number(years ?? 2), Number(startPage ?? 1), Number(maxPages ?? 1));
    }
    // default account
    const def = await resolveAccountByDefault();
    if (!def) return Response.json({ error: 'No Strava account connected' }, { status: 404 });
    return importForAthlete(def.account.providerUserId, Number(years ?? 2), Number(startPage ?? 1), Number(maxPages ?? 1));
  } catch (e) {
    console.error('Import POST error:', e);
    return Response.json({ error: 'Internal server error', detail: (e as any)?.message || String(e) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const athleteId = url.searchParams.get('athleteId');
    const years = Number(url.searchParams.get('years') || '2');
    const startPage = Number(url.searchParams.get('startPage') || '1');
    const maxPages = Number(url.searchParams.get('maxPages') || '1');
    if (athleteId) return importForAthlete(athleteId, years, startPage, maxPages);
    const def = await resolveAccountByDefault();
    if (!def) return Response.json({ error: 'No Strava account connected' }, { status: 404 });
    return importForAthlete(def.account.providerUserId, years, startPage, maxPages);
  } catch (e) {
    console.error('Import GET error:', e);
    return Response.json({ error: 'Internal server error', detail: (e as any)?.message || String(e) }, { status: 500 });
  }
}


