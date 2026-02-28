import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { items, shopID, locationId } = await req.json();
    
    if (!shopID) {
      return Response.json({ 
        success: false, 
        error: 'Shop ID is required' 
      }, { status: 400 });
    }
    
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
    
    console.log('Checking inventory for shop:', shopID);
    
    const insufficientItems = [];
    const allItemsInventory = [];
    
    // Check each item's inventory using ItemShop endpoint
    for (const item of items) {
      if (!item.itemID) {
        console.log(`Skipping ${item.name} - no itemID`);
        continue;
      }
      
      try {
        const apiUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/ItemShop.json?itemID=${item.itemID}&shopID=${shopID}`;
        console.log(`\n=== INVENTORY CHECK ===`);
        console.log(`Item: ${item.name}`);
        console.log(`System ID: ${item.system_id}`);
        console.log(`Calculated itemID: ${item.itemID}`);
        console.log(`Shop ID: ${shopID}`);
        console.log(`API URL: ${apiUrl}`);
        
        // Query ItemShop by itemID and shopID to get inventory for this specific shop
        const itemShopResponse = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        console.log(`Response Status: ${itemShopResponse.status}`);
        
        if (!itemShopResponse.ok) {
          const errorText = await itemShopResponse.text();
          console.error(`Failed to fetch ItemShop - Error: ${errorText}`);
          continue;
        }
        
        const itemShopData = await itemShopResponse.json();
        console.log(`Response Data:`, JSON.stringify(itemShopData, null, 2));
        
        // Parse the ItemShop record - qoh is quantity on hand
        let availableQty = 0;
        if (itemShopData.ItemShop) {
          const itemShop = Array.isArray(itemShopData.ItemShop) 
            ? itemShopData.ItemShop[0] 
            : itemShopData.ItemShop;
          
          if (itemShop) {
            availableQty = parseInt(itemShop.qoh) || 0;
            console.log(`ItemShop record found - qoh: ${itemShop.qoh}, parsed: ${availableQty}`);
          }
        } else {
          console.log('No ItemShop data in response - item may not exist in this shop');
        }
        
        const requestedQty = item.quantity || 1;
        
        console.log(`Item ${item.name} (itemID: ${item.itemID}): Available=${availableQty}, Requested=${requestedQty}, HasSufficient=${availableQty >= requestedQty}`);
        
        // Always track inventory for this item
        allItemsInventory.push({
          ...item,
          available: availableQty,
          requested: requestedQty
        });
        
        if (availableQty < requestedQty) {
          console.log(`INSUFFICIENT: Adding ${item.name} to insufficient items list`);
          insufficientItems.push({
            ...item,
            available: availableQty,
            requested: requestedQty
          });
        }
      } catch (error) {
        console.error(`Error checking item ${item.itemID}:`, error);
      }
    }
    
    return Response.json({
      success: true,
      hasInsufficientInventory: insufficientItems.length > 0,
      insufficientItems,
      allItemsInventory
    });
    
  } catch (error) {
    console.error('Error checking inventory:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});