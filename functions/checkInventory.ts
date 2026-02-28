import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * Check inventory levels for items at a specific outlet
 * Automatically handles token refresh transparently
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get request data
    const body = await req.json();
    const { location_name, items } = body;
    
    if (!location_name || !items || !Array.isArray(items)) {
      return Response.json({ 
        error: 'Missing required fields: location_name and items array' 
      }, { status: 400 });
    }
    
    // Map location names to POS outlet IDs
    const locationOutletMap = {
      'Cannon Beach Freedom': '0665b57a-9ed7-11f0-e06a-b2ba87b94f1b',
      'Sharkys': '0665b57a-9ed7-11f0-e06a-b11e23641868',
      'Freedom': '0665b57a-9ed7-11f0-e06a-b11d7eb0d2aa'
    };
    
    const outletId = locationOutletMap[location_name];
    
    if (!outletId) {
      return Response.json({ 
        error: `Unknown location: ${location_name}. Valid locations are: ${Object.keys(locationOutletMap).join(', ')}` 
      }, { status: 400 });
    }
    
    // Get a valid access token (automatically refreshes if needed)
    const tokenResponse = await base44.functions.invoke('getPosToken', {});
    
    if (!tokenResponse.data.success) {
      return Response.json({ 
        error: tokenResponse.data.error || 'Failed to get POS token',
        needsReauth: tokenResponse.data.needsReauth
      }, { status: 401 });
    }
    
    const accessToken = tokenResponse.data.access_token;
    
    // Helper function to make POS API request
    const makePosRequest = async (endpoint) => {
      const url = `https://freedomapparel.retail.lightspeed.app/api/2.0/${endpoint}`;
      console.log('Making POS request to:', url);
      return await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    };
    
    // Check inventory for each item
    const outOfStockItems = [];
    
    for (const item of items) {
      const posProductId = item.pos_product_id;
      const quantity = item.quantity || 1;
      
      if (!posProductId) {
        console.warn('Item missing pos_product_id:', item);
        outOfStockItems.push({
          name: item.name || item.system_id,
          system_id: item.system_id,
          reason: 'Item not synced with POS. Please run product sync.',
          build_index: item.build_index,
          item_type: item.item_type,
          placement: item.placement
        });
        continue;
      }
      
      console.log(`Checking inventory for pos_product_id: ${posProductId} at outlet: ${outletId}`);
      
      // Get inventory directly using the POS product ID
      const inventoryResponse = await makePosRequest(`products/${posProductId}/inventory`);
      
      if (!inventoryResponse.ok) {
        const errorText = await inventoryResponse.text();
        console.error(`Failed to fetch inventory for product ${posProductId}. Status: ${inventoryResponse.status}, Response: ${errorText}`);
        outOfStockItems.push({
          name: item.name || item.system_id,
          system_id: item.system_id,
          reason: 'Unable to check inventory',
          build_index: item.build_index,
          item_type: item.item_type,
          placement: item.placement
        });
        continue;
      }
      
      const inventoryData = await inventoryResponse.json();
      console.log(`Inventory data for product ${posProductId}:`, JSON.stringify(inventoryData, null, 2));
      
      // Find inventory for the specific outlet
      const inventoryItems = inventoryData.data || inventoryData;
      const outletInventory = Array.isArray(inventoryItems) 
        ? inventoryItems.find(inv => String(inv.outlet_id) === String(outletId))
        : null;
      
      if (!outletInventory) {
        console.error(`No inventory data found for outlet ${outletId} for product ${posProductId}`);
        outOfStockItems.push({
          name: item.name || item.system_id,
          system_id: item.system_id,
          reason: 'No inventory data for this outlet',
          requested: quantity,
          available: 0,
          build_index: item.build_index,
          item_type: item.item_type,
          placement: item.placement
        });
        continue;
      }
      
      const availableQty = parseInt(outletInventory.inventory_level || outletInventory.current_amount || 0, 10);
      console.log(`Available quantity for ${item.system_id} (${posProductId}) at outlet ${outletId}: ${availableQty}`);
      
      if (availableQty < quantity) {
        outOfStockItems.push({
          name: item.name || item.system_id,
          system_id: item.system_id,
          requested: quantity,
          available: availableQty,
          reason: availableQty === 0 ? 'Out of stock' : 'Insufficient quantity',
          build_index: item.build_index,
          item_type: item.item_type,
          placement: item.placement
        });
      }
    }
    
    // Return results
    if (outOfStockItems.length > 0) {
      return Response.json({ 
        success: false,
        has_stock: false,
        out_of_stock_items: outOfStockItems,
        outlet: location_name
      });
    } else {
      return Response.json({ 
        success: true,
        has_stock: true,
        outlet: location_name,
        message: 'All items are in stock'
      });
    }
    
  } catch (error) {
    console.error('Error in checkInventory:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});