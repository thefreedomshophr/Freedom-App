import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const STAR_CLIENT_ID = Deno.env.get('STAR_CLIENT_ID');
const STAR_CLIENT_SECRET = Deno.env.get('STAR_CLIENT_SECRET');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return new Response(`
        <html>
          <body>
            <h1>Authorization Failed</h1>
            <p>Error: ${error}</p>
            <p><a href="/">Return to app</a></p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
        status: 400
      });
    }

    if (!code) {
      return Response.json({ error: 'Authorization code not provided' }, { status: 400 });
    }

    // Exchange code for tokens
    const redirectUri = `${url.protocol}//${url.host}/starCallback`;
    
    const tokenResponse = await fetch('https://account.starmicronicscloud.com/signin/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: STAR_CLIENT_ID,
        client_secret: STAR_CLIENT_SECRET
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return Response.json({ error: 'Token exchange failed', details: errorText }, { status: 500 });
    }

    const tokens = await tokenResponse.json();

    // Store tokens in a StarToken entity
    try {
      // Check if token already exists and update, otherwise create
      const existingTokens = await base44.asServiceRole.entities.StarToken.list();
      
      if (existingTokens.length > 0) {
        await base44.asServiceRole.entities.StarToken.update(existingTokens[0].id, {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          token_type: tokens.token_type,
          scope: tokens.scope
        });
      } else {
        await base44.asServiceRole.entities.StarToken.create({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          token_type: tokens.token_type,
          scope: tokens.scope
        });
      }

      return new Response(`
        <html>
          <body>
            <h1>Star Micronics Cloud Connected!</h1>
            <p>Your printer integration is now set up.</p>
            <p><a href="/">Return to app</a></p>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    } catch (error) {
      console.error('Error storing tokens:', error);
      return Response.json({ error: 'Failed to store tokens', details: error.message }, { status: 500 });
    }
  } catch (error) {
    console.error('Callback error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});