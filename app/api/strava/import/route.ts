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

async function importForAthlete(athleteId: string, limitOrYears: number) {
  const lookupEmail = `strava_${athleteId}@example.local`;
  const found = await getStravaAccount(lookupEmail);
  if (!found) {
    return Response.json({ error: 'Strava account not found in DB' }, { status: 404 });
  }
  const { user, account } = found;
  const accessToken = account.accessToken;
  // Treat the second argument as years if >= 5, otherwise as per_page limit for legacy use
  const years = limitOrYears && limitOrYears > 100 ? 2 : 2; // default 2 years
  const afterEpoch = Math.floor((Date.now() - years * 365 * 24 * 3600 * 1000) / 1000);
  let page = 1;
  const perPage = 200; // Strava max
  let created = 0;
  while (true) {
    const url = `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}&after=${afterEpoch}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const activities = await res.json();
    if (!res.ok) {
      return Response.json({ error: 'Failed to fetch activities', detail: activities?.message }, { status: 400 });
    }
    if (!Array.isArray(activities) || activities.length === 0) break;
    for (const a of activities as any[]) {
      const sport = (a.sport_type || a.type || '').toLowerCase();
      if (sport === 'walk' || sport === 'walking') continue; // exclude walking
      try {
        await prisma.activity.upsert({
          where: { provider_providerId: { provider: 'strava', providerId: String(a.id) } },
          update: {
            type: a.sport_type || a.type || null,
            startTime: a.start_date ? new Date(a.start_date) : null,
            durationSec: a.elapsed_time ?? null,
            distanceM: a.distance ? Math.round(a.distance) : null,
            elevationM: a.total_elevation_gain ? Math.round(a.total_elevation_gain) : null,
            avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
            avgCadence: a.average_cadence ? Math.round(a.average_cadence) : null,
            caloriesKcal: a.calories ? Math.round(a.calories) : null,
            raw: a,
          },
          create: {
            provider: 'strava',
            providerId: String(a.id),
            userId: user.id,
            type: a.sport_type || a.type || null,
            startTime: a.start_date ? new Date(a.start_date) : null,
            durationSec: a.elapsed_time ?? null,
            distanceM: a.distance ? Math.round(a.distance) : null,
            elevationM: a.total_elevation_gain ? Math.round(a.total_elevation_gain) : null,
            avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
            avgCadence: a.average_cadence ? Math.round(a.average_cadence) : null,
            caloriesKcal: a.calories ? Math.round(a.calories) : null,
            raw: a,
          },
        });
        created += 1;
      } catch {}
    }
    if (activities.length < perPage) break;
    page += 1;
    if (page > 50) break; // safety
  }
  return Response.json({ ok: true, imported: created, range: { years } });
}

export async function POST(request: NextRequest) {
  try {
    const { athleteId, years = 2 } = await request.json().catch(() => ({}));
    if (athleteId) {
      return importForAthlete(String(athleteId), Number(years ?? 2));
    }
    // default account
    const def = await resolveAccountByDefault();
    if (!def) return Response.json({ error: 'No Strava account connected' }, { status: 404 });
    return importForAthlete(def.account.providerUserId, Number(years ?? 2));
  } catch (e) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const athleteId = url.searchParams.get('athleteId');
    const years = Number(url.searchParams.get('years') || '2');
    if (athleteId) return importForAthlete(athleteId, years);
    const def = await resolveAccountByDefault();
    if (!def) return Response.json({ error: 'No Strava account connected' }, { status: 404 });
    return importForAthlete(def.account.providerUserId, years);
  } catch (e) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}


