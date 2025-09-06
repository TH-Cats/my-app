// app/page.tsx
"use client";

import { useEffect, useMemo, useState } from 'react';

type DayPlan = { day: string; menu?: string; km?: number; duration_min?: number; rpe?: number; notes?: string };

export default function Home() {
  const [plan, setPlan] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [advice, setAdvice] = useState<{ recent?: string; menu_comment?: string } | null>(null);
  const [showDash, setShowDash] = useState(true);

  useEffect(() => {
    try {
      const p = localStorage.getItem('ai-plan');
      if (p) {
        try {
          const parsed = JSON.parse(p);
          setPlan(parsed);
        } catch {
          // 古い形式（プレーンテキストなど）は一度破棄
          localStorage.removeItem('ai-plan');
        }
      } else {
        generate();
      }
    } catch {
      // localStorage 不可時は無視
    }
  }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: '次のレースに向けてコンディションを高める', periodWeeks: 12 }) });
      const data = await res.json();
      setPlan(data.plan);
      localStorage.setItem('ai-plan', JSON.stringify(data.plan));
      // 初回アドバイス
      try {
        const adv = await fetch('/api/ai/advice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ today: data.plan?.weeks?.[0]?.days?.[0] || null }) }).then(r=>r.json());
        if (adv?.advice) setAdvice(adv.advice);
      } catch {}
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
      try {
        const adv = await fetch('/api/ai/advice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ today: data.plan?.weeks?.[0]?.days?.[0] || null }) }).then(r=>r.json());
        if (adv?.advice) setAdvice(adv.advice);
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  function detectDowIndex(label: string): number | null {
    const s = (label || '').toString().trim().toLowerCase();
    if (!s) return null;
    const tbl: Record<string, number> = {
      sun:0, sunday:0, '日':0,
      mon:1, monday:1, '月':1,
      tue:2, tues:2, tuesday:2, '火':2,
      wed:3, wednesday:3, '水':3,
      thu:4, thur:4, thurs:4, thursday:4, '木':4,
      fri:5, friday:5, '金':5,
      sat:6, saturday:6, '土':6,
    };
    // pick first key contained in text
    for (const k of Object.keys(tbl)) {
      if (s === k || s.startsWith(k) || s.includes(k)) return tbl[k];
    }
    return null;
  }

  const todayPlan: DayPlan | undefined = useMemo(() => {
    if (!plan?.weeks) return undefined;
    const todayIdx = new Date().getDay();
    // try to find exact match
    for (const w of plan.weeks) {
      const hit = (w.days || []).find((d: DayPlan) => detectDowIndex(d.day || '') === todayIdx);
      if (hit) return hit;
    }
    // fallback: first day entry
    for (const w of plan.weeks) {
      if ((w.days || []).length) return w.days[0];
    }
    return undefined;
  }, [plan]);

  return (
    <main className="min-h-screen space-y-6">
      <header className="brand border-b">
        <div className="max-w-6xl mx-auto p-4 flex items-center gap-3">
          <img src="/logo-drc.png" alt="DRC Trainer" width={56} height={56} className="rounded" />
          <div>
            <div className="text-2xl brand-title">DRC Trainer</div>
            <div className="text-xs text-gray-600">日々の最適メニューをAIが提案</div>
          </div>
          <div className="ml-auto relative">
            <details>
              <summary className="cursor-pointer px-3 py-2 rounded border bg-white">設定 ▾</summary>
              <div className="absolute right-0 mt-2 w-64 bg-white border rounded shadow">
                <a href="/api/strava/start" className="block px-3 py-2 hover:bg-gray-50">Stravaと接続する</a>
                <button onClick={async ()=>{ const athleteId = prompt('Strava athleteId を入力 (例: 47171719)'); if (!athleteId) return; await fetch('/api/strava/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ athleteId, limit: 30 })}).then(async (r)=>alert(JSON.stringify(await r.json()))); }} className="block w-full text-left px-3 py-2 hover:bg-gray-50">最近のアクティビティを取り込む</button>
              </div>
            </details>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto p-6">

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
            {advice?.menu_comment ? (
              <div className="mt-2 text-sm bg-blue-50 border border-blue-200 text-blue-900 rounded p-2">{advice.menu_comment}</div>
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
        {advice?.recent ? (
          <div className="mt-2 text-xs text-gray-600">直近所見: {advice.recent}</div>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-4">
        <a href="/api/strava/start" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Stravaと接続する</a>
        <a href="#" onClick={async (e) => { e.preventDefault(); const athleteId = prompt('Strava athleteId を入力 (例: 47171719)'); if (!athleteId) return; await fetch('/api/strava/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ athleteId, limit: 30 })}).then(async (r)=>alert(JSON.stringify(await r.json()))); }} className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">最近のアクティビティを取り込む</a>
        <a href="/activities" className="inline-block bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Activities</a>
        <a href="/dashboard" className="inline-block bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded">Dashboard</a>
        <button onClick={()=>setShowDash(v=>!v)} className="inline-block bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">{showDash ? 'ダッシュボードを隠す' : 'ダッシュボードを表示'}</button>
      </div>

      {showDash && (
        <section className="mt-6 bg-white border rounded overflow-hidden">
          <div className="flex items-center justify-between p-3">
            <h2 className="font-semibold">ダッシュボード（埋め込み）</h2>
            <a className="text-sm underline" href="/dashboard">全画面で開く</a>
          </div>
          <iframe src="/dashboard" className="w-full" style={{height: '1200px'}} title="dashboard-embed" />
        </section>
      )}
      </div>
    </main>
  );
}
