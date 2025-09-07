import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const count = await prisma.providerAccount.count({ where: { provider: 'strava' } });
    const latest = await prisma.providerAccount.findFirst({
      where: { provider: 'strava' },
      orderBy: { updatedAt: 'desc' },
      select: { provider: true, providerUserId: true, userId: true, updatedAt: true }
    });
    return Response.json({ ok: true, count, latest });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}


