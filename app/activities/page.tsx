import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatDistance(m?: number | null) {
  if (m == null) return '-';
  return `${(m / 1000).toFixed(2)} km`;
}

function formatDate(d?: Date | null) {
  if (!d) return '-';
  return new Date(d).toLocaleString('ja-JP');
}

function formatPace(distanceM?: number | null, durationSec?: number | null) {
  if (!distanceM || !durationSec || distanceM === 0) return '-';
  const paceSecPerKm = durationSec / (distanceM / 1000);
  const m = Math.floor(paceSecPerKm / 60);
  const s = Math.round(paceSecPerKm % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s} /km`;
}

export default async function ActivitiesPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Number(searchParams?.page || '1');
  const pageSize = 20;
  const activities = await prisma.activity.findMany({
    orderBy: { startTime: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const total = await prisma.activity.count();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Activities</h1>
      <div className="grid grid-cols-1 gap-3">
        {activities.map((a) => (
          <div key={a.id} className="border rounded p-4">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                {a.provider.toUpperCase()} #{a.providerId}
              </span>
              {a.provider === 'strava' ? (
                <a
                  className="underline hover:no-underline"
                  href={`https://www.strava.com/activities/${a.providerId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Strava ↗
                </a>
              ) : null}
            </div>
            <div className="font-semibold">{a.type ?? 'unknown'}</div>
            <div className="text-sm">{formatDate(a.startTime)} / {formatDistance(a.distanceM)}</div>
            <div className="text-sm grid grid-cols-3 gap-2 mt-1">
              <div>Pace: {formatPace(a.distanceM, a.durationSec)}</div>
              <div>HR: {a.avgHr ?? '-'} bpm</div>
              <div>Elev: {a.elevationM ?? '-'} m</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-6">
        <a
          className={`px-3 py-1 rounded border ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}
          href={`/activities?page=${Math.max(1, page - 1)}`}
        >
          ← Prev
        </a>
        <div className="text-sm text-gray-600">
          Page {page} / {totalPages}
        </div>
        <a
          className={`px-3 py-1 rounded border ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
          href={`/activities?page=${Math.min(totalPages, page + 1)}`}
        >
          Next →
        </a>
      </div>
    </main>
  );
}


