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

async function summarizeRecent(userId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 7 * 8); // 8 weeks
  const acts = await prisma.activity.findMany({
    where: { userId, startTime: { gte: since } },
    select: { startTime: true, distanceM: true, durationSec: true, elevationM: true, avgHr: true, type: true },
    orderBy: { startTime: 'asc' },
  });
  const totalKm = acts.reduce((a, x) => a + (x.distanceM ?? 0) / 1000, 0);
  const totalH = acts.reduce((a, x) => a + (x.durationSec ?? 0) / 3600, 0);
  const lines = acts.slice(-20).map(a => `${a.startTime?.toISOString().slice(0,10)} ${a.type ?? 'Run'} ${(a.distanceM??0)/1000}km ${(a.durationSec??0)/60}min HR:${a.avgHr ?? '-'} elev:${a.elevationM ?? 0}`);
  return `Total ${totalKm.toFixed(1)}km, ${totalH.toFixed(1)}h over ${acts.length} activities.\nRecent: \n${lines.join('\n')}`;
}

function buildPrompt(recent: string, today: any) {
  const todayLine = today ? `${today.menu ?? ''}, ${today.km ?? ''}km, ${today.duration_min ?? ''}min, RPE ${today.rpe ?? ''}` : 'N/A';
  return `あなたはエリートランニングコーチです。以下の「直近の状況」と「本日のメニュー」を踏まえ、
1) 直近の状況に対する短い所見（1行）
2) 本日のメニューに添える短いコメント（1行）
を日本語で出力してください。絵文字や装飾は不要です。簡潔に、実務的に。

直近の状況（英語の要約）:\n${recent}
本日のメニュー（要約）: ${todayLine}

JSONのみを返してください（コードブロックは禁止）:\n{
  "recent": "直近所見1行",
  "menu_comment": "本日のメニューへの一言",
}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId = 'seed-user-1', today } = body as any;
    const recent = await summarizeRecent(userId);
    const prompt = buildPrompt(recent, today);
    const raw = await callGemini(prompt);
    const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'');
    const json = JSON.parse(cleaned);
    return Response.json({ advice: json });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}


