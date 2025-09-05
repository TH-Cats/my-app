import { NextRequest } from 'next/server';

export async function GET(_request: NextRequest) {
  const clientId = process.env.COROS_CLIENT_ID;
  const authorizeUrl = process.env.COROS_OAUTH_AUTHORIZE_URL;
  const baseUrl = process.env.PUBLIC_BASE_URL;
  const scopes = process.env.COROS_SCOPES || '';

  if (!clientId || !authorizeUrl || !baseUrl) {
    return Response.json(
      { error: 'COROS OAuth is not configured (missing envs)' },
      { status: 500 }
    );
  }

  const redirectUri = `${baseUrl}/api/coros/callback`;

  const url = new URL(authorizeUrl);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  if (scopes) url.searchParams.set('scope', scopes);

  return Response.redirect(url.toString());
}


