import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const signatureSecret = process.env.COROS_WEBHOOK_SECRET;

  // Read raw body (Next.js 15 app router allows request.text())
  const rawBody = await request.text();

  // TODO: Replace with real signature header/key per COROS spec
  const signature = request.headers.get('x-coros-signature');
  if (signatureSecret) {
    // Placeholder for signature verification implementation
    // e.g., HMAC-SHA256(rawBody, signatureSecret) === signature
  }

  try {
    const json = rawBody ? JSON.parse(rawBody) : {};
    console.log('COROS webhook (demo):', json?.event_type || 'unknown');

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

export async function GET() {
  return new Response('OK', { status: 200 });
}


