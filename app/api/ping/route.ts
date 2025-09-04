// app/api/ping/route.ts
export async function GET() {
    return Response.json({ ok: true, ts: new Date().toISOString() });
  }
  