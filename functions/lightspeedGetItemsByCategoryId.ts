import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { locationId, categoryId } = body;

    if (!locationId || !categoryId) {
      return Response.json({ error: 'Missing locationId or categoryId' }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Fetching access token...');
    const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
    
    if (!tokenResponse.data.success) {
      return Response.json({ 
        error: 'Failed to get access token',
        details: tokenResponse.data.error,
        needsReauth: tokenResponse.data.needsReauth 
      }, { status: 401 });
    }

    let accessToken = tokenResponse.data.access_token;
    
    if (!accessToken) {
      return Response.json({ 
        error: 'No access token returned',
        needsReauth: true
      }, { status: 401 });
    }

    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const accountID = payload.acct;

    if (!accountID) {
      return Response.json({ error: 'Could not extract accountID from access token' }, { status: 500 });
    }

    console.log(`🔍 Fetching items with category ID ${categoryId} (including all child categories)...`);

    const getFreshToken = async () => {
      const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
      if (!tokenResponse.data.success) throw new Error('Failed to refresh access token');
      return tokenResponse.data.access_token;
    };

    let allItems = [];
    let nextUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Item.json?categoryID=${categoryId}&limit=100`;
    let pageCount = 0;

    while (nextUrl) {
      pageCount++;

      if (pageCount > 1 && pageCount % 10 === 0) {
        accessToken = await getFreshToken();
      }

      console.log(`📄 Fetching page ${pageCount}...`);
      console.log('📡 REQUEST URL:', nextUrl);
      console.log('📡 REQUEST METHOD: GET');
      console.log('📡 REQUEST HEADERS:', JSON.stringify({
        'Authorization': `Bearer ${accessToken.substring(0, 50)}...`,
        'Content-Type': 'application/json'
      }, null, 2));
      
      const response = await fetch(nextUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 RESPONSE STATUS:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('📥 RESPONSE ERROR:', errorText);
        console.error(`❌ Failed to fetch items (page ${pageCount}):`, response.status, errorText);
        
        if (response.status === 401 || response.status === 403) {
          return Response.json({ 
            error: 'Authentication failed while fetching items - please reconnect Lightspeed',
            status: response.status,
            details: errorText,
            needsReauth: true
          }, { status: 401 });
        }
        
        return Response.json({ 
          error: 'Failed to fetch items from Lightspeed',
          status: response.status,
          details: errorText
        }, { status: 500 });
      }

      const data = await response.json();
      console.log('📥 API RESPONSE (Page ' + pageCount + '): ' + (data.Item ? (Array.isArray(data.Item) ? data.Item.length : 1) + ' items' : 'no items'));

      const items = Array.isArray(data.Item) ? data.Item : (data.Item ? [data.Item] : []);

      console.log(`📊 Page ${pageCount}: ${items.length} items`);

      allItems = allItems.concat(items);

      nextUrl = data['@attributes']?.next || '';
      console.log(`✅ Page ${pageCount}: ${items.length} items (total: ${allItems.length})`);

      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      }

    console.log(`📦 Total items fetched: ${allItems.length}`);

    // Return items with systemSku and itemID
    const items = allItems
      .filter(item => item.systemSku && item.itemID)
      .map(item => ({
        systemSku: String(item.systemSku).trim(),
        itemID: String(item.itemID),
        fullItemData: item
      }));

    return Response.json({ 
      success: true,
      items,
      total: items.length,
      pagesProcessed: pageCount,
      rawResponse: allItems
    });

  } catch (error) {
    console.error('ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});