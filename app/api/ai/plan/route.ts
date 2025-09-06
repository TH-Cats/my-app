import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Minimal, provider-agnostic wrapper using Google Generative AI via fetch to AI Gateway if set
async function callGemini(prompt: string) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is missing');

  // Lazy import to avoid edge bundling issues
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  const resp = await model.generateContent(prompt);
  const text = resp.response.text();
  return text;
}

function buildPrompt(input: {
  goal: string;
  targetRace?: string;
  periodWeeks: number;
  constraints?: string;
  recentSummary: string;
}) {
  return `You are an elite running coach. Build a ${input.periodWeeks}-week training plan.
Goal: ${input.goal}
Target race: ${input.targetRace ?? 'N/A'}
Constraints: ${input.constraints ?? 'N/A'}
Recent training summary (last 8 weeks):\n${input.recentSummary}

Return JSON with this schema:
{
  "weeks": [
    {"week": 1, "focus": "...", "total_km": 0, "total_hours": 0, "notes": "...",
     "days": [ {"day": "Mon", "menu": "", "km": 0, "duration_min": 0, "rpe": 0, "notes": ""} ] }
  ]
}`;
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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { goal, targetRace, periodWeeks = 12, constraints, userId = 'seed-user-1' } = body as any;

    const recent = await summarizeRecent(userId);
    const prompt = buildPrompt({ goal: goal ?? 'Improve 10K time', targetRace, periodWeeks, constraints, recentSummary: recent });
    const text = await callGemini(prompt);

    return Response.json({ plan: text });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}


