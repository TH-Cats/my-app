// app/page.tsx
"use client";

import { useEffect, useMemo, useState } from 'react';

type DayPlan = { day: string; menu?: string; km?: number; duration_min?: number; rpe?: number; notes?: string };

export default function Home() {
  const [plan, setPlan] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const p = localStorage.getItem('ai-plan');
    if (p) setPlan(JSON.parse(p));
    else generate();
  }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: '次のレースに向けてコンディションを高める', periodWeeks: 12 }) });
      const data = await res.json();
      setPlan(data.plan);
      localStorage.setItem('ai-plan', JSON.stringify(data.plan));
    } finally {
      setLoading(false);
    }
  };

  const adjust = async () => {
    if (!plan || !msg) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPlan: plan, message: msg }) });
      const data = await res.json();
      setPlan(data.plan);
      localStorage.setItem('ai-plan', JSON.stringify(data.plan));
      setMsg("");
    } finally {
      setLoading(false);
    }
  };

  const todayPlan: DayPlan | undefined = useMemo(() => {
    if (!plan?.weeks) return undefined;
    const map: Record<number, string> = {0:'Sun',1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat'};
    const dow = map[new Date().getDay()];
    for (const w of plan.weeks) {
      const hit = (w.days||[]).find((d:DayPlan) => (d.day||'').slice(0,3) === dow);
      if (hit) return hit;
    }
    return undefined;
  }, [plan]);

  return (
    <main className="min-h-screen p-8 space-y-6">
      <h1 className="text-2xl font-bold">DRC Trainer</h1>

      <section className="bg-white border rounded p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">本日のメニュー</h2>
          <div className="text-xs text-gray-500">AIが提案。チャットで即修正</div>
        </div>
        {todayPlan ? (
          <div className="mt-3">
            <div className="text-2xl font-bold">{todayPlan.menu || 'Rest / Recovery'}</div>
            <div className="mt-1 text-gray-700 flex flex-wrap gap-4 text-sm">
              <div>距離: <span className="font-semibold">{todayPlan.km ?? '-'} km</span></div>
              <div>時間: <span className="font-semibold">{todayPlan.duration_min ?? '-'} 分</span></div>
              <div>RPE: <span className="font-semibold">{todayPlan.rpe ?? '-'}</span></div>
            </div>
            {todayPlan.notes ? (
              <div className="mt-1 text-xs text-gray-600">メモ: {todayPlan.notes}</div>
            ) : null}
          </div>
        ) : (
          <div className="mt-2 text-sm text-gray-600">プラン未生成です。「プラン生成」を押してください。</div>
        )}
        <div className="mt-3 flex gap-2">
          <input className="flex-1 border rounded p-2" placeholder="体調や要望（例: 今日は疲れているので短めに）" value={msg} onChange={e=>setMsg(e.target.value)} />
          <button disabled={loading || !plan || !msg} onClick={adjust} className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50">反映</button>
          <button disabled={loading} onClick={generate} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">{loading? '生成中…':'プラン生成'}</button>
          <a href="/plan" className="px-3 py-2 rounded border">詳細を開く</a>
        </div>
      </section>

      <div className="flex flex-wrap gap-4">
        <a href="/api/strava/start" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Stravaと接続する</a>
        <a href="#" onClick={async (e) => { e.preventDefault(); const athleteId = prompt('Strava athleteId を入力 (例: 47171719)'); if (!athleteId) return; await fetch('/api/strava/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ athleteId, limit: 30 })}).then(async (r)=>alert(JSON.stringify(await r.json()))); }} className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">最近のアクティビティを取り込む</a>
        <a href="/activities" className="inline-block bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Activities</a>
        <a href="/dashboard" className="inline-block bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded">Dashboard</a>
      </div>
    </main>
  );
}
