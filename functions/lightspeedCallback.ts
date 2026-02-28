import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * OAuth callback handler for Lightspeed
 * This is where Lightspeed redirects after authorization
 */
Deno.serve(async (req) => {
  console.log('=== Lightspeed Callback Started ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  try {
    // Don't require authentication - this is an external OAuth redirect
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    
    console.log('Lightspeed callback received');
    console.log('Full URL:', url.toString());
    
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    
    console.log('Received state:', state);
    console.log('Received code:', code ? 'YES' : 'NO');
    
    // Extract location ID from state (format: location_<ID>_<timestamp>)
    const locationId = state?.match(/^location_([^_]+)_/)?.[1];
    if (!locationId) {
      throw new Error('Invalid state parameter - cannot extract location ID');
    }
    
    console.log('Location ID:', locationId);
    
    // Handle authorization errors
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Authorization Failed</title>
            <meta charset="utf-8">
            <style>
              body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { background: #fee; border: 2px solid #fcc; padding: 30px; border-radius: 8px; }
              h1 { color: #c33; margin-top: 0; }
              a { color: #06c; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>❌ Authorization Failed</h1>
              <p><strong>Error:</strong> ${error}</p>
              ${errorDescription ? `<p>${errorDescription}</p>` : ''}
              <p><a href="/adminpossetup">← Back to POS Setup</a></p>
            </div>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
        status: 400
      });
    }
    
    // Validate authorization code
    if (!code) {
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Missing Code</title>
            <meta charset="utf-8">
            <style>
              body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { background: #fee; border: 2px solid #fcc; padding: 30px; border-radius: 8px; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>Missing Authorization Code</h1>
              <p>No authorization code was provided by Lightspeed.</p>
              <p><a href="/adminpossetup">← Back to POS Setup</a></p>
            </div>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
        status: 400
      });
    }
    
    // Get location-specific OAuth credentials
    const locations = await base44.asServiceRole.entities.Location.filter({ id: locationId });
    if (locations.length === 0) {
      throw new Error('Location not found');
    }
    
    const location = locations[0];
    const clientId = location.lightspeed_client_id;
    const clientSecret = location.lightspeed_client_secret;
    const redirectUri = Deno.env.get('LIGHTSPEED_REDIRECT_URI');
    
    if (!clientId || !clientSecret) {
      throw new Error('Location does not have API credentials configured');
    }
    
    console.log('Exchanging code for token...');
    console.log('Client ID:', clientId?.substring(0, 10) + '...');
    console.log('Redirect URI:', redirectUri);
    
    // Exchange code for access token using the correct endpoint
    const tokenResponse = await fetch('https://cloud.lightspeedapp.com/auth/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
      }),
    });
    
    console.log('Token response status:', tokenResponse.status);
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Token Exchange Failed</title>
            <meta charset="utf-8">
            <style>
              body { font-family: system-ui; max-width: 700px; margin: 50px auto; padding: 20px; }
              .error { background: #fee; border: 2px solid #fcc; padding: 30px; border-radius: 8px; }
              h1 { color: #c33; margin-top: 0; }
              pre { background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>Failed to Exchange Authorization Code</h1>
              <p><strong>Status:</strong> ${tokenResponse.status}</p>
              <p><strong>Response:</strong></p>
              <pre>${errorText}</pre>
              <p><a href="/adminpossetup">← Back to POS Setup</a></p>
            </div>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
        status: 500
      });
    }
    
    const tokenData = await tokenResponse.json();
    console.log('Token obtained successfully');
    
    // Save token to database
    const posTokenData = {
      location_id: locationId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in || 1800,
      token_type: tokenData.token_type || 'Bearer',
      scope: tokenData.scope || 'employee:all',
      expires_at: new Date(Date.now() + ((tokenData.expires_in || 1800) * 1000)).toISOString(),
    };
    
    // Update or create token record for this location
    const existingTokens = await base44.asServiceRole.entities.PosToken.filter({ location_id: locationId });
    
    if (existingTokens.length > 0) {
      await base44.asServiceRole.entities.PosToken.update(existingTokens[0].id, posTokenData);
      console.log('Token updated for location:', locationId);
    } else {
      await base44.asServiceRole.entities.PosToken.create(posTokenData);
      console.log('Token created for location:', locationId);
    }
    
    // Success page with auto-redirect
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Successful</title>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: system-ui; 
              max-width: 600px; 
              margin: 50px auto; 
              padding: 20px; 
              text-align: center;
            }
            .success { 
              background: #efe; 
              border: 2px solid #cfc; 
              padding: 40px; 
              border-radius: 8px; 
            }
            h1 { color: #3c3; margin-top: 0; }
            .icon { font-size: 64px; margin: 20px 0; }
            a { 
              display: inline-block;
              margin-top: 20px;
              padding: 12px 24px;
              background: #3c3;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
            }
            a:hover { background: #2a2; }
          </style>
          <script>
            setTimeout(() => {
              window.location.href = '/adminpossetup';
            }, 2000);
          </script>
        </head>
        <body>
          <div class="success">
            <div class="icon">✓</div>
            <h1>Successfully Connected!</h1>
            <p>Your Lightspeed account is now connected.</p>
            <p>Redirecting...</p>
            <a href="/adminpossetup">Go to POS Setup</a>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
      status: 200
    });
    
  } catch (error) {
    console.error('Callback error:', error);
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <meta charset="utf-8">
          <style>
            body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { background: #fee; border: 2px solid #fcc; padding: 30px; border-radius: 8px; }
            pre { background: #f5f5f5; padding: 15px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Error</h1>
            <pre>${error.message}</pre>
            <p><a href="/adminpossetup">← Back to POS Setup</a></p>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
      status: 500
    });
  }
});