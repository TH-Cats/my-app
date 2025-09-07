// app/page.tsx
"use client";

import { useEffect, useMemo, useState } from 'react';

type DayPlan = { day: string; menu?: string; km?: number; duration_min?: number; rpe?: number; notes?: string; intervals?: Array<{ repeat?: number; distance_m?: number; duration_min?: number; rest?: string }>; };

export default function Home() {
  const [plan, setPlan] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [advice, setAdvice] = useState<{
    advice?: {
      overall_assessment?: string;
      strengths?: string;
      improvements?: string;
      today_advice?: string;
      future_plan?: string;
      recent?: string;
      menu_comment?: string;
    };
    data?: any;
    period?: string;
  } | null>(null);
  const [showDash, setShowDash] = useState(true);
  const [goals, setGoals] = useState<Array<{ race?: string; date?: string; target?: string; note?: string }>>([]);

  useEffect(() => {
    const initializeApp = async () => {
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

        // Stravaデータの自動インポート
        // 1) 認可直後(?strava=connected)は強制的に取り込み実行
        // 2) それ以外は初回のみ（localStorageフラグ未設定時）
        const url = new URL(window.location.href);
        const justConnected = url.searchParams.get('strava') === 'connected';
        const hasImported = localStorage.getItem('strava-imported');
        if (justConnected || !hasImported) {
          console.log('Attempting to import Strava data...');
          try {
            // 分割インポート: 1回に最大1ページまで取り込み、続きがあればループ
            let pageNo = 1;
            let totalImported = 0;
            for (let i=0;i<10;i++) { // 安全のため最大10リクエスト
              const importResult = await fetch('/api/strava/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ years: 2, startPage: pageNo, maxPages: 1 })
              });
              if (!importResult.ok) break;
              const data = await importResult.json();
              totalImported += data.imported || 0;
              if (!data.hasMore) break;
              pageNo = data.nextPage || (pageNo + 1);
            }

            if (importResult.ok) {
              const data = await importResult.json();
              localStorage.setItem('strava-imported', 'true');
              console.log('✅ Strava data imported successfully:', data);

              // 成功メッセージを表示（オプション）
              setTimeout(() => {
                alert(`Stravaデータ ${data.imported}件 をインポートしました！`);
              }, 1000);
              // インポート成功後、既存のAIプランを破棄して再生成（過去データ反映）
              try {
                localStorage.removeItem('ai-plan');
              } catch {}
              await generate();
            } else {
              const errorData = await importResult.json().catch(() => ({ error: 'Unknown error' }));
              console.error('❌ Strava import failed:', errorData);

              // エラーメッセージを表示
              setTimeout(() => {
                const message = errorData.error || 'Stravaデータのインポートに失敗しました';
                const suggestion = errorData.suggestion || '設定から再度お試しください';
                alert(`${message}\n\n${suggestion}`);
              }, 1000);
            }
          } catch (error) {
            console.error('❌ Strava import network error:', error);

            // ネットワークエラーの場合
            setTimeout(() => {
              const msg = (error as any)?.message || 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
              alert(msg);
            }, 1000);
          }
        }
      } catch {
        // localStorage 不可時は無視
      }
    };

    initializeApp();
  }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const method = (typeof window!== 'undefined' ? localStorage.getItem('ai-method') : '') || undefined;
      const res = await fetch('/api/ai/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: '次のレースに向けてコンディションを高める', periodWeeks: 12, method }) });
      const data = await res.json();
      setPlan(data.plan);
      localStorage.setItem('ai-plan', JSON.stringify(data.plan));
      // 初回アドバイス（過去2年分のデータを分析）
      try {
        const adv = await fetch('/api/ai/advice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            today: data.plan?.weeks?.[0]?.days?.[0] || null,
            period: '2years'
          })
        }).then(r=>r.json());
        if (adv) setAdvice(adv);
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
        const adv = await fetch('/api/ai/advice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            today: data.plan?.weeks?.[0]?.days?.[0] || null,
            period: '2years'
          })
        }).then(r=>r.json());
        if (adv) setAdvice(adv);
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
            <a href="/plan" className="inline-block bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-2 px-4 rounded">プラン詳細</a>
            <div className="relative">
              <details>
                <summary className="cursor-pointer px-3 py-2 rounded border bg-white">設定 ▾</summary>
                <div className="absolute right-0 mt-2 w-[340px] bg-white border rounded shadow p-3 space-y-2 z-10">
                  <a href="/api/strava/start" className="block px-3 py-2 hover:bg-gray-50 rounded">Stravaと接続する</a>
                  <button onClick={async ()=>{
                    console.log('Manual Strava import requested');
                    try {
                      const confirmImport = confirm('Stravaから過去2年分のデータをインポートしますか？\n\n※時間がかかる場合があります');
                      if (!confirmImport) return;

                      const result = await fetch('/api/strava/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ years: 2 })
                      });

                      if (result.ok) {
                        const data = await result.json();
                        alert(`✅ インポート成功！\n${data.imported}件のアクティビティを追加しました。`);
                        localStorage.setItem('strava-imported', 'true');
                        try { localStorage.removeItem('ai-plan'); } catch {}
                        await generate();
                      } else {
                        const errorData = await result.json().catch(() => ({ error: 'Unknown error' }));
                        alert(`❌ インポート失敗:\n${errorData.error}\n\n${errorData.suggestion || ''}`);
                      }
                    } catch (error) {
                      console.error('Manual import error:', error);
                      alert('❌ ネットワークエラーが発生しました。');
                    }
                  }} className="block w-full text-left px-3 py-2 hover:bg-gray-50 rounded">🔄 最近のアクティビティを取り込む（過去2年）</button>
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

      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
            🔥 本日のメニュー
          </h2>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">今日のチャレンジ</span>
          </div>
        </div>
        {todayPlan ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-black bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent mb-2">
                {todayPlan.menu || 'Rest / Recovery'}
              </div>
              <div className="w-16 h-1 bg-gradient-to-r from-orange-400 to-red-500 mx-auto rounded-full"></div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                <div className="text-2xl mb-1">🏃‍♂️</div>
                <div className="text-xs text-gray-600">距離</div>
                <div className="font-bold text-lg text-blue-700">{todayPlan.km ?? '-'} km</div>
              </div>

              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <div className="text-2xl mb-1">⏱️</div>
                <div className="text-xs text-gray-600">時間</div>
                <div className="font-bold text-lg text-green-700">{todayPlan.duration_min ?? '-'} 分</div>
              </div>

              <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border border-yellow-200">
                <div className="text-xs text-gray-600">強度</div>
                <div className="font-bold text-lg text-yellow-700">{todayPlan.rpe ?? '-'}</div>
                <div className="text-xs text-gray-500">RPE</div>
              </div>

              {formatPaceJa(todayPlan.km, todayPlan.duration_min) ? (
                <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                  <div className="text-2xl mb-1">⚡</div>
                  <div className="text-xs text-gray-600">ペース</div>
                  <div className="font-bold text-lg text-purple-700">{formatPaceJa(todayPlan.km, todayPlan.duration_min)}</div>
                </div>
              ) : null}
            </div>
            {todayPlan?.intervals && Array.isArray((todayPlan as any).intervals) && (todayPlan as any).intervals.length > 0 ? (
              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-orange-400 to-red-500 rounded-full"></div>
                  インターバル詳細
                </div>
                <div className="space-y-2">
                  {(todayPlan as any).intervals.map((it:any,i:number)=>{
                    const rep = it.repeat ? `${it.repeat}×` : '';
                    const dist = it.distance_m ? `${Math.round(it.distance_m)}m` : (it.duration_min? `${it.duration_min}分`:'');
                    const rest = it.rest ? `レスト ${it.rest}` : '';
                    const pace = it.pace ? ` @ ${it.pace}` : '';
                    const intensity = it.intensity ? ` (${it.intensity})` : '';

                    return (
                      <div key={i} className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {i+1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800">
                            {rep}{dist}{pace}{intensity}
                          </div>
                          {rest && (
                            <div className="text-sm text-gray-600 mt-1">
                              {rest}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {todayPlan.notes ? (
              <div className="mt-1 text-xs text-gray-600">メモ: {todayPlan.notes}</div>
            ) : null}
            {/* Gemini AIの詳細分析結果 */}
            {advice?.advice ? (
              <div className="mt-6 space-y-4">
                {/* トレーニングデータ概要 */}
                {advice.data && (
                  <div className="card p-4">
                    <h3 className="text-lg font-semibold mb-3 text-orange-600">📊 トレーニング分析 ({advice.period})</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{advice.data.activityCount}</div>
                        <div className="text-gray-600">アクティビティ数</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{advice.data.totalKm.toFixed(0)}</div>
                        <div className="text-gray-600">総距離 (km)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{advice.data.totalH.toFixed(0)}</div>
                        <div className="text-gray-600">総時間 (h)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{advice.data.avgHr.toFixed(0)}</div>
                        <div className="text-gray-600">平均心拍数</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* AIアドバイス */}
                <div className="card p-4">
                  <h3 className="text-lg font-semibold mb-3 text-orange-600">🤖 AIコーチの分析</h3>
                  <div className="space-y-3">
                    {advice.advice.overall_assessment && (
                      <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                        <div className="font-semibold text-blue-800 mb-1">全体評価</div>
                        <div className="text-blue-700">{advice.advice.overall_assessment}</div>
                      </div>
                    )}

                    {advice.advice.strengths && (
                      <div className="p-3 bg-green-50 border-l-4 border-green-400 rounded">
                        <div className="font-semibold text-green-800 mb-1">💪 強み</div>
                        <div className="text-green-700">{advice.advice.strengths}</div>
                      </div>
                    )}

                    {advice.advice.improvements && (
                      <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                        <div className="font-semibold text-yellow-800 mb-1">🎯 改善点</div>
                        <div className="text-yellow-700">{advice.advice.improvements}</div>
                      </div>
                    )}

                    {advice.advice.today_advice && (
                      <div className="p-3 bg-purple-50 border-l-4 border-purple-400 rounded">
                        <div className="font-semibold text-purple-800 mb-1">📋 本日のアドバイス</div>
                        <div className="text-purple-700">{advice.advice.today_advice}</div>
                      </div>
                    )}

                    {advice.advice.future_plan && (
                      <div className="p-3 bg-indigo-50 border-l-4 border-indigo-400 rounded">
                        <div className="font-semibold text-indigo-800 mb-1">🔮 今後の計画</div>
                        <div className="text-indigo-700">{advice.advice.future_plan}</div>
                      </div>
                    )}

                    {advice.advice.menu_comment && (
                      <div className="p-3 bg-orange-50 border-l-4 border-orange-400 rounded">
                        <div className="font-semibold text-orange-800 mb-1">💬 本日のメニューコメント</div>
                        <div className="text-orange-700">{advice.advice.menu_comment}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-2 text-sm text-gray-600">プラン未生成です。「プラン生成」を押してください。</div>
        )}
        <div className="mt-6 space-y-3">
          <div className="flex gap-3">
            <input
              key="chat-input"
              className="flex-1 border-2 border-orange-200 rounded-xl p-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-200 transition-all duration-200 bg-white shadow-sm"
              placeholder="💬 体調や要望を入力（例: 今日は疲れているので短めに）"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              disabled={false}
              autoComplete="off"
            />
            <button
              disabled={loading || !plan || !msg}
              onClick={async ()=>{
                const method = (typeof window!== 'undefined' ? localStorage.getItem('ai-method') : '') || undefined;
                setLoading(true);
                try {
                  const res = await fetch('/api/ai/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPlan: plan, message: msg, method }) });
                  const data = await res.json();
                  setPlan(data.plan);
                  localStorage.setItem('ai-plan', JSON.stringify(data.plan));
                  setMsg('');
                } finally { setLoading(false); }
              }}
              className="btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  調整中...
                </>
              ) : (
                <>
                  🚀 調整を反映
                </>
              )}
            </button>
          </div>

          <div className="flex gap-2">
            {!plan && (
              <button
                onClick={generate}
                disabled={loading}
                className="btn-secondary px-4 py-2 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    生成中...
                  </>
                ) : (
                  <>
                    ✨ 新規生成
                  </>
                )}
              </button>
            )}
            <a href="/plan" className="btn-primary px-4 py-2 inline-flex items-center gap-2">
              📋 プラン詳細
            </a>
          </div>
        </div>
        {advice?.advice?.recent ? (
          <div className="mt-2 text-xs text-gray-600">直近所見: {advice.advice.recent}</div>
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
