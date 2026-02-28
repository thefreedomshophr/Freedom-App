import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { saleID, shopID, locationId } = await req.json();

    if (!saleID || !shopID || !locationId) {
      return Response.json({ 
        error: 'Missing required parameters: saleID, shopID, or locationId' 
      }, { status: 400 });
    }

    // Get access token using the lightspeedGetToken function
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

    // DELETE the sale via Lightspeed API
    const deleteUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Sale/${saleID}.json`;
    
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lightspeed DELETE error:', response.status, errorText);
      return Response.json({ 
        success: false, 
        error: `Lightspeed API error: ${response.status}`,
        details: errorText
      }, { status: response.status });
    }

    return Response.json({ 
      success: true,
      message: 'Sale deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting sale:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});