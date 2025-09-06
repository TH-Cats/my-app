// app/page.tsx
"use client";

import { useEffect, useMemo, useState } from 'react';

type DayPlan = { day: string; menu?: string; km?: number; duration_min?: number; rpe?: number; notes?: string; intervals?: Array<{ repeat?: number; distance_m?: number; duration_min?: number; rest?: string }>; };

export default function Home() {
  const [plan, setPlan] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [advice, setAdvice] = useState<{ recent?: string; menu_comment?: string } | null>(null);
  const [showDash, setShowDash] = useState(true);
  const [goals, setGoals] = useState<Array<{ race?: string; date?: string; target?: string; note?: string }>>([]);

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
      const g = localStorage.getItem('ai-goals');
      if (g) { try { setGoals(JSON.parse(g)); } catch {} }
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

  function formatPaceJa(km?: number, durationMin?: number) {
    if (!km || !durationMin || km <= 0 || durationMin <= 0) return null;
    const minPerKm = durationMin / km;
    const rounded = Math.round(minPerKm);
    return `キロ${rounded}分`;
  }

  return (
    <main className="min-h-screen space-y-6">
      <header className="brand border-b">
        <div className="max-w-6xl mx-auto p-4 flex items-center gap-3">
          <img src="/logo-drc.png" alt="DRC Trainer" width={56} height={56} className="rounded" onError={(e:any)=>{e.currentTarget.style.display='none';}} />
          <div>
            <div className="text-2xl brand-title">DRC Trainer</div>
            <div className="text-xs text-gray-600">日々の最適メニューを提案</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a href="/activities" className="inline-block bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Activities</a>
            <div className="relative">
              <details>
                <summary className="cursor-pointer px-3 py-2 rounded border bg-white">設定 ▾</summary>
                <div className="absolute right-0 mt-2 w-[340px] bg-white border rounded shadow p-3 space-y-2 z-10">
                  <a href="/api/strava/start" className="block px-3 py-2 hover:bg-gray-50 rounded">Stravaと接続する</a>
                  <button onClick={async ()=>{ const athleteId = prompt('Strava athleteId を入力 (例: 47171719)'); if (!athleteId) return; await fetch('/api/strava/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ athleteId, years: 2 })}).then(async (r)=>alert(JSON.stringify(await r.json()))); }} className="block w-full text-left px-3 py-2 hover:bg-gray-50 rounded">最近のアクティビティを取り込む（過去2年）</button>
                  <div className="pt-2 border-t">
                    <div className="font-semibold text-sm mb-1">目標（最大5）</div>
                    {goals.map((g, i)=> (
                      <div key={i} className="grid grid-cols-2 gap-2 mb-2 text-xs">
                        <input className="border rounded p-1" placeholder="大会名" value={g.race||''} onChange={e=>{const ng=[...goals]; ng[i]={...ng[i], race:e.target.value}; setGoals(ng); localStorage.setItem('ai-goals', JSON.stringify(ng));}} />
                        <input className="border rounded p-1" placeholder="開催日(YYYY-MM-DD)" value={g.date||''} onChange={e=>{const ng=[...goals]; ng[i]={...ng[i], date:e.target.value}; setGoals(ng); localStorage.setItem('ai-goals', JSON.stringify(ng));}} />
                        <input className="border rounded p-1 col-span-1" placeholder="目標タイム(例: 3:30:00)" value={g.target||''} onChange={e=>{const ng=[...goals]; ng[i]={...ng[i], target:e.target.value}; setGoals(ng); localStorage.setItem('ai-goals', JSON.stringify(ng));}} />
                        <input className="border rounded p-1 col-span-1" placeholder="コメント" value={g.note||''} onChange={e=>{const ng=[...goals]; ng[i]={...ng[i], note:e.target.value}; setGoals(ng); localStorage.setItem('ai-goals', JSON.stringify(ng));}} />
                      </div>
                    ))}
                    {goals.length < 5 && (
                      <button onClick={()=>{const ng=[...goals, {} as any]; setGoals(ng); localStorage.setItem('ai-goals', JSON.stringify(ng));}} className="text-xs px-2 py-1 border rounded">＋ 目標を追加</button>
                    )}
                  </div>
                  <div className="pt-2 border-t">
                    <div className="font-semibold text-sm mb-1">参考メソッド</div>
                    <select className="border rounded p-1 text-sm w-full" onChange={e=>localStorage.setItem('ai-method', e.target.value)} defaultValue={typeof window!== 'undefined' ? (localStorage.getItem('ai-method')||'') : ''}>
                      <option value="">指定なし</option>
                      <option>Daniels</option>
                      <option>Lydiard</option>
                      <option>Pfitzinger</option>
                      <option>マフェトン（低強度）</option>
                      <option>低強度高頻度</option>
                    </select>
                    <a className="text-xs underline ml-2" href="https://www.runnersworld.com/training/" target="_blank" rel="noreferrer">参考資料</a>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto p-6">

      <section className="bg-white border rounded p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">本日のメニュー</h2>
        </div>
        {todayPlan ? (
          <div className="mt-3">
            <div className="text-2xl font-bold">{todayPlan.menu || 'Rest / Recovery'}</div>
            <div className="mt-1 text-gray-700 flex flex-wrap gap-4 text-sm">
              <div>距離: <span className="font-semibold">{todayPlan.km ?? '-'} km</span></div>
              <div>時間: <span className="font-semibold">{todayPlan.duration_min ?? '-'} 分</span></div>
              <div>RPE: <span className="font-semibold">{todayPlan.rpe ?? '-'}</span></div>
              {formatPaceJa(todayPlan.km, todayPlan.duration_min) ? (
                <div>ペース: <span className="font-semibold">{formatPaceJa(todayPlan.km, todayPlan.duration_min)}</span></div>
              ) : null}
            </div>
            {todayPlan?.intervals && Array.isArray((todayPlan as any).intervals) && (todayPlan as any).intervals.length > 0 ? (
              <div className="mt-2 text-sm text-gray-800">
                インターバル: {(todayPlan as any).intervals.map((it:any,i:number)=>{
                  const rep = it.repeat ? `${it.repeat}×` : '';
                  const dist = it.distance_m ? `${Math.round(it.distance_m)}m` : (it.duration_min? `${it.duration_min}分`:'');
                  const rest = it.rest ? ` (レスト ${it.rest})` : '';
                  return `${rep}${dist}${rest}`;}).join(', ')}
              </div>
            ) : null}
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
          <button disabled={loading || !plan || !msg} onClick={async ()=>{
            const method = (typeof window!== 'undefined' ? localStorage.getItem('ai-method') : '') || undefined;
            setLoading(true);
            try {
              const res = await fetch('/api/ai/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPlan: plan, message: msg, method }) });
              const data = await res.json();
              setPlan(data.plan);
              localStorage.setItem('ai-plan', JSON.stringify(data.plan));
              setMsg('');
            } finally { setLoading(false); }
          }} className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50">調整を反映</button>
          <a href="/plan" className="px-3 py-2 rounded border">プラン</a>
          <a href="/plan" className="px-3 py-2 rounded border">詳細を開く</a>
        </div>
        {advice?.recent ? (
          <div className="mt-2 text-xs text-gray-600">直近所見: {advice.recent}</div>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-4" />

      <section className="mt-6 bg-white border rounded overflow-hidden">
        <iframe src="/dashboard" className="w-full" style={{height: '1200px'}} title="dashboard-embed" />
      </section>
      </div>
    </main>
  );
}
