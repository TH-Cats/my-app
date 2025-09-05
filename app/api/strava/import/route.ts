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

export async function POST(request: NextRequest) {
  try {
    const { athleteId, limit = 30 } = await request.json().catch(() => ({}));
    if (!athleteId) {
      return Response.json({ error: 'athleteId required' }, { status: 400 });
    }

    // We stored user using synthetic email `strava_${athleteId}@example.local`
    const lookupEmail = `strava_${athleteId}@example.local`;
    const found = await getStravaAccount(lookupEmail);
    if (!found) {
      return Response.json({ error: 'Strava account not found in DB' }, { status: 404 });
    }

    const { user, account } = found;
    const accessToken = account.accessToken;

    // Fetch recent activities from Strava
    const activitiesRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const activities = await activitiesRes.json();
    if (!activitiesRes.ok) {
      return Response.json({ error: 'Failed to fetch activities', detail: activities?.message }, { status: 400 });
    }

    let created = 0;
    for (const a of activities as any[]) {
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
      } catch (e) {
        // skip errors per-activity
      }
    }

    return Response.json({ ok: true, imported: created });
  } catch (e) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}


