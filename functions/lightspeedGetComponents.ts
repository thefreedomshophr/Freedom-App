import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  console.log('=== STEP 2: FETCH COMPONENTS FOR ASSEMBLIES ===');
  
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { locationId, batchSize = 10 } = body;

    if (!locationId) {
      return Response.json({ error: 'Missing locationId' }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
    if (!tokenResponse.data.success) {
      return Response.json({ 
        error: 'Failed to get access token',
        needsReauth: tokenResponse.data.needsReauth 
      }, { status: 401 });
    }

    let accessToken = tokenResponse.data.access_token;

    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const accountID = payload.acct;
    
    if (!accountID) {
      return Response.json({ error: 'Could not extract accountID from access token' }, { status: 500 });
    }

    // Get unprocessed preprints (where blank_system_id is empty)
    const allPreprints = await base44.asServiceRole.entities.Preprint.list();
    const unprocessedPreprints = allPreprints.filter(p => !p.blank_system_id || p.blank_system_id === '');

    if (unprocessedPreprints.length === 0) {
      return Response.json({
        success: true,
        message: 'No unprocessed preprints found.',
        processed: 0,
        remaining: 0
      });
    }

    console.log(`📋 Found ${unprocessedPreprints.length} unprocessed preprints. Processing batch of ${batchSize}...`);

    const itemsToProcess = unprocessedPreprints.slice(0, batchSize);

    // Load garments and prints for mapping
    const allGarments = await base44.asServiceRole.entities.Garment.list();
    const allPrints = await base44.asServiceRole.entities.Print.list();

    const garmentsByItemID = new Map(allGarments.map(g => [g.itemID, g]));
    const printsByItemID = new Map(allPrints.map(p => [p.itemID, p]));

    const getFreshToken = async () => {
      const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
      if (!tokenResponse.data.success) throw new Error('Failed to refresh access token');
      return tokenResponse.data.access_token;
    };

    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < itemsToProcess.length; i++) {
      const preprint = itemsToProcess[i];

      // Refresh token every 10 items
      if (i > 0 && i % 10 === 0) {
        accessToken = await getFreshToken();
      }

      try {
        // Search for the item by systemSku to get its itemID
        const searchUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Item.json?systemSku=${encodeURIComponent(preprint.preprint_system_id)}&load_relations=["ItemComponents"]`;

        const response = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.log(`⚠️ Failed to fetch item for ${preprint.preprint_system_id}`);
          failed++;
          continue;
        }

        const data = await response.json();
        const items = Array.isArray(data.Item) ? data.Item : (data.Item ? [data.Item] : []);
        
        if (items.length === 0) {
          console.log(`⚠️ Item not found: ${preprint.preprint_system_id}`);
          failed++;
          continue;
        }

        const item = items[0];

        if (!item.ItemComponents) {
          console.log(`⚠️ No components for ${preprint.preprint_system_id}`);
          processed++;
          continue;
        }

        const components = Array.isArray(item.ItemComponents.ItemComponent)
          ? item.ItemComponents.ItemComponent
          : [item.ItemComponents.ItemComponent];

        let blankSystemId = '';
        const printSystemIds = [];

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

        await base44.asServiceRole.entities.Preprint.update(preprint.id, {
          blank_system_id: blankSystemId || '',
          print1_system_id: printSystemIds[0] || '',
          print2_system_id: printSystemIds[1] || ''
        });

        updated++;
        processed++;
        
        console.log(`✅ ${i + 1}/${itemsToProcess.length}: Processed ${preprint.preprint_system_id}`);

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 600));

      } catch (error) {
        console.error(`❌ Error processing ${preprint.preprint_system_id}:`, error.message);
        failed++;
      }
    }

    const remaining = unprocessedPreprints.length - processed;

    return Response.json({
      success: true,
      processed,
      created,
      updated,
      failed,
      remaining,
      message: `Processed ${processed} items. ${remaining} remaining. Created: ${created}, Updated: ${updated}, Failed: ${failed}`
    });

  } catch (error) {
    console.error('ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});