import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated and is admin
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get count first
    const allMappings = await base44.asServiceRole.entities.ItemIDMapping.list('', 100000);
    const deletedCount = allMappings.length;
    
    // Use bulk delete - deletes all records matching the query in one operation
    await base44.asServiceRole.entities.ItemIDMapping.bulkDelete({});

    return Response.json({ 
      success: true, 
      deletedCount 
    });
  } catch (error) {
    console.error('Error deleting mappings:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});