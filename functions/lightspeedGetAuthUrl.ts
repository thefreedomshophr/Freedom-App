import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Generate OAuth authorization URL
 * Keeps client credentials secure on the backend
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get request body
    const body = await req.json();
    const state = body.state;
    const locationId = body.locationId;
    const clientId = body.clientId;
    
    if (!state) {
      return Response.json({ error: 'State parameter required' }, { status: 400 });
    }
    
    if (!locationId || !clientId) {
      return Response.json({ error: 'Location ID and Client ID required' }, { status: 400 });
    }
    
    // Build the OAuth authorization URL - don't encode scope
    const scope = 'employee:all';
    const authUrl = `https://cloud.lightspeedapp.com/auth/oauth/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `scope=${scope}&` +
      `state=${state}`;
    
    console.log('Generated auth URL with state:', state);
    
    return Response.json({ 
      success: true,
      auth_url: authUrl
    });
    
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});