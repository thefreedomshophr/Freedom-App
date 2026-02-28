import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin authentication
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }
    
    // Get the current stored token
    const existingTokens = await base44.asServiceRole.entities.PosToken.list();
    
    if (existingTokens.length === 0) {
      return Response.json({ 
        error: 'No POS token found. Please complete OAuth authorization first.' 
      }, { status: 404 });
    }
    
    const tokenRecord = existingTokens[0];
    
    if (!tokenRecord.refresh_token) {
      return Response.json({ 
        error: 'No refresh token available. Please re-authorize.' 
      }, { status: 400 });
    }
    
    // Use refresh token to get new access token
    console.log('Refreshing POS access token using refresh token...');
    
    const clientId = Deno.env.get('LIGHTSPEED_CLIENT_ID');
    const clientSecret = Deno.env.get('LIGHTSPEED_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      return Response.json({ 
        error: 'Missing OAuth credentials in environment variables' 
      }, { status: 500 });
    }
    
    // Standard OAuth 2.0 token refresh request
    const tokenResponse = await fetch('https://cloud.lightspeedapp.com/oauth/access_token.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenRecord.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token refresh failed:', errorText);
      return Response.json({ 
        error: 'Failed to refresh token. Please re-authorize the POS connection.',
        details: errorText,
        needsReauth: true
      }, { status: 401 });
    }
    
    const tokenData = await tokenResponse.json();
    
    // Build update object with new access token
    const updateData = {
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type || 'Bearer',
    };
    
    // OAuth 2.0: New refresh token is OPTIONAL
    // Only update refresh token if a new one is provided
    if (tokenData.refresh_token) {
      updateData.refresh_token = tokenData.refresh_token;
      console.log('New refresh token provided - updating both tokens');
    } else {
      console.log('No new refresh token provided - keeping existing refresh token');
    }
    
    // Calculate and store actual expiration timestamp
    if (tokenData.expires_in) {
      updateData.expires_at = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();
    }
    
    await base44.asServiceRole.entities.PosToken.update(tokenRecord.id, updateData);
    
    console.log('Successfully refreshed POS access token');
    
    return Response.json({ 
      success: true,
      access_token: tokenData.access_token,
      refresh_token: updateData.refresh_token || tokenRecord.refresh_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      expires_at: updateData.expires_at
    });
    
  } catch (error) {
    console.error('Error in token refresh:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});