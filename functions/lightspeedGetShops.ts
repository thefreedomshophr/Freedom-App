import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get locationId from request body
    const body = await req.json().catch(() => ({}));
    const locationId = body.locationId;
    
    if (!locationId) {
      return Response.json({ 
        success: false, 
        error: 'Location ID is required' 
      }, { status: 400 });
    }
    
    // Get access token
    const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
    const tokenData = tokenResponse.data;
    
    if (!tokenData.success) {
      return Response.json({ 
        success: false, 
        error: 'Failed to get access token' 
      }, { status: 401 });
    }
    
    const accessToken = tokenData.access_token;
    
    // Decode JWT to get account ID
    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const accountID = payload.acct;
    
    console.log('Fetching shops for account:', accountID);
    
    // Fetch shops from Lightspeed
    const shopsResponse = await fetch(
      `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Shop.json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!shopsResponse.ok) {
      const errorText = await shopsResponse.text();
      console.error('Failed to fetch shops:', errorText);
      return Response.json({ 
        success: false, 
        error: 'Failed to fetch shops from Lightspeed',
        details: errorText
      }, { status: shopsResponse.status });
    }
    
    const shopsData = await shopsResponse.json();
    console.log('Shops fetched successfully');
    
    return Response.json({
      success: true,
      shops: shopsData.Shop
    });
    
  } catch (error) {
    console.error('Error fetching shops:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});