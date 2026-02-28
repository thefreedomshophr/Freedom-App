import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { barcode, locationId } = await req.json();

    if (!barcode) {
      return Response.json({ error: 'Missing barcode' }, { status: 400 });
    }

    if (!locationId) {
      return Response.json({ error: 'Missing locationId' }, { status: 400 });
    }

    // Get access token for Lightspeed API
    const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
    if (!tokenResponse.data.success) {
      return Response.json({ 
        error: 'Failed to get access token',
        needsReauth: tokenResponse.data.needsReauth 
      }, { status: 401 });
    }

    const accessToken = tokenResponse.data.access_token;

    // Decode token to get accountID
    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const accountID = payload.acct;

    console.log('🔍 Searching Lightspeed for barcode:', barcode);

    // Search by itemCode (matches itemID, UPC, or EAN)
    let searchUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Item.json?load_relations=["ItemComponents","ItemShops"]&itemCode=${encodeURIComponent(barcode)}`;

    console.log('Search URL:', searchUrl);

    let response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('itemCode search failed:', response.status);
      
      // Try searching by systemSku
      searchUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Item.json?load_relations=["ItemComponents","ItemShops"]&systemSku=~,${encodeURIComponent(barcode)}`;
      
      response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return Response.json({ 
          error: 'Failed to search Lightspeed',
          status: response.status 
        }, { status: 500 });
      }
    }

    const data = await response.json();
    const items = Array.isArray(data.Item) ? data.Item : (data.Item ? [data.Item] : []);

    console.log(`Found ${items.length} items`);

    if (items.length === 0) {
      return Response.json({
        success: true,
        found: false
      });
    }

    const item = items[0];

    console.log('✅ Found item:', item.itemID, item.description);
    console.log('Item Type:', item.itemType);
    console.log('Has ItemComponents:', !!item.ItemComponents);

    return Response.json({
      success: true,
      found: true,
      item: item
    });

  } catch (error) {
    console.error('Error in lightspeedGetItemDetails:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});