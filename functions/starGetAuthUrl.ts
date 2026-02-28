import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const STAR_CLIENT_ID = Deno.env.get('STAR_CLIENT_ID');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the callback URL from the request
    const url = new URL(req.url);
    const redirectUri = `${url.protocol}//${url.host}/starCallback`;

    const authUrl = new URL('https://account.starmicronicscloud.com/signin/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', STAR_CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', [
      'https://starmicronicscloud.com/printer-manager/configurations',
      'https://starmicronicscloud.com/printer-manager/devices',
      'https://starmicronicscloud.com/printer-manager/receipts'
    ].join(' '));
    authUrl.searchParams.set('state', user.id);

    return Response.json({ 
      authUrl: authUrl.toString(),
      redirectUri: redirectUri
    });
  } catch (error) {
    console.error('Error generating Star auth URL:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});