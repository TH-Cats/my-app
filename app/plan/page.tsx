"use client";

import { useState } from 'react';

export default function PlanPage() {
  const [goal, setGoal] = useState("12月のフルマラソンで3:30切り");
  const [period, setPeriod] = useState(12);
  const [constraints, setConstraints] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, periodWeeks: period, constraints }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResult(data.plan);
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

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

      {result && (
        <div className="mt-6 whitespace-pre-wrap text-sm bg-gray-50 border rounded p-4">{result}</div>
      )}
    </main>
  );
}


