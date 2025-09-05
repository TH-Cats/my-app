import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const stamp = Date.now();
    const email = `debug_user_${stamp}@example.local`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });
    await prisma.providerAccount.upsert({
      where: { provider_providerUserId: { provider: 'debug', providerUserId: String(stamp) } },
      update: { accessToken: 'x', userId: user.id },
      create: {
        provider: 'debug',
        providerUserId: String(stamp),
        accessToken: 'x',
        userId: user.id,
      },
    });
    return Response.json({ ok: true, userId: user.id });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return new Response('Use POST to create a test record', { status: 200 });
}


