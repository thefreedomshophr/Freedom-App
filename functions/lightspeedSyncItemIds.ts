import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get access token
    const tokenResponse = await base44.functions.invoke('lightspeedGetToken');
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
    
    console.log('Fetching all items from Lightspeed...');
    
    // Fetch all items from Lightspeed using pagination with next URLs
    let allLightspeedItems = [];
    let nextUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Item.json?limit=100`;
    
    while (nextUrl) {
      console.log(`Fetching: ${nextUrl}`);
      
      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      console.log(`Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Lightspeed API Error: ${response.status} ${response.statusText}`);
        console.error('Error body:', errorText);
        return Response.json({ 
          success: false, 
          error: `Lightspeed API returned ${response.status}: ${errorText}` 
        }, { status: 500 });
      }
      
      const data = await response.json();
      const items = Array.isArray(data.Item) ? data.Item : (data.Item ? [data.Item] : []);
      
      if (items.length > 0 && items[0]) {
        allLightspeedItems = allLightspeedItems.concat(items);
      }
      
      // Get next URL from response attributes
      nextUrl = data['@attributes']?.next || null;
      console.log(`Items fetched: ${items.length}, Next URL: ${nextUrl ? 'exists' : 'none'}`);
    }
    
    console.log(`Fetched ${allLightspeedItems.length} items from Lightspeed`);
    
    // Create CSV content
    const csvRows = ['systemSku,itemID'];
    
    allLightspeedItems.forEach(item => {
      if (item.systemSku && item.itemID) {
        // Escape any commas or quotes in the data
        const systemSku = String(item.systemSku).replace(/"/g, '""');
        const itemID = String(item.itemID);
        csvRows.push(`"${systemSku}",${itemID}`);
      }
    });
    
    const csvContent = csvRows.join('\n');
    
    console.log(`Generated CSV with ${csvRows.length - 1} rows`);
    
    // Return CSV as downloadable file
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=lightspeed_items.csv'
      }
    });
    
  } catch (error) {
    console.error('Error syncing item IDs:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});