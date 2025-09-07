import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

async function callGemini(prompt: string) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is missing');
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  const resp = await model.generateContent(prompt);
  return resp.response.text();
}

async function summarizeRecent(userId: string, period: '2years' | '8weeks' = '8weeks') {
  const since = new Date();
  if (period === '2years') {
    since.setFullYear(since.getFullYear() - 2); // 2 years
  } else {
    since.setDate(since.getDate() - 7 * 8); // 8 weeks
  }

  const acts = await prisma.activity.findMany({
    where: { userId, startTime: { gte: since } },
    select: {
      startTime: true,
      distanceM: true,
      durationSec: true,
      elevationM: true,
      avgHr: true,
      type: true,
      avgCadence: true,
      caloriesKcal: true
    },
    orderBy: { startTime: 'asc' },
  });

  const totalKm = acts.reduce((a, x) => a + (x.distanceM ?? 0) / 1000, 0);
  const totalH = acts.reduce((a, x) => a + (x.durationSec ?? 0) / 3600, 0);
  const totalElevation = acts.reduce((a, x) => a + (x.elevationM ?? 0), 0);
  const avgHr = acts.length > 0 ? acts.reduce((a, x) => a + (x.avgHr ?? 0), 0) / acts.filter(x => x.avgHr).length : 0;

  // 月別集計
  const monthlyStats = acts.reduce((acc, act) => {
    if (!act.startTime) return acc;
    const month = act.startTime.toISOString().slice(0, 7); // YYYY-MM
    if (!acc[month]) acc[month] = { count: 0, distance: 0, duration: 0 };
    acc[month].count++;
    acc[month].distance += (act.distanceM ?? 0) / 1000;
    acc[month].duration += (act.durationSec ?? 0) / 3600;
    return acc;
  }, {} as Record<string, { count: number; distance: number; duration: number }>);

  const recentLines = acts.slice(-30).map(a =>
    `${a.startTime?.toISOString().slice(0,10)} ${a.type ?? 'Run'} ${(a.distanceM??0)/1000}km ${(a.durationSec??0)/60}min HR:${a.avgHr ?? '-'} elev:${a.elevationM ?? 0}m`
  );

  return {
    summary: `過去${period === '2years' ? '2年' : '8週間'}で${acts.length}回のアクティビティ、総距離${totalKm.toFixed(1)}km、総時間${totalH.toFixed(1)}時間、総獲得標高${totalElevation.toFixed(0)}m、平均心拍数${avgHr.toFixed(0)}bpm`,
    monthly: Object.entries(monthlyStats).map(([month, stats]) =>
      `${month}: ${stats.count}回 ${stats.distance.toFixed(1)}km ${stats.duration.toFixed(1)}h`
    ).join('\n'),
    recent: recentLines.join('\n'),
    totalKm,
    totalH,
    totalElevation,
    avgHr,
    activityCount: acts.length
  };
}

function buildPrompt(data: any, today: any, period: string) {
  const todayLine = today ? `${today.menu ?? ''}, ${today.km ?? ''}km, ${today.duration_min ?? ''}min, RPE ${today.rpe ?? ''}` : 'N/A';

  return `あなたはエリートランニングコーチです。以下のトレーニングデータを分析し、アドバイスを提供してください。

トレーニングデータ（${period}）:
${data.summary}

月別推移:
${data.monthly}

直近のアクティビティ:
${data.recent}

本日のメニュー: ${todayLine}

以下の点を分析し、日本語でアドバイスを提供してください：
1) 全体的なトレーニング状況の評価
2) 強みと改善点
3) 本日のメニューに対する具体的なアドバイス
4) 今後のトレーニング計画の提案

JSON形式で返してください：
{
  "overall_assessment": "全体評価",
  "strengths": "強み",
  "improvements": "改善点",
  "today_advice": "本日のメニューに対するアドバイス",
  "future_plan": "今後の計画提案",
  "recent": "直近の状況に対する所見",
  "menu_comment": "本日のメニューへのコメント"
}`;
}

async function getActualUserId() {
  // 実際のユーザーIDを取得するロジック
  // デフォルトでは最初のユーザーを使う
  const user = await prisma.user.findFirst({
    include: { accounts: true }
  });

  if (!user) {
    // テスト用ユーザーを作成
    const testUser = await prisma.user.upsert({
      where: { id: 'seed-user-1' },
      update: {},
      create: {
        id: 'seed-user-1',
        email: 'test@example.com'
      }
    });
    return testUser.id;
  }

  return user.id;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, today, period = '2years' } = body as any;

    // 実際のユーザーIDを取得（指定がない場合は自動取得）
    let actualUserId = userId;
    if (!actualUserId) {
      actualUserId = await getActualUserId();
    }

    // 過去データを取得・分析
    const data = await summarizeRecent(actualUserId, period);
    const periodLabel = period === '2years' ? '過去2年' : '過去8週間';

    const prompt = buildPrompt(data, today, periodLabel);
    const raw = await callGemini(prompt);
    const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'');
    const json = JSON.parse(cleaned);

    return Response.json({
      advice: json,
      data: data,
      period: periodLabel,
      userId: actualUserId
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}


