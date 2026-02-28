import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { items, shopID, registerID, employeeCode, customerID, locationId } = body;

    // Load placement display names for use in notes
    const placements = await base44.asServiceRole.entities.Placement.list();
    const placementDisplayNames = {};
    placements.forEach(p => {
      placementDisplayNames[p.name] = p.display_name;
    });

    console.log('=== LIGHTSPEED CREATE SALE - RECEIVED REQUEST ===');
    console.log('Full request body:', JSON.stringify(body, null, 2));

    console.log('Step 1: Checking if POS is paused...');
    const user = await base44.auth.me();
    console.log('User:', user);
    if (user?.pos_paused) {
      console.log('POS is paused - returning mock sale');
      return Response.json({
        success: true,
        saleID: 'PAUSED-' + Date.now(),
        message: 'POS paused - mock sale created'
      });
    }

    console.log('Step 2: Validating required fields...');
    if (!items || !shopID || !registerID || !employeeCode || !locationId) {
      return Response.json({ 
        error: 'items, shopID, registerID, employeeCode, and locationId are required' 
      }, { status: 400 });
    }

    console.log('Step 3: Looking up employee ID...');
    const employeeCodes = await base44.asServiceRole.entities.EmployeeCode.filter({ code: employeeCode });
    console.log('Found employee codes:', employeeCodes);
    if (employeeCodes.length === 0) {
      return Response.json({ 
        error: 'Employee code not found' 
      }, { status: 400 });
    }

    const employeeID = employeeCodes[0].employeeID;
    console.log('Employee ID from code:', employeeID);
    if (!employeeID) {
      console.error('ERROR: Employee ID is empty for this employee code!');
      return Response.json({ 
        error: 'Employee ID not set for this employee code. Please sync employees from Lightspeed.' 
      }, { status: 400 });
    }
    console.log('Employee ID is valid, continuing...');

    console.log('Step 4: Getting access token...');
    const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
    console.log('Token response:', tokenResponse.data);
    if (!tokenResponse.data.success) {
      return Response.json({ 
        error: 'Failed to get access token',
        needsReauth: tokenResponse.data.needsReauth 
      }, { status: 401 });
    }

    const accessToken = tokenResponse.data.access_token;

    console.log('Step 5: Decoding token...');
    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const accountID = payload.acct;
    
    console.log('Account ID:', accountID);
    
    if (!accountID) {
      return Response.json({ 
        success: false,
        error: 'Could not extract accountID from access token' 
      }, { status: 500 });
    }

    console.log('Step 6: Fetching shop data...');
    const shopResponse = await fetch(
      `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Shop/${shopID}.json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    console.log('Shop response status:', shopResponse.status);
    if (!shopResponse.ok) {
      console.error('Failed to fetch shop data');
      return Response.json({ 
        success: false,
        error: 'Failed to fetch shop data' 
      }, { status: shopResponse.status });
    }

    const shopData = await shopResponse.json();
    const taxCategoryID = shopData.Shop?.taxCategoryID;
    
    console.log('Shop tax category ID:', taxCategoryID);

    // Build SaleLines from items - use integers as shown in documentation
    const saleLines = items.map((item, index) => {
      const saleLine = {
        itemID: parseInt(item.itemID),
        unitQuantity: item.quantity || 1,
        tax: false,
        tax1Rate: 0,
        tax2Rate: 0
      };
      
      // Add note with display name for placement if available
      if (item.note) {
        let note = item.note;
        // Replace placement name with display name if it contains a placement
        if (item.placement) {
          const displayName = placementDisplayNames[item.placement] || item.placement;
          note = note.replace(item.placement, displayName);
        }
        saleLine.note = note;
      }
      
      return saleLine;
    });

    // Create the sale payload - use integers and booleans as shown in documentation
    const saleData = {
      employeeID: parseInt(employeeID),
      registerID: parseInt(registerID),
      shopID: parseInt(shopID),
      completed: false,
      SaleLines: {
        SaleLine: saleLines
      }
    };

    // Add customerID if provided
    if (customerID) {
      saleData.customerID = parseInt(customerID);
      console.log('Attaching customer ID to sale:', customerID);
    }

    const createUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Sale.json`;

    console.log('Step 7: Creating sale in Lightspeed...');
    console.log('URL:', createUrl);
    console.log('Request Body:', JSON.stringify(saleData, null, 2));

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(saleData)
    });

    console.log('Step 8: Reading Lightspeed response...');
    const responseText = await createResponse.text();
    
    console.log('LIGHTSPEED RESPONSE STATUS:', createResponse.status);
    console.log('LIGHTSPEED RESPONSE BODY:', responseText);

    if (!createResponse.ok) {
      console.error('=== ERROR - Request that was sent:', JSON.stringify(saleData, null, 2));
      return Response.json({ 
        success: false,
        error: `Failed to create sale: ${responseText}`,
        statusCode: createResponse.status,
        requestSent: saleData
      }, { status: createResponse.status });
    }

    const createdSale = JSON.parse(responseText);
    const saleID = createdSale.Sale?.saleID;

    console.log('=== LIGHTSPEED API SUCCESS ===');
    console.log('Created Sale Response:', JSON.stringify(createdSale, null, 2));
    console.log('Sale ID:', saleID);

    return Response.json({ 
      success: true,
      saleID: saleID,
      sale: createdSale.Sale
    });

  } catch (error) {
    console.error('Error in lightspeedCreateSale:', error);
    console.error('Error stack:', error.stack);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});