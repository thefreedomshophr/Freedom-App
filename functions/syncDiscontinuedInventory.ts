import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Shop ID mapping: 1=FR, 2=SH, 3=CB, 4=AD, 12=PS
const SHOP_MAPPING = {
  '1': 'fr_quantity',
  '2': 'sh_quantity',
  '3': 'cb_quantity',
  '4': 'ad_quantity',
  '12': 'ps_quantity'
};

// Helper to delay execution for rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only function
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get tag name and batch info from request body
    const body = await req.json().catch(() => ({}));
    const tagName = body.tagId || 'discontinued'; // Default to 'discontinued' if not provided
    const startIndex = body.startIndex || 0; // For processing in chunks
    const batchSize = 50; // Process 50 items at a time

    // Get the Sharkys location to fetch token
    const locations = await base44.asServiceRole.entities.Location.list();
    const sharkysLocation = locations.find(loc => loc.name === 'Sharkys');

    if (!sharkysLocation) {
      return Response.json({ error: 'Sharkys location not found' }, { status: 404 });
    }

    // Get access token using the helper function
    const tokenResponse = await base44.asServiceRole.functions.invoke('lightspeedGetToken', { locationId: sharkysLocation.id });
    const tokenData = tokenResponse.data;

    if (!tokenData.success) {
      return Response.json({ error: 'Failed to get access token' }, { status: 401 });
    }

    const accessToken = tokenData.access_token;

    // Decode JWT to get account ID
    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const accountID = payload.acct;

    console.log(`Using tag name: ${tagName}`);

    await delay(500);

    // First, find the tag ID by name
    console.log('Looking up tag ID...');
    const tagsResponse = await fetch(
      `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Tag.json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!tagsResponse.ok) {
      const errorText = await tagsResponse.text();
      console.error('Failed to fetch tags:', errorText);
      return Response.json({ error: 'Failed to fetch tags from Lightspeed' }, { status: 500 });
    }

    const tagsData = await tagsResponse.json();
    const tags = Array.isArray(tagsData.Tag) ? tagsData.Tag : (tagsData.Tag ? [tagsData.Tag] : []);
    
    const discontinuedTag = tags.find(tag => 
      tag.name && tag.name.toLowerCase() === tagName.toLowerCase()
    );

    if (!discontinuedTag) {
      console.error(`Tag "${tagName}" not found in Lightspeed`);
      return Response.json({ 
        error: `Tag "${tagName}" not found. Available tags: ${tags.map(t => t.name).join(', ')}` 
      }, { status: 400 });
    }

    const discontinuedTagID = discontinuedTag.tagID;
    console.log(`Found tag "${tagName}" with ID: ${discontinuedTagID}`);

    await delay(500);

    // Fetch items filtered by tag using TagRelations
    let allItems = [];
    let nextUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Item.json?load_relations=["TagRelations"]&TagRelations.tagID=${discontinuedTagID}&limit=100`;
    let pageCount = 0;

    // Log to Device Logs
    await base44.asServiceRole.entities.DeviceLog.create({
      message: `Fetching discontinued items with tag: ${tagName}`,
      level: 'info',
      data: JSON.stringify({ tagName: tagName, tagID: discontinuedTagID })
    });

    while (nextUrl) {
      pageCount++;

      console.log(`\n========== PAGE ${pageCount} REQUEST ==========`);
      console.log('URL:', nextUrl);
      console.log(`====================================\n`);

      // Log request to Device Logs
      await base44.asServiceRole.entities.DeviceLog.create({
        message: `Fetching discontinued items - Page ${pageCount}`,
        level: 'info',
        data: JSON.stringify({ url: nextUrl, page: pageCount })
      });

      const itemsResponse = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!itemsResponse.ok) {
        const errorText = await itemsResponse.text();
        console.error('Failed to fetch items:', errorText);
        
        // Log error to Device Logs
        await base44.asServiceRole.entities.DeviceLog.create({
          message: `Failed to fetch discontinued items - Page ${pageCount}`,
          level: 'error',
          data: JSON.stringify({ status: itemsResponse.status, error: errorText })
        });
        
        return Response.json({ error: 'Failed to fetch items from Lightspeed' }, { status: 500 });
      }

      const itemsData = await itemsResponse.json();

      console.log(`\n========== PAGE ${pageCount} RESPONSE ==========`);
      console.log(JSON.stringify(itemsData, null, 2));
      console.log(`====================================\n`);

      // Log response to Device Logs
      await base44.asServiceRole.entities.DeviceLog.create({
        message: `Received discontinued items - Page ${pageCount}`,
        level: 'info',
        data: JSON.stringify({ 
          itemCount: Array.isArray(itemsData.Item) ? itemsData.Item.length : (itemsData.Item ? 1 : 0),
          hasNext: !!itemsData['@attributes']?.next,
          page: pageCount
        })
      });

      const pageItems = Array.isArray(itemsData.Item) ? itemsData.Item : (itemsData.Item ? [itemsData.Item] : []);

      // All items returned already have the discontinued tag (filtered by API)
      allItems.push(...pageItems);

      // Use cursor-based pagination with next URL from response
      nextUrl = itemsData['@attributes']?.next || '';

      if (nextUrl) {
        await delay(500);
      }
    }

    console.log(`Summary: Found ${allItems.length} discontinued items across ${pageCount} pages`);

    // Clear existing logs only on first batch
    if (startIndex === 0) {
      const existingLogs = await base44.asServiceRole.entities.DiscontinuedLog.list();
      for (const log of existingLogs) {
        await base44.asServiceRole.entities.DiscontinuedLog.delete(log.id);
      }
      
      await base44.asServiceRole.entities.DeviceLog.create({
        message: `Found ${allItems.length} discontinued items, processing in batches...`,
        level: 'info',
        data: JSON.stringify({ totalItems: allItems.length })
      });
    }

    // Process only this batch
    const endIndex = Math.min(startIndex + batchSize, allItems.length);
    const batchItems = allItems.slice(startIndex, endIndex);
    
    const syncDate = new Date().toISOString();
    let savedCount = 0;

    // Log batch progress
    await base44.asServiceRole.entities.DeviceLog.create({
      message: `Processing batch: items ${startIndex + 1}-${endIndex} of ${allItems.length}`,
      level: 'info',
      data: JSON.stringify({ progress: { current: endIndex, total: allItems.length } })
    });

    // For each item in this batch, fetch ItemShops data to get quantities
    for (let i = 0; i < batchItems.length; i++) {
      const item = batchItems[i];

      await delay(100);

      const itemShopsResponse = await fetch(
        `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Item/${item.itemID}.json?load_relations=["ItemShops"]`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!itemShopsResponse.ok) {
        console.warn(`Failed to fetch ItemShops for item ${item.itemID}`);
        continue;
      }

      const itemData = await itemShopsResponse.json();
      const itemWithShops = itemData.Item;

      const itemShops = Array.isArray(itemWithShops.ItemShops?.ItemShop) 
        ? itemWithShops.ItemShops.ItemShop 
        : (itemWithShops.ItemShops?.ItemShop ? [itemWithShops.ItemShops.ItemShop] : []);

      // Map shop IDs to quantities
      const quantities = {
        fr_quantity: 0,
        sh_quantity: 0,
        cb_quantity: 0,
        ad_quantity: 0,
        ps_quantity: 0
      };

      itemShops.forEach(itemShop => {
        const shopId = String(itemShop.shopID);
        const fieldName = SHOP_MAPPING[shopId];
        if (fieldName) {
          quantities[fieldName] = parseFloat(itemShop.qoh) || 0;
        }
      });

      // Only collect items with 0 inventory in ALL shops
      const totalInventory = quantities.fr_quantity + quantities.sh_quantity + 
                            quantities.cb_quantity + quantities.ad_quantity + 
                            quantities.ps_quantity;

      // Save immediately if total inventory is 0
      if (totalInventory === 0) {
        await base44.asServiceRole.entities.DiscontinuedLog.create({
          item_name: item.description || 'Unknown',
          system_sku: item.systemSku || '',
          ...quantities,
          sync_date: syncDate
        });
        savedCount++;
      }
    }

    const hasMore = endIndex < allItems.length;
    
    // Log batch completion
    await base44.asServiceRole.entities.DeviceLog.create({
      message: `Batch complete: saved ${savedCount} items from this batch (${endIndex}/${allItems.length} total processed)`,
      level: 'info',
      data: JSON.stringify({ 
        batchComplete: endIndex,
        totalItems: allItems.length,
        savedInBatch: savedCount,
        hasMore: hasMore
      })
    });

    return Response.json({ 
      success: true,
      hasMore: hasMore,
      nextIndex: endIndex,
      totalItems: allItems.length,
      processedCount: endIndex,
      savedInBatch: savedCount,
      message: hasMore 
        ? `Processed ${endIndex}/${allItems.length} items, saved ${savedCount} with 0 inventory`
        : `Sync complete! Processed all ${allItems.length} items, saved ${savedCount} with 0 inventory`
    });

  } catch (error) {
    console.error('[syncDiscontinuedInventory] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});