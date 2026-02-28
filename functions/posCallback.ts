import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get the URL parameters
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    // Check for errors from the POS system
    if (error) {
      console.error('OAuth error from POS:', error);
      return new Response(
        `<html><body><h1>Authorization Failed</h1><p>Error: ${error}</p><p>You can close this window.</p></body></html>`,
        { 
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }
    
    // Validate that we received a code
    if (!code) {
      return new Response(
        '<html><body><h1>Authorization Failed</h1><p>No authorization code received.</p><p>You can close this window.</p></body></html>',
        { 
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }
    
    // Get OAuth credentials from environment variables
    const clientId = Deno.env.get('LIGHTSPEED_CLIENT_ID');
    const clientSecret = Deno.env.get('LIGHTSPEED_CLIENT_SECRET');
    const redirectUri = Deno.env.get('LIGHTSPEED_REDIRECT_URI') || `${url.origin}/posCallback`;
    
    if (!clientId || !clientSecret) {
      console.error('Missing Lightspeed OAuth credentials');
      return new Response(
        '<html><body><h1>Configuration Error</h1><p>Missing OAuth credentials. Please contact an administrator.</p></body></html>',
        { 
          status: 500,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }
    
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://cloud.lightspeedapp.com/oauth/access_token.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(
        '<html><body><h1>Token Exchange Failed</h1><p>Failed to exchange authorization code for access token.</p><p>You can close this window.</p></body></html>',
        { 
          status: 500,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }
    
    const tokenData = await tokenResponse.json();
    
    // Store the access token and refresh token securely
    // Using service role to ensure we have permission to store credentials
    try {
      // Check if a token record already exists
      const existingTokens = await base44.asServiceRole.entities.PosToken.list();
      
      if (existingTokens.length > 0) {
        // Update existing token
        await base44.asServiceRole.entities.PosToken.update(existingTokens[0].id, {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expires_in,
          token_type: tokenData.token_type,
          created_at: new Date().toISOString(),
        });
      } else {
        // Create new token record
        await base44.asServiceRole.entities.PosToken.create({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expires_in,
          token_type: tokenData.token_type,
          created_at: new Date().toISOString(),
        });
      }
      
      console.log('Successfully stored POS access token');
      
      // Return success page
      return new Response(
        '<html><body style="font-family: sans-serif; text-align: center; padding: 50px;"><h1 style="color: green;">✓ Authorization Successful!</h1><p>Your POS system has been successfully connected.</p><p>You can close this window and return to the app.</p></body></html>',
        { 
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        }
      );
      
    } catch (dbError) {
      console.error('Error storing token:', dbError);
      return new Response(
        '<html><body><h1>Storage Error</h1><p>Token received but failed to store. Please contact an administrator.</p></body></html>',
        { 
          status: 500,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }
    
  } catch (error) {
    console.error('Unexpected error in OAuth callback:', error);
    return new Response(
      '<html><body><h1>Unexpected Error</h1><p>An unexpected error occurred. Please try again or contact an administrator.</p></body></html>',
      { 
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
});