import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { shopID, locationId } = await req.json();
    
    if (!shopID) {
      return Response.json({ 
        success: false, 
        error: 'Shop ID is required' 
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
    
    // Fetch registers for the shop
    const registersResponse = await fetch(
      `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Register.json?shopID=${shopID}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!registersResponse.ok) {
      const errorText = await registersResponse.text();
      console.error('Failed to fetch registers:', errorText);
      return Response.json({ 
        success: false, 
        error: 'Failed to fetch registers from Lightspeed' 
      }, { status: registersResponse.status });
    }
    
    const registersData = await registersResponse.json();
    
    // Parse registers
    let registers = [];
    if (registersData.Register) {
      if (Array.isArray(registersData.Register)) {
        registers = registersData.Register;
      } else {
        registers = [registersData.Register];
      }
    }
    
    // Return simplified register list
    const simplifiedRegisters = registers.map(register => ({
      registerID: register.registerID,
      name: register.name,
      shopID: register.shopID
    }));
    
    return Response.json({
      success: true,
      registers: simplifiedRegisters
    });
    
  } catch (error) {
    console.error('Error fetching registers:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});