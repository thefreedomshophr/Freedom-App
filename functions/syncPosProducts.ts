import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * Sync products from Lightspeed POS and map them to our local catalog
 * Automatically handles token refresh transparently
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin authentication
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
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
    
    // Fetch all products from POS (with pagination)
    console.log('Fetching all products from Lightspeed POS...');
    let allProducts = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const url = `https://freedomapparel.retail.lightspeed.app/api/2.0/products?page=${page}&page_size=200`;
      console.log(`Fetching page ${page}:`, url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch products: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      const products = data.data || [];
      
      allProducts = allProducts.concat(products);
      console.log(`Fetched ${products.length} products from page ${page}. Total so far: ${allProducts.length}`);
      
      // Check if there are more pages
      hasMore = products.length === 200;
      page++;
    }
    
    console.log(`Total products fetched: ${allProducts.length}`);
    
    // Create a map of system_id -> POS product_id
    const skuToProductId = {};
    for (const product of allProducts) {
      // Check SKU field
      if (product.sku) {
        skuToProductId[product.sku] = product.id;
      }
      
      // Check product_codes array
      if (product.product_codes && Array.isArray(product.product_codes)) {
        for (const codeObj of product.product_codes) {
          if (codeObj.code) {
            skuToProductId[codeObj.code] = product.id;
          }
        }
      }
    }
    
    console.log(`Built SKU map with ${Object.keys(skuToProductId).length} entries`);
    
    // Now update our entities
    const stats = {
      prints_updated: 0,
      garments_updated: 0,
      merchandise_updated: 0,
      prints_not_found: 0,
      garments_not_found: 0,
      merchandise_not_found: 0,
    };
    
    // Update Prints
    console.log('Syncing prints...');
    const prints = await base44.asServiceRole.entities.Print.list();
    for (const print of prints) {
      if (print.system_id && skuToProductId[print.system_id]) {
        await base44.asServiceRole.entities.Print.update(print.id, {
          pos_product_id: skuToProductId[print.system_id]
        });
        stats.prints_updated++;
      } else if (print.system_id) {
        stats.prints_not_found++;
        console.warn(`Print system_id not found in POS: ${print.system_id} (${print.name})`);
      }
    }
    
    // Update Garments
    console.log('Syncing garments...');
    const garments = await base44.asServiceRole.entities.Garment.list();
    for (const garment of garments) {
      if (garment.system_id && skuToProductId[garment.system_id]) {
        await base44.asServiceRole.entities.Garment.update(garment.id, {
          pos_product_id: skuToProductId[garment.system_id]
        });
        stats.garments_updated++;
      } else if (garment.system_id) {
        stats.garments_not_found++;
        console.warn(`Garment system_id not found in POS: ${garment.system_id} (${garment.name})`);
      }
    }
    
    // Update Merchandise
    console.log('Syncing merchandise...');
    const merchandise = await base44.asServiceRole.entities.Merchandise.list();
    for (const item of merchandise) {
      if (item.system_id && skuToProductId[item.system_id]) {
        await base44.asServiceRole.entities.Merchandise.update(item.id, {
          pos_product_id: skuToProductId[item.system_id]
        });
        stats.merchandise_updated++;
      } else if (item.system_id) {
        stats.merchandise_not_found++;
        console.warn(`Merchandise system_id not found in POS: ${item.system_id} (${item.name})`);
      }
    }
    
    console.log('Sync complete:', stats);
    
    return Response.json({ 
      success: true,
      message: 'Products synced successfully',
      stats
    });
    
  } catch (error) {
    console.error('Error in syncPosProducts:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});