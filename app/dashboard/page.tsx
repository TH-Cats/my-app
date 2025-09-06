import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ZoneKey =
  | 'recovery'
  | 'aerobic_endurance'
  | 'aerobic_power'
  | 'lactate_threshold'
  | 'anaerobic_endurance'
  | 'anaerobic_power';

const ZONE_LABEL: Record<ZoneKey, string> = {
  recovery: 'リカバリー',
  aerobic_endurance: '有酸素持久力ゾーン',
  aerobic_power: '有酸素パワーゾーン',
  lactate_threshold: '乳酸閾値ゾーン',
  anaerobic_endurance: '無酸素持久力ゾーン',
  anaerobic_power: '無酸素パワーゾーン',
};

// NOTE: 暫定しきい値。後で UserSettings の HRmax/LTHR から計算に差し替えます。
// ここでは LTHR ベースの簡易境界を仮置きします。
function getZoneByAvgHr(avgHr: number | null | undefined, lthr = 160) : ZoneKey | null {
  if (!avgHr) return null;
  const r = avgHr / lthr; // 対LTHR比（簡易）
  if (r < 0.75) return 'recovery';
  if (r < 0.88) return 'aerobic_endurance';
  if (r < 1.0) return 'aerobic_power';
  if (r < 1.05) return 'lactate_threshold';
  if (r < 1.15) return 'anaerobic_endurance';
  return 'anaerobic_power';
}

function sumDurSec(list: { durationSec: number | null }[]) {
  return list.reduce((acc, x) => acc + (x.durationSec ?? 0), 0);
}

async function loadYear(yearOffset = 0) {
  const now = new Date();
  const year = now.getFullYear() - yearOffset;
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const rows = await prisma.activity.findMany({
    where: { startTime: { gte: from, lt: to } },
    select: { avgHr: true, durationSec: true, distanceM: true, elevationM: true },
  });
  
  const byZone: Record<ZoneKey, number> = {
    recovery: 0,
    aerobic_endurance: 0,
    aerobic_power: 0,
    lactate_threshold: 0,
    anaerobic_endurance: 0,
    anaerobic_power: 0,
  };
  
  let totalDistance = 0;
  let totalElevation = 0;
  
  for (const r of rows) {
    const z = getZoneByAvgHr(r.avgHr);
    if (z) {
      byZone[z] += r.durationSec ?? 0;
    }
    totalDistance += r.distanceM ?? 0;
    totalElevation += r.elevationM ?? 0;
  }
  
  const total = sumDurSec(rows);
  const ratio = Object.fromEntries(
    (Object.keys(byZone) as ZoneKey[]).map((k) => [k, total ? byZone[k] / total : 0])
  ) as Record<ZoneKey, number>;
  
  return { 
    year, 
    totalSec: total, 
    totalDistanceKm: totalDistance / 1000,
    totalElevationM: totalElevation,
    byZoneSec: byZone, 
    ratio,
    activityCount: rows.length
  };
}

function RatioTable({
  current,
  last,
  currentZoneSec,
  lastZoneSec,
}: {
  current: Record<ZoneKey, number>;
  last: Record<ZoneKey, number>;
  currentZoneSec: Record<ZoneKey, number>;
  lastZoneSec: Record<ZoneKey, number>;
}) {
  const keys = Object.keys(current) as ZoneKey[];
  const formatTime = (sec: number) => {
    const hours = sec / 3600;
    if (hours < 1) {
      return `${Math.round(sec / 60)}m`;
    }
    return `${hours.toFixed(1)}h`;
  };

  return (
    <table className="w-full text-sm border mt-4">
      <thead>
        <tr className="bg-gray-50">
          <th className="text-left p-3">ゾーン</th>
          <th className="text-right p-3">今年</th>
          <th className="text-right p-3">昨年</th>
          <th className="text-right p-3">差分</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => {
          const cPct = Math.round(current[k] * 1000) / 10;
          const lPct = Math.round((last[k] ?? 0) * 1000) / 10;
          const dPct = Math.round((cPct - lPct) * 10) / 10;
          const cTime = currentZoneSec[k] || 0;
          const lTime = lastZoneSec[k] || 0;
          
          return (
            <tr key={k} className="border-t hover:bg-gray-50">
              <td className="p-3 font-medium">{ZONE_LABEL[k]}</td>
              <td className="p-3 text-right">
                <div className="font-semibold">{cPct.toFixed(1)}%</div>
                <div className="text-xs text-gray-500">{formatTime(cTime)}</div>
              </td>
              <td className="p-3 text-right">
                <div className="font-semibold">{lPct.toFixed(1)}%</div>
                <div className="text-xs text-gray-500">{formatTime(lTime)}</div>
              </td>
              <td className={`p-3 text-right ${dPct >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                <div className="font-semibold">{dPct >= 0 ? '+' : ''}{dPct.toFixed(1)}pts</div>
                <div className="text-xs">
                  {cTime >= lTime ? '+' : ''}{formatTime(Math.abs(cTime - lTime))}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default async function DashboardPage() {
  const cur = await loadYear(0);
  const prev = await loadYear(1);
  const fmtH = (sec: number) => (sec / 3600).toFixed(1);
  const fmtDist = (km: number) => km.toFixed(1);
  const fmtElev = (m: number) => Math.round(m).toLocaleString();
  
  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">
          ゾーン割合は暫定的に平均心拍から推定しています。後で個別ゾーン設定に差し替えます。
        </p>
      </div>
      
      {/* Year comparison metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-600 text-sm font-medium">トレーニング時間</div>
          <div className="text-2xl font-bold text-blue-900 mt-1">{fmtH(cur.totalSec)} h</div>
          <div className="text-xs text-blue-600 mt-1">
            昨年: {fmtH(prev.totalSec)} h 
            <span className={`ml-1 ${cur.totalSec >= prev.totalSec ? 'text-green-600' : 'text-red-600'}`}>
              ({cur.totalSec >= prev.totalSec ? '+' : ''}{fmtH(cur.totalSec - prev.totalSec)} h)
            </span>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-green-600 text-sm font-medium">総距離</div>
          <div className="text-2xl font-bold text-green-900 mt-1">{fmtDist(cur.totalDistanceKm)} km</div>
          <div className="text-xs text-green-600 mt-1">
            昨年: {fmtDist(prev.totalDistanceKm)} km
            <span className={`ml-1 ${cur.totalDistanceKm >= prev.totalDistanceKm ? 'text-green-600' : 'text-red-600'}`}>
              ({cur.totalDistanceKm >= prev.totalDistanceKm ? '+' : ''}{fmtDist(cur.totalDistanceKm - prev.totalDistanceKm)} km)
            </span>
          </div>
        </div>
        
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-orange-600 text-sm font-medium">総標高</div>
          <div className="text-2xl font-bold text-orange-900 mt-1">{fmtElev(cur.totalElevationM)} m</div>
          <div className="text-xs text-orange-600 mt-1">
            昨年: {fmtElev(prev.totalElevationM)} m
            <span className={`ml-1 ${cur.totalElevationM >= prev.totalElevationM ? 'text-green-600' : 'text-red-600'}`}>
              ({cur.totalElevationM >= prev.totalElevationM ? '+' : ''}{fmtElev(cur.totalElevationM - prev.totalElevationM)} m)
            </span>
          </div>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-purple-600 text-sm font-medium">アクティビティ数</div>
          <div className="text-2xl font-bold text-purple-900 mt-1">{cur.activityCount}</div>
          <div className="text-xs text-purple-600 mt-1">
            昨年: {prev.activityCount}
            <span className={`ml-1 ${cur.activityCount >= prev.activityCount ? 'text-green-600' : 'text-red-600'}`}>
              ({cur.activityCount >= prev.activityCount ? '+' : ''}{cur.activityCount - prev.activityCount})
            </span>
          </div>
        </div>
      </div>
      
      {/* Heart rate zones analysis */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">心拍ゾーン別分析（今年 vs 昨年）</h2>
        <p className="text-sm text-gray-600 mb-4">
          各ゾーンの割合（%）と実際のトレーニング時間を表示
        </p>
        <RatioTable 
          current={cur.ratio} 
          last={prev.ratio}
          currentZoneSec={cur.byZoneSec}
          lastZoneSec={prev.byZoneSec}
        />
      </div>
    </main>
  );
}


