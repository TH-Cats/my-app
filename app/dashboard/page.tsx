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
    select: { avgHr: true, durationSec: true },
  });
  const byZone: Record<ZoneKey, number> = {
    recovery: 0,
    aerobic_endurance: 0,
    aerobic_power: 0,
    lactate_threshold: 0,
    anaerobic_endurance: 0,
    anaerobic_power: 0,
  };
  for (const r of rows) {
    const z = getZoneByAvgHr(r.avgHr);
    if (!z) continue;
    byZone[z] += r.durationSec ?? 0;
  }
  const total = sumDurSec(rows);
  const ratio = Object.fromEntries(
    (Object.keys(byZone) as ZoneKey[]).map((k) => [k, total ? byZone[k] / total : 0])
  ) as Record<ZoneKey, number>;
  return { year, totalSec: total, byZoneSec: byZone, ratio };
}

function RatioTable({
  current,
  last,
}: {
  current: Record<ZoneKey, number>;
  last: Record<ZoneKey, number>;
}) {
  const keys = Object.keys(current) as ZoneKey[];
  return (
    <table className="w-full text-sm border mt-4">
      <thead>
        <tr className="bg-gray-50">
          <th className="text-left p-2">ゾーン</th>
          <th className="text-right p-2">今年(%)</th>
          <th className="text-right p-2">昨年(%)</th>
          <th className="text-right p-2">差分(pts)</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => {
          const c = Math.round(current[k] * 1000) / 10;
          const l = Math.round((last[k] ?? 0) * 1000) / 10;
          const d = Math.round((c - l) * 10) / 10;
          return (
            <tr key={k} className="border-t">
              <td className="p-2">{ZONE_LABEL[k]}</td>
              <td className="p-2 text-right">{c.toFixed(1)}</td>
              <td className="p-2 text-right">{l.toFixed(1)}</td>
              <td className={`p-2 text-right ${d >= 0 ? 'text-green-700' : 'text-red-700'}`}>{d.toFixed(1)}</td>
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
  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-sm text-gray-600 mt-1">ゾーン割合は暫定的に平均心拍から推定しています。後で個別ゾーン設定に差し替えます。</p>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-4">
          <div className="font-semibold">今年のトレーニング時間</div>
          <div className="text-2xl">{fmtH(cur.totalSec)} h</div>
        </div>
        <div className="border rounded p-4">
          <div className="font-semibold">昨年のトレーニング時間</div>
          <div className="text-2xl">{fmtH(prev.totalSec)} h</div>
        </div>
      </div>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">ゾーン別割合（今年 vs 昨年）</h2>
        <RatioTable current={cur.ratio} last={prev.ratio} />
      </div>
    </main>
  );
}


