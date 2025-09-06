"use client";

import { useEffect, useMemo, useState } from 'react';

export default function PlanPage() {
  const [goal, setGoal] = useState("12月のフルマラソンで3:30切り");
  const [period, setPeriod] = useState(12);
  const [constraints, setConstraints] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any | null>(null);
  const [chat, setChat] = useState("");

  const submit = async () => {
    setLoading(true);
    setPlan(null);
    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, periodWeeks: period, constraints }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPlan(data.plan);
    } catch (e: any) {
      setPlan({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const adjust = async () => {
    if (!plan) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPlan: plan, message: chat }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPlan(data.plan);
      setChat("");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const twoWeeks = useMemo(() => {
    if (!plan?.weeks) return [] as any[];
    const today = new Date();
    const out: any[] = [];
    for (const w of plan.weeks) {
      for (const d of (w.days || [])) {
        out.push({ week: w.week, ...d });
      }
    }
    return out.slice(0, 14);
  }, [plan]);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">AI トレーニングプラン作成</h1>
      <div className="grid gap-3">
        <label className="text-sm">目標 / ゴール</label>
        <input className="border rounded p-2" value={goal} onChange={e=>setGoal(e.target.value)} />

        <label className="text-sm">期間（週）</label>
        <select className="border rounded p-2 w-32" value={period} onChange={e=>setPeriod(Number(e.target.value))}>
          {[4,8,12,16,20,24].map(v=> <option key={v} value={v}>{v}</option>)}
        </select>

        <label className="text-sm">制約 / スケジュール（任意）</label>
        <textarea className="border rounded p-2" rows={4} placeholder="休み: 火, レース: 11/10 10km など" value={constraints} onChange={e=>setConstraints(e.target.value)} />
      </div>

      <button disabled={loading} onClick={submit} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
        {loading ? '作成中…' : 'プランを作成'}
      </button>

      {plan && (
        <div className="mt-6 grid gap-4">
          <section className="bg-white border rounded p-4">
            <h2 className="font-semibold mb-2">向こう2週間のメニュー</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b"><th className="py-1">日</th><th>メニュー</th><th>距離</th><th>時間</th><th>RPE</th><th>メモ</th></tr>
              </thead>
              <tbody>
                {twoWeeks.map((d, i)=> (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-1 w-16">{d.day}</td>
                    <td className="py-1">{d.menu}</td>
                    <td className="py-1 w-20">{d.km ?? '-'} km</td>
                    <td className="py-1 w-24">{d.duration_min ?? '-'} min</td>
                    <td className="py-1 w-16">{d.rpe ?? '-'}</td>
                    <td className="py-1">{d.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="bg-white border rounded p-4">
            <h2 className="font-semibold mb-2">チャットで調整</h2>
            <div className="flex gap-2">
              <input className="flex-1 border rounded p-2" placeholder="体調や要望を入力（例: 明日は疲れているのでイージーに）" value={chat} onChange={e=>setChat(e.target.value)} />
              <button disabled={loading || !chat} onClick={adjust} className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50">反映</button>
            </div>
          </section>

          <details>
            <summary className="cursor-pointer text-sm text-gray-600">生成されたプランJSON（開く）</summary>
            <pre className="whitespace-pre-wrap text-xs bg-gray-50 border rounded p-3 mt-2">{JSON.stringify(plan, null, 2)}</pre>
          </details>
        </div>
      )}
    </main>
  );
}


