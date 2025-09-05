import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatDistance(m?: number | null) {
  if (!m && m !== 0) return '-';
  return `${(m / 1000).toFixed(2)} km`;
}

function formatDate(d?: Date | null) {
  if (!d) return '-';
  return new Date(d).toLocaleString('ja-JP');
}

export default async function ActivitiesPage() {
  const activities = await prisma.activity.findMany({
    orderBy: { startTime: 'desc' },
    take: 50,
  });

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Activities</h1>
      <div className="grid grid-cols-1 gap-3">
        {activities.map((a) => (
          <div key={a.id} className="border rounded p-4">
            <div className="text-sm text-gray-500">{a.provider.toUpperCase()} #{a.providerId}</div>
            <div className="font-semibold">{a.type ?? 'unknown'}</div>
            <div className="text-sm">{formatDate(a.startTime)} / {formatDistance(a.distanceM)}</div>
            {a.durationSec ? (
              <div className="text-sm">Time: {(a.durationSec / 60).toFixed(1)} min</div>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}


