export async function GET() {
  return new Response('OK', {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { 'cache-control': 'no-store' },
  });
}


