import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { saleID, shopID, locationId } = await req.json();
    
    if (!saleID || !shopID) {
      return Response.json({ 
        success: false, 
        error: 'Missing saleID or shopID' 
      }, { status: 400 });
    }
    
    if (!locationId) {
      return Response.json({ 
        success: false, 
        error: 'Missing locationId' 
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
    
    // Fetch sale from Lightspeed
    const saleResponse = await fetch(
      `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Sale/${saleID}.json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!saleResponse.ok) {
      return Response.json({ 
        success: false, 
        error: 'Failed to fetch sale from Lightspeed' 
      }, { status: saleResponse.status });
    }
    
    const saleData = await saleResponse.json();
    const sale = saleData.Sale;
    
    // Check if sale is completed (has payment)
    // Handle both boolean and string values
    const isCompleted = sale.completed === true || sale.completed === 'true' || 
                       sale.complete === true || sale.complete === 'true';
    
    console.log(`Sale ${saleID} status:`, { 
      completed: sale.completed, 
      complete: sale.complete,
      isCompleted 
    });
    
    return Response.json({ 
      success: true, 
      isCompleted,
      sale 
    });
    
  } catch (error) {
    console.error('Error checking sale status:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});