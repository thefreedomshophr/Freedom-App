import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Get a valid Lightspeed access token
 * Automatically refreshes if expired
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get location ID from request
    const body = await req.json().catch(() => ({}));
    const locationId = body.locationId;
    
    if (!locationId) {
      return Response.json({ error: 'Location ID required' }, { status: 400 });
    }
    
    // Get stored token for this location
    const tokens = await base44.asServiceRole.entities.PosToken.filter({ location_id: locationId });
    
    if (tokens.length === 0) {
      return Response.json({ 
        error: 'No Lightspeed connection found for this location',
        needsReauth: true
      }, { status: 404 });
    }
    
    const tokenRecord = tokens[0];
    
    if (!tokenRecord.access_token) {
      return Response.json({ 
        error: 'No access token available',
        needsReauth: true
      }, { status: 404 });
    }
    
    // Check if token is expired - refresh on demand when needed
    const now = new Date();
    const expiresAt = tokenRecord.expires_at ? new Date(tokenRecord.expires_at) : null;
    
    console.log('\n=== TOKEN CHECK ===');
    console.log('Current time:', now.toISOString());
    console.log('Token expires at:', expiresAt ? expiresAt.toISOString() : 'UNKNOWN');
    
    const needsRefresh = !expiresAt || expiresAt <= now;
    console.log('Token expired?', needsRefresh);
    
    if (needsRefresh) {
      console.log('🔄 ATTEMPTING TOKEN REFRESH...');
      
      if (!tokenRecord.refresh_token) {
        return Response.json({ 
          error: 'Token expired and no refresh token available',
          needsReauth: true
        }, { status: 401 });
      }
      
      // Get location-specific credentials
      const locations = await base44.asServiceRole.entities.Location.filter({ id: locationId });
      if (locations.length === 0) {
        return Response.json({ error: 'Location not found' }, { status: 404 });
      }
      
      const location = locations[0];
      const clientId = location.lightspeed_client_id;
      const clientSecret = location.lightspeed_client_secret;
      
      if (!clientId || !clientSecret) {
        return Response.json({ 
          error: 'Location does not have API credentials configured'
        }, { status: 500 });
      }
      
      try {
        // Refresh token using the correct endpoint
        const refreshResponse = await fetch('https://cloud.lightspeedapp.com/auth/oauth/token', {
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
        
        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          console.error('❌ TOKEN REFRESH FAILED');
          console.error('Status:', refreshResponse.status);
          console.error('Error:', errorText);
          return Response.json({ 
            error: 'Failed to refresh token',
            needsReauth: true
          }, { status: 401 });
        }
        
        const newTokenData = await refreshResponse.json();
        console.log('✓ Refresh response received');
        
        // Lightspeed ALWAYS returns a new refresh token when refreshing
        if (!newTokenData.access_token || !newTokenData.refresh_token) {
          console.error('❌ Invalid token response:', newTokenData);
          return Response.json({ 
            error: 'Invalid token response from Lightspeed',
            needsReauth: true
          }, { status: 401 });
        }
        
        // Update database with new tokens
        const updateData = {
          access_token: newTokenData.access_token,
          refresh_token: newTokenData.refresh_token,
          expires_in: newTokenData.expires_in || 1800,
          token_type: newTokenData.token_type || 'Bearer',
          expires_at: new Date(Date.now() + ((newTokenData.expires_in || 1800) * 1000)).toISOString(),
        };
        
        console.log('New token expires at:', updateData.expires_at);
        await base44.asServiceRole.entities.PosToken.update(tokenRecord.id, updateData);
        
        console.log('✅ TOKEN REFRESHED SUCCESSFULLY');
        
        return Response.json({ 
          success: true,
          access_token: newTokenData.access_token,
          token_type: updateData.token_type,
          expires_at: updateData.expires_at,
          was_refreshed: true
        });
        
      } catch (refreshError) {
        console.error('Refresh error:', refreshError);
        return Response.json({ 
          error: 'Failed to refresh token',
          needsReauth: true
        }, { status: 401 });
      }
    }
    
    // Token is still valid
    console.log('✓ Token still valid, no refresh needed');
    return Response.json({ 
      success: true,
      access_token: tokenRecord.access_token,
      token_type: tokenRecord.token_type || 'Bearer',
      expires_at: tokenRecord.expires_at,
      was_refreshed: false
    });
    
  } catch (error) {
    console.error('Error getting token:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});