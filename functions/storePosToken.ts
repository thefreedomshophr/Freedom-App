import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * Manually store POS OAuth tokens
 * Admin only - for initial setup or manual token entry
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin authentication
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }
    
    // Get token data from request body
    const body = await req.json();
    const { access_token, refresh_token, expires_in } = body;
    
    // Validate required fields
    if (!access_token || !refresh_token) {
      return Response.json({ 
        error: 'Missing required fields. Please provide both access_token and refresh_token' 
      }, { status: 400 });
    }
    
    // Default expiry to 1 hour if not provided (common for many OAuth systems)
    const expiresIn = expires_in || 3600;
    
    try {
      // Check if a token record already exists
      const existingTokens = await base44.asServiceRole.entities.PosToken.list();
      
      const tokenData = {
        access_token: access_token,
        refresh_token: refresh_token,
        expires_in: expiresIn,
        token_type: 'Bearer',
      };
      
      // Calculate and store expiration timestamp
      if (expiresIn) {
        tokenData.expires_at = new Date(Date.now() + (expiresIn * 1000)).toISOString();
      }
      
      if (existingTokens.length > 0) {
        // Update existing token
        await base44.asServiceRole.entities.PosToken.update(existingTokens[0].id, tokenData);
        console.log('Updated existing POS token');
        
        return Response.json({ 
          success: true,
          message: 'POS tokens updated successfully',
          expires_at: tokenData.expires_at
        });
      } else {
        // Create new token record
        await base44.asServiceRole.entities.PosToken.create(tokenData);
        console.log('Created new POS token record');
        
        return Response.json({ 
          success: true,
          message: 'POS tokens stored successfully',
          expires_at: tokenData.expires_at
        });
      }
      
    } catch (dbError) {
      console.error('Error storing tokens:', dbError);
      return Response.json({ 
        error: 'Failed to store tokens in database',
        details: dbError.message 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in storePosToken:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});