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

    const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
    
    console.log('Token response:', tokenResponse.data);
    
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

    console.log('🔍 Fetching all categories...');

    const getFreshToken = async () => {
      const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
      if (!tokenResponse.data.success) throw new Error('Failed to refresh access token');
      return tokenResponse.data.access_token;
    };

    // Step 1: Get all categories and find PRE-PRINT category
    const categoriesResponse = await fetch(`https://api.lightspeedapp.com/API/V3/Account/${accountID}/Category.json`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!categoriesResponse.ok) {
      const errorText = await categoriesResponse.text();
      console.error('❌ Failed to fetch categories:', categoriesResponse.status, errorText);
      
      // 401/403 = auth issue, needs reauth
      if (categoriesResponse.status === 401 || categoriesResponse.status === 403) {
        return Response.json({ 
          error: 'Authentication failed - please reconnect Lightspeed',
          status: categoriesResponse.status,
          details: errorText,
          needsReauth: true
        }, { status: 401 });
      }
      
      return Response.json({ 
        error: 'Failed to fetch categories from Lightspeed',
        status: categoriesResponse.status,
        details: errorText
      }, { status: 500 });
    }

    const categoriesData = await categoriesResponse.json();
    const categories = Array.isArray(categoriesData.Category) 
      ? categoriesData.Category 
      : (categoriesData.Category ? [categoriesData.Category] : []);

    const preprintCategory = categories.find(cat => 
      cat.name?.toUpperCase() === 'PRE-PRINT' || 
      cat.fullPathName?.toUpperCase().includes('PRE-PRINT')
    );

    if (!preprintCategory) {
      return Response.json({ 
        error: 'PRE-PRINT category not found in Lightspeed',
        availableCategories: categories.map(c => c.name)
      }, { status: 404 });
    }

    console.log(`✅ Found PRE-PRINT category (ID: ${preprintCategory.categoryID})`);

    // Step 2: Fetch all items in PRE-PRINT category
    console.log('🔍 Fetching items in PRE-PRINT category...');

    let allPreprintItems = [];
    let nextUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Item.json?categoryID=${preprintCategory.categoryID}&limit=100`;
    let pageCount = 0;

    while (nextUrl) {
      pageCount++;

      if (pageCount > 1 && pageCount % 10 === 0) {
        accessToken = await getFreshToken();
      }

      const response = await fetch(nextUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to fetch items (page ${pageCount}):`, response.status, errorText);
        
        // 401/403 = auth issue
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
      const items = Array.isArray(data.Item) ? data.Item : (data.Item ? [data.Item] : []);

      allPreprintItems = allPreprintItems.concat(items);

      nextUrl = data['@attributes']?.next || '';
      console.log(`✅ Page ${pageCount}: ${items.length} items (total: ${allPreprintItems.length})`);

      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    console.log(`📦 Total PRE-PRINT items fetched: ${allPreprintItems.length}`);

    // Return items with systemSku and itemID
    const items = allPreprintItems
      .filter(item => item.systemSku && item.itemID)
      .map(item => ({
        systemSku: String(item.systemSku).trim(),
        itemID: String(item.itemID)
      }));

    return Response.json({ 
      success: true,
      items,
      total: items.length
    });

  } catch (error) {
    console.error('ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});