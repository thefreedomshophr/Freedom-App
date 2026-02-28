import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Always use Freedom location for automated syncs
    console.log('🔄 Looking up Freedom location...');
    const locations = await base44.asServiceRole.entities.Location.list();
    const freedomLocation = locations.find(loc => loc.name === 'Freedom');
    
    if (!freedomLocation) {
      console.error('❌ Freedom location not found');
      return Response.json({ 
        success: false, 
        error: 'Freedom location not found' 
      }, { status: 400 });
    }
    
    const locationId = freedomLocation.id;
    console.log('✅ Using Freedom location ID:', locationId);
    
    // Single location sync
    const result = await syncLocationPreprints(base44, locationId);
    return Response.json(result);
    
  } catch (error) {
    console.error('❌ Error syncing preprints:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});

async function syncLocationPreprints(base44, locationId) {
  // Step 1: Fetch all items with category ID 86 from Lightspeed
    console.log('📦 Step 1: Fetching items with category ID 86...');
    const fetchResponse = await base44.functions.invoke('lightspeedGetItemsByCategoryId', {
      locationId: locationId,
      categoryId: 86
    });
    
    if (!fetchResponse.data.success) {
      throw new Error(fetchResponse.data.error || 'Failed to fetch items from Lightspeed');
    }
    
    const lightspeedItems = fetchResponse.data.items || [];
    console.log(`✅ Found ${lightspeedItems.length} items with category ID 86`);
    
    // Step 2: Create new Preprint records for items not already in DB
    console.log('📝 Step 2: Creating preprint records...');
    const existingPreprints = await base44.asServiceRole.entities.Preprint.list();
    const existingMap = new Map(existingPreprints.map(p => [p.preprint_system_id, p]));
    
    const newPreprints = lightspeedItems.filter(item => !existingMap.has(item.systemSku));
    
    if (newPreprints.length > 0) {
      const preprintsToCreate = newPreprints.map(item => ({
        preprint_system_id: item.systemSku,
        blank_system_id: '',
        print1_system_id: '',
        print2_system_id: ''
      }));
      
      await base44.asServiceRole.entities.Preprint.bulkCreate(preprintsToCreate);
      console.log(`✅ Created ${newPreprints.length} new preprint records`);
    } else {
      console.log('✅ No new preprints to create');
    }
    
    // Step 3: Trigger batch processing (runs independently)
    console.log('🚀 Triggering batch processor...');
    const preprints = await base44.asServiceRole.entities.Preprint.list();
    
    // Fire and forget - don't await this
    base44.asServiceRole.functions.invoke('processPreprints', {
      locationId: locationId,
      offset: 0,
      batchSize: 5,
      totalPreprints: preprints.length
    }).catch(err => console.error('Error triggering batch processor:', err));
    
    return {
      success: true,
      message: 'Sync started',
      totalPreprints: preprints.length,
      newPreprints: newPreprints.length,
      processing: 'Batch processing started in background'
    };
}