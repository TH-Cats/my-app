import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const rows: Array<{ table_name: string }> = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name
    `;
    return Response.json({ tables: rows.map(r => r.table_name) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}


