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

type SearchParams = { m?: string };

function getPeriodRange(months: number, yearOffset = 0) {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);
  from.setMonth(from.getMonth() - months);
  // last year comparison
  if (yearOffset === 1) {
    from.setFullYear(from.getFullYear() - 1);
    to.setFullYear(to.getFullYear() - 1);
  }
  return { from, to };
}

async function loadPeriod(months: number, yearOffset = 0) {
  const { from, to } = getPeriodRange(months, yearOffset);
  const rows = await prisma.activity.findMany({
    where: { startTime: { gte: from, lt: to } },
    select: { avgHr: true, durationSec: true, distanceM: true, elevationM: true, startTime: true },
    orderBy: { startTime: 'asc' },
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
    if (z) byZone[z] += r.durationSec ?? 0;
    totalDistance += r.distanceM ?? 0;
    totalElevation += r.elevationM ?? 0;
  }

  const total = sumDurSec(rows);
  const ratio = Object.fromEntries(
    (Object.keys(byZone) as ZoneKey[]).map((k) => [k, total ? byZone[k] / total : 0])
  ) as Record<ZoneKey, number>;

  return {
    totalSec: total,
    totalDistanceKm: totalDistance / 1000,
    totalElevationM: totalElevation,
    byZoneSec: byZone,
    ratio,
    rows,
  };
}

type MonthlyPoint = { ym: string; distanceKm: number; hours: number; elevationM: number };

function buildMonthly(pointsFromRows: { startTime: Date | null; distanceM: number | null; durationSec: number | null; elevationM: number | null; }[], months = 12): MonthlyPoint[] {
  const buckets = new Map<string, MonthlyPoint>();
  // initialize buckets for latest N months so we always render the axis
  const cursor = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(ym, { ym, distanceKm: 0, hours: 0, elevationM: 0 });
  }
  for (const r of pointsFromRows) {
    if (!r.startTime) continue;
    const d = new Date(r.startTime);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const b = buckets.get(ym);
    if (!b) continue;
    b.distanceKm += (r.distanceM ?? 0) / 1000;
    b.hours += (r.durationSec ?? 0) / 3600;
    b.elevationM += (r.elevationM ?? 0);
  }
  return Array.from(buckets.values());
}

function MiniBarChart({ data, color = '#3b82f6', label, valueFormatter }:{ data: { label: string; value: number }[]; color?: string; label: string; valueFormatter?: (v:number)=>string; }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const h = 120;
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-sm text-gray-600 mb-2">{label}</div>
      <div className="flex items-end gap-2 h-[120px]">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className="w-full rounded-t" style={{ height: `${(d.value / max) * (h - 20)}px`, backgroundColor: color }} />
            <div className="mt-1 text-[10px] text-gray-500">{d.label.split('-')[1]}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-gray-500">Max: {valueFormatter ? valueFormatter(max) : max.toFixed(1)}</div>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const m = Math.max(1, Math.min(12, Number(params?.m ?? '1')));
  const periodLabel = m === 1 ? '直近1ヶ月' : `直近${m}ヶ月`;

  const curYear = await loadYear(0);
  const prevYear = await loadYear(1);

  const curPeriod = await loadPeriod(m, 0);
  const prevPeriod = await loadPeriod(m, 1);

  // monthly trends: last 12 months
  const monthlyRows = await prisma.activity.findMany({
    where: { startTime: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1) } },
    select: { startTime: true, distanceM: true, durationSec: true, elevationM: true },
    orderBy: { startTime: 'asc' },
  });
  const monthly = buildMonthly(monthlyRows, 12);
  const distData = monthly.map(p => ({ label: p.ym, value: Number(p.distanceKm.toFixed(1)) }));
  const timeData = monthly.map(p => ({ label: p.ym, value: Number(p.hours.toFixed(1)) }));
  const elevData = monthly.map(p => ({ label: p.ym, value: Math.round(p.elevationM) }));
  const fmtH = (sec: number) => (sec / 3600).toFixed(1);
  const fmtDist = (km: number) => km.toFixed(1);
  const fmtElev = (m: number) => Math.round(m).toLocaleString();
  
  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">ゾーン割合は暫定的に平均心拍から推定しています。後で個別ゾーン設定に差し替えます。</p>
        <p className="text-xs text-gray-500">※ 以下の数値は年次集計（1/1〜今日）です。近々「直近1/3/6/12ヶ月」に切替できるフィルタを追加します。</p>
      </div>
      
      {/* Year comparison metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-600 text-sm font-medium">トレーニング時間</div>
          <div className="text-2xl font-bold text-blue-900 mt-1">{fmtH(curYear.totalSec)} h</div>
          <div className="text-xs text-blue-600 mt-1">
            昨年: {fmtH(prevYear.totalSec)} h 
            <span className={`ml-1 ${curYear.totalSec >= prevYear.totalSec ? 'text-green-600' : 'text-red-600'}`}>
              ({curYear.totalSec >= prevYear.totalSec ? '+' : ''}{fmtH(curYear.totalSec - prevYear.totalSec)} h)
            </span>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-green-600 text-sm font-medium">総距離</div>
          <div className="text-2xl font-bold text-green-900 mt-1">{fmtDist(curYear.totalDistanceKm)} km</div>
          <div className="text-xs text-green-600 mt-1">
            昨年: {fmtDist(prevYear.totalDistanceKm)} km
            <span className={`ml-1 ${curYear.totalDistanceKm >= prevYear.totalDistanceKm ? 'text-green-600' : 'text-red-600'}`}>
              ({curYear.totalDistanceKm >= prevYear.totalDistanceKm ? '+' : ''}{fmtDist(curYear.totalDistanceKm - prevYear.totalDistanceKm)} km)
            </span>
          </div>
        </div>
        
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-orange-600 text-sm font-medium">総標高</div>
          <div className="text-2xl font-bold text-orange-900 mt-1">{fmtElev(curYear.totalElevationM)} m</div>
          <div className="text-xs text-orange-600 mt-1">
            昨年: {fmtElev(prevYear.totalElevationM)} m
            <span className={`ml-1 ${curYear.totalElevationM >= prevYear.totalElevationM ? 'text-green-600' : 'text-red-600'}`}>
              ({curYear.totalElevationM >= prevYear.totalElevationM ? '+' : ''}{fmtElev(curYear.totalElevationM - prevYear.totalElevationM)} m)
            </span>
          </div>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-purple-600 text-sm font-medium">アクティビティ数</div>
          <div className="text-2xl font-bold text-purple-900 mt-1">{curYear.activityCount}</div>
          <div className="text-xs text-purple-600 mt-1">
            昨年: {prevYear.activityCount}
            <span className={`ml-1 ${curYear.activityCount >= prevYear.activityCount ? 'text-green-600' : 'text-red-600'}`}>
              ({curYear.activityCount >= prevYear.activityCount ? '+' : ''}{curYear.activityCount - prevYear.activityCount})
            </span>
          </div>
        </div>
      </div>
      
      {/* Monthly trends (last 12 months) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <MiniBarChart label="月別距離 (km)" color="#60a5fa" data={distData} valueFormatter={(v)=>`${v.toFixed(1)} km`} />
        <MiniBarChart label="月別時間 (h)" color="#34d399" data={timeData} valueFormatter={(v)=>`${v.toFixed(1)} h`} />
        <MiniBarChart label="月別標高 (m)" color="#fb923c" data={elevData} valueFormatter={(v)=>`${Math.round(v)} m`} />
      </div>

      {/* Period selector and zone analysis */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-gray-600">ゾーン比較期間:</span>
        {[1,3,6,12].map(x => (
          <a key={x} href={`/dashboard?m=${x}`} className={`px-2 py-1 text-sm rounded border ${m===x? 'bg-blue-600 text-white border-blue-600':'hover:bg-gray-50 border-gray-300'}`}>{x===1? '1ヶ月':`${x}ヶ月`}</a>
        ))}
        <span className="ml-2 text-sm text-gray-500">{periodLabel} の昨年対比</span>
      </div>

      {/* Heart rate zones analysis */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">心拍ゾーン別分析（{periodLabel} vs 昨年同期間）</h2>
        <p className="text-sm text-gray-600 mb-4">各ゾーンの割合（%）と実際のトレーニング時間を表示</p>
        <RatioTable
          current={curPeriod.ratio}
          last={prevPeriod.ratio}
          currentZoneSec={curPeriod.byZoneSec}
          lastZoneSec={prevPeriod.byZoneSec}
        />
      </div>
    </main>
  );
}


