export const runtime = 'nodejs';

function maskDatabaseUrl(url: string | undefined) {
  if (!url) return { present: false };
  try {
    const u = new URL(url);
    const username = u.username;
    const host = u.hostname;
    const port = u.port;
    const protocol = u.protocol;
    const dbname = u.pathname;
    const hasPassword = u.password?.length > 0;
    return {
      present: true,
      protocol,
      username,
      hasPassword,
      host,
      port,
      dbname,
      query: u.search,
    };
  } catch {
    return { present: true, parseError: true };
  }
}

export async function GET() {
  const info = maskDatabaseUrl(process.env.DATABASE_URL);
  return Response.json(info);
}


