export const runtime = 'nodejs';

export async function GET() {
  const athleteId = process.env.STRAVA_DEFAULT_ATHLETE_ID;
  if (!athleteId) {
    return Response.json({ ok: false, error: 'STRAVA_DEFAULT_ATHLETE_ID not set' }, { status: 400 });
  }
  const res = await fetch(`${process.env.PUBLIC_BASE_URL || 'https://drc-trainer.vercel.app'}/api/strava/import?athleteId=${athleteId}&limit=30`, {
    cache: 'no-store',
  });
  const data = await res.json();
  return Response.json({ ok: res.ok, data });
}


