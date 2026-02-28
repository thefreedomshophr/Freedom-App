import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { locationId, offset = 0, batchSize = 5, totalPreprints } = await req.json();
    
    if (!locationId) {
      return Response.json({ 
        success: false, 
        error: 'Location ID is required' 
      }, { status: 400 });
    }
    
    console.log(`🔧 Processing batch: offset=${offset}, batchSize=${batchSize}, total=${totalPreprints}`);
    
    // Load all preprints and get current batch
    const allPreprints = await base44.asServiceRole.entities.Preprint.list();
    const batch = allPreprints.slice(offset, offset + batchSize);
    
    if (batch.length === 0) {
      console.log('✅ No more preprints to process');
      return Response.json({
        success: true,
        message: 'All preprints processed',
        totalProcessed: offset
      });
    }
    
    // Load garments and prints for matching
    const allGarments = await base44.asServiceRole.entities.Garment.list();
    const allPrints = await base44.asServiceRole.entities.Print.list();
    
    const garmentsByItemID = new Map(allGarments.map(g => [g.itemID, g]));
    const printsByItemID = new Map(allPrints.map(p => [p.itemID, p]));
    
    // Process this batch
    let updated = 0;
    let failed = 0;
    
    for (const preprint of batch) {
      try {
        console.log(`Processing: ${preprint.preprint_system_id}`);
        
        // Get item details from Lightspeed
        const response = await base44.asServiceRole.functions.invoke('lightspeedGetItemDetails', {
          barcode: preprint.preprint_system_id,
          locationId: locationId
        });
        
        if (!response.data.success || !response.data.item) {
          console.warn(`Item not found: ${preprint.preprint_system_id}`);
          failed++;
          continue;
        }
        
        const item = response.data.item;
        
        // Check if it's an assembly
        if (item.itemType !== 'assembly' || !item.ItemComponents) {
          console.warn(`Item is not an assembly: ${preprint.preprint_system_id}`);
          failed++;
          continue;
        }
        
        // Parse components
        const components = Array.isArray(item.ItemComponents.ItemComponent)
          ? item.ItemComponents.ItemComponent
          : [item.ItemComponents.ItemComponent];
        
        let blankSystemId = '';
        const printSystemIds = [];
        
        // Match each component
        for (const component of components) {
          const componentItemID = component.componentItemID;
          
          if (garmentsByItemID.has(componentItemID)) {
            const garment = garmentsByItemID.get(componentItemID);
            blankSystemId = garment.system_id;
          } else if (printsByItemID.has(componentItemID)) {
            const print = printsByItemID.get(componentItemID);
            printSystemIds.push(print.system_id);
          }
        }
        
        // Update the preprint record
        await base44.asServiceRole.entities.Preprint.update(preprint.id, {
          blank_system_id: blankSystemId || '',
          print1_system_id: printSystemIds[0] || '',
          print2_system_id: printSystemIds[1] || ''
        });
        
        updated++;
        
      } catch (error) {
        console.error(`Error processing ${preprint.preprint_system_id}:`, error);
        failed++;
      }
    }
    
    console.log(`✅ Batch complete: updated=${updated}, failed=${failed}`);
    
    // Check if there are more to process
    const nextOffset = offset + batchSize;
    if (nextOffset < allPreprints.length) {
      console.log(`🚀 Triggering next batch at offset ${nextOffset}`);
      
      // Trigger next batch (fire and forget)
      base44.asServiceRole.functions.invoke('processPreprints', {
        locationId: locationId,
        offset: nextOffset,
        batchSize: batchSize,
        totalPreprints: allPreprints.length
      }).catch(err => console.error('Error triggering next batch:', err));
      
      return Response.json({
        success: true,
        message: 'Batch processed, next batch triggered',
        processed: nextOffset,
        total: allPreprints.length,
        updated,
        failed
      });
    }
    
    // All done
    return Response.json({
      success: true,
      message: 'All batches complete',
      totalProcessed: nextOffset,
      updated,
      failed
    });
    
  } catch (error) {
    console.error('❌ Error processing preprints batch:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});