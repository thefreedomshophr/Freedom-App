import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { locationId } = body;

    if (!locationId) {
      return Response.json({ error: 'Missing locationId' }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get access token
    const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
    
    if (!tokenResponse.data.success) {
      return Response.json({ 
        error: 'Failed to get access token',
        details: tokenResponse.data.error,
        needsReauth: tokenResponse.data.needsReauth 
      }, { status: 401 });
    }

    const accessToken = tokenResponse.data.access_token;
    
    if (!accessToken) {
      return Response.json({ 
        error: 'No access token returned',
        needsReauth: true
      }, { status: 401 });
    }

    // Extract accountID from token
    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const accountID = payload.acct;

    if (!accountID) {
      return Response.json({ error: 'Could not extract accountID from access token' }, { status: 500 });
    }

    console.log('🔍 Fetching all categories...');

    // Fetch all categories
    console.log('📡 Making request to:', `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Category.json`);
    const categoriesResponse = await fetch(`https://api.lightspeedapp.com/API/V3/Account/${accountID}/Category.json`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📡 Response status:', categoriesResponse.status);

    if (!categoriesResponse.ok) {
      const errorText = await categoriesResponse.text();
      console.error('❌ Failed to fetch categories:', categoriesResponse.status, errorText);
      console.error('❌ Access token used:', accessToken?.substring(0, 50) + '...');
      
      return Response.json({ 
        error: 'Failed to fetch categories from Lightspeed',
        status: categoriesResponse.status,
        details: errorText,
        accountID: accountID,
        needsReauth: categoriesResponse.status === 401 || categoriesResponse.status === 403
      }, { status: 500 });
    }

    const categoriesData = await categoriesResponse.json();
    
    console.log('✅ Categories fetched successfully');

    return Response.json({ 
      success: true,
      data: categoriesData
    });

  } catch (error) {
    console.error('ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});