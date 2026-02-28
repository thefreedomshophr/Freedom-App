import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { barcode, locationId } = await req.json();

    if (!barcode || !locationId) {
      return Response.json({ 
        success: false, 
        error: 'barcode and locationId are required' 
      });
    }

    // Get access token
    const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
    
    if (!tokenResponse.data.success) {
      return Response.json({ 
        success: false, 
        error: 'Failed to get access token' 
      });
    }

    const accessToken = tokenResponse.data.access_token;

    // Decode token to get account ID
    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const accountID = payload.acct;

    // Try multiple search strategies
    // 1. Search by itemCode (matches itemID, UPC, or EAN)
    // 2. Search by systemSku with wildcards for partial matches
    
    let item = null;
    
    // Strategy 1: Use itemCode parameter which searches itemID, UPC, and EAN
    try {
      const itemCodeUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Item.json?itemCode=${encodeURIComponent(barcode)}&load_relations=["ItemShops"]`;
      
      console.log('=== SEARCH ATTEMPT 1: itemCode ===');
      console.log('Barcode:', barcode);
      console.log('Account ID:', accountID);
      console.log('Request URL:', itemCodeUrl);
      
      const response = await fetch(itemCodeUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response Status:', response.status);
      const responseText = await response.text();
      console.log('Response Body:', responseText);
      
      if (response.ok) {
        const data = JSON.parse(responseText);
        console.log('Parsed Data:', JSON.stringify(data, null, 2));
        if (data.Item && (Array.isArray(data.Item) ? data.Item.length > 0 : data.Item)) {
          item = Array.isArray(data.Item) ? data.Item[0] : data.Item;
          console.log('Item found via itemCode!');
        } else {
          console.log('No items in response');
        }
      }
    } catch (err) {
      console.log('itemCode search failed:', err);
    }
    
    // Strategy 2: If not found, try searching systemSku with wildcard
    if (!item) {
      try {
        const systemSkuUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Item.json?systemSku=~,%${encodeURIComponent(barcode)}%&load_relations=["ItemShops"]`;
        
        console.log('=== SEARCH ATTEMPT 2: systemSku wildcard ===');
        console.log('Request URL:', systemSkuUrl);
        
        const response = await fetch(systemSkuUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Response Status:', response.status);
        const responseText = await response.text();
        console.log('Response Body:', responseText);
        
        if (response.ok) {
          const data = JSON.parse(responseText);
          console.log('Parsed Data:', JSON.stringify(data, null, 2));
          if (data.Item && (Array.isArray(data.Item) ? data.Item.length > 0 : data.Item)) {
            item = Array.isArray(data.Item) ? data.Item[0] : data.Item;
            console.log('Item found via systemSku wildcard!');
          } else {
            console.log('No items in response');
          }
        }
      } catch (err) {
        console.log('systemSku wildcard search failed:', err);
      }
    }
    
    if (!item) {
      return Response.json({ 
        success: false, 
        error: 'Item not found in Lightspeed' 
      });
    }

    // Extract price from Prices.ItemPrice and itemType from item
    let price = 0;
    if (item.Prices?.ItemPrice) {
      const prices = Array.isArray(item.Prices.ItemPrice) 
        ? item.Prices.ItemPrice 
        : [item.Prices.ItemPrice];
      
      console.log('Available prices:', JSON.stringify(prices, null, 2));
      
      const defaultPrice = prices.find(p => p.useType === 'Default');
      if (defaultPrice) {
        price = parseFloat(defaultPrice.amount || '0');
      }
    }
    
    console.log('Final extracted price:', price);
    console.log('Item type:', item.itemType);

    return Response.json({
      success: true,
      item: {
        itemID: item.itemID,
        systemSku: item.systemSku,
        description: item.description,
        price: price,
        itemType: item.itemType
      }
    });

  } catch (error) {
    console.error('Error searching Lightspeed item:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});