import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get locationId from request body
    const body = await req.json().catch(() => ({}));
    const locationId = body.locationId;
    
    if (!locationId) {
      return Response.json({ 
        success: false,
        error: 'Location ID required' 
      }, { status: 400 });
    }

    console.log('lightspeedExportItems: Getting access token...');

    // Get access token
    const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
    console.log('Token response:', JSON.stringify(tokenResponse.data));
    
    if (!tokenResponse.data.success) {
      return Response.json({ 
        success: false,
        error: 'Failed to get access token',
        needsReauth: tokenResponse.data.needsReauth 
      }, { status: 401 });
    }

    const accessToken = tokenResponse.data.access_token;

    // Decode token to get accountID
    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const accountID = payload.acct;

    // Fetch all items with cursor-based pagination
    const allItems = [];
    let nextUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Item.json`;

    while (nextUrl) {
      console.log(`Fetching: ${nextUrl}`);
      
      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error ${response.status}: ${errorText}`);
        return Response.json({ 
          success: false,
          error: `Failed to fetch items: ${response.statusText} - ${errorText}` 
        }, { status: response.status });
      }

      const data = await response.json();
      const items = Array.isArray(data.Item) ? data.Item : (data.Item ? [data.Item] : []);
      
      allItems.push(...items);
      
      // Get next page URL from response
      nextUrl = data['@attributes']?.next || null;
      
      if (nextUrl) {
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Return items data
    return Response.json({ 
      success: true,
      items: allItems.map(item => ({
        systemSku: item.systemSku || '',
        itemID: item.itemID
      }))
    });

  } catch (error) {
    console.error('Error in lightspeedExportItems:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});