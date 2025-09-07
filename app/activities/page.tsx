'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface Activity {
  id: string;
  provider: string;
  providerId: string;
  type: string | null;
  startTime: Date | null;
  durationSec: number | null;
  distanceM: number | null;
  elevationM: number | null;
  avgHr: number | null;
  avgCadence: number | null;
  caloriesKcal: number | null;
  temperatureC: number | null;
  excludeFromLearning: boolean;
}

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

function formatDuration(sec?: number | null) {
  if (sec == null) return '-';
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function ActivitiesPageContent() {
  const searchParams = useSearchParams();
  const page = Number(searchParams.get('page') || '1');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    async function fetchActivities() {
      setLoading(true);
      try {
        const response = await fetch(`/api/activities?page=${page}`);
        const data = await response.json();
        setActivities(data.activities);
        setTotal(data.total);
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchActivities();
  }, [page]);

  const handleExcludeToggle = async (activityId: string, excludeFromLearning: boolean) => {
    try {
      const response = await fetch(`/api/activities/${activityId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ excludeFromLearning }),
      });
      if (response.ok) {
        // Update local state
        setActivities(activities.map(a =>
          a.id === activityId ? { ...a, excludeFromLearning } : a
        ));
      } else {
        console.error('Failed to update activity');
      }
    } catch (error) {
      console.error('Failed to update activity:', error);
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Activities</h1>
        <div className="text-sm text-gray-600">
          {total} activities total
        </div>
      </div>
      {loading ? (
        <div className="text-center py-8">
          <div className="text-gray-500">Loading activities...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {activities.map((a) => (
            <div key={a.id} className="border rounded p-4">
              <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                <div className="flex items-center gap-4">
                  <span>
                    {a.provider.toUpperCase()} #{a.providerId}
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={a.excludeFromLearning}
                      onChange={(e) => handleExcludeToggle(a.id, e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-xs">学習から除外</span>
                  </label>
                </div>
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

              {/* Primary metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div className="bg-blue-50 p-2 rounded">
                  <div className="text-xs text-gray-500">Distance</div>
                  <div className="font-semibold">{formatDistance(a.distanceM)}</div>
                </div>
                <div className="bg-green-50 p-2 rounded">
                  <div className="text-xs text-gray-500">Duration</div>
                  <div className="font-semibold">{formatDuration(a.durationSec)}</div>
                </div>
                <div className="bg-orange-50 p-2 rounded">
                  <div className="text-xs text-gray-500">Pace</div>
                  <div className="font-semibold">{formatPace(a.distanceM, a.durationSec)}</div>
                </div>
                <div className="bg-red-50 p-2 rounded">
                  <div className="text-xs text-gray-500">Avg HR</div>
                  <div className="font-semibold">{a.avgHr ?? '-'} {a.avgHr ? 'bpm' : ''}</div>
                </div>
              </div>

              {/* Secondary metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Elevation:</span> {a.elevationM ?? '-'} {a.elevationM ? 'm' : ''}
                </div>
                <div>
                  <span className="text-gray-500">Cadence:</span> {a.avgCadence ?? '-'} {a.avgCadence ? 'spm' : ''}
                </div>
                <div>
                  <span className="text-gray-500">Calories:</span> {a.caloriesKcal ?? '-'} {a.caloriesKcal ? 'kcal' : ''}
                </div>
                <div>
                  <span className="text-gray-500">Temp:</span> {a.temperatureC ?? '-'} {a.temperatureC ? '°C' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-center mt-8 space-x-4">
        <a
          className={`px-4 py-2 rounded-lg border transition-colors ${
            page <= 1
              ? 'pointer-events-none opacity-40 bg-gray-100'
              : 'hover:bg-gray-50 border-gray-300'
          }`}
          href={`/activities?page=${Math.max(1, page - 1)}`}
        >
          ← Previous
        </a>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Page</span>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded font-medium">
            {page}
          </span>
          <span className="text-sm text-gray-600">of {totalPages}</span>
        </div>

        <a
          className={`px-4 py-2 rounded-lg border transition-colors ${
            page >= totalPages
              ? 'pointer-events-none opacity-40 bg-gray-100'
              : 'hover:bg-gray-50 border-gray-300'
          }`}
          href={`/activities?page=${Math.min(totalPages, page + 1)}`}
        >
          Next →
        </a>
      </div>

      {/* Results info */}
      <div className="text-center text-sm text-gray-500 mt-4">
        Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} of {total} activities
      </div>
    </main>
  );
}

export default function ActivitiesPage() {
  return (
    <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
      <ActivitiesPageContent />
    </Suspense>
  );
}


