import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { saleID, items, shopID, registerID, employeeCode, customerID, locationId } = body;

    // Check if POS is paused
    const user = await base44.auth.me();
    if (user?.pos_paused) {
      console.log('POS is paused - returning mock update');
      return Response.json({
        success: true,
        saleID: saleID,
        message: 'POS paused - mock update completed'
      });
    }

    if (!saleID || !items || !shopID || !registerID || !employeeCode || !locationId) {
      return Response.json({ 
        error: 'saleID, items, shopID, registerID, employeeCode, and locationId are required' 
      }, { status: 400 });
    }

    // Look up employeeID from employee code
    const employeeCodes = await base44.asServiceRole.entities.EmployeeCode.filter({ code: employeeCode });
    if (employeeCodes.length === 0) {
      return Response.json({ 
        error: 'Employee code not found' 
      }, { status: 400 });
    }

    const employeeID = employeeCodes[0].employeeID;
    if (!employeeID) {
      return Response.json({ 
        error: 'Employee ID not set for this employee code. Please sync employees from Lightspeed.' 
      }, { status: 400 });
    }

    // Get access token
    const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
    if (!tokenResponse.data.success) {
      return Response.json({ 
        error: 'Failed to get access token',
        needsReauth: tokenResponse.data.needsReauth 
      }, { status: 401 });
    }

    const accessToken = tokenResponse.data.access_token;

    // Decode token to get accountID
    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const accountID = payload.acct;
    
    console.log('Updating sale:', saleID);
    console.log('Account ID:', accountID);
    
    if (!accountID) {
      return Response.json({ 
        success: false,
        error: 'Could not extract accountID from access token' 
      }, { status: 500 });
    }

    // First GET the existing sale to preserve customerID if needed
    const getUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Sale/${saleID}.json`;
    const getResponse = await fetch(getUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error('Failed to fetch existing sale:', errorText);
      return Response.json({ 
        success: false,
        error: `Failed to fetch existing sale: ${errorText}` 
      }, { status: getResponse.status });
    }

    const existingSale = await getResponse.json();
    const existingCustomerID = existingSale.Sale?.customerID;

    // Delete the existing sale
    const deleteUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Sale/${saleID}.json`;
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('Failed to delete existing sale:', errorText);
      return Response.json({ 
        success: false,
        error: `Failed to delete existing sale: ${errorText}` 
      }, { status: deleteResponse.status });
    }

    console.log('Deleted old sale:', saleID);

    // Create SaleLines from items
    const saleLines = items.map(item => ({
      itemID: parseInt(item.itemID),
      unitQuantity: item.quantity || 1,
      tax: false,
      tax1Rate: 0,
      tax2Rate: 0
    }));

    // Create new sale with all items
    const saleData = {
      employeeID: parseInt(employeeID),
      registerID: parseInt(registerID),
      shopID: parseInt(shopID),
      completed: false,
      SaleLines: {
        SaleLine: saleLines
      }
    };

    // Add customerID - use provided one or preserve from existing sale
    const finalCustomerID = customerID || existingCustomerID;
    if (finalCustomerID) {
      saleData.customerID = parseInt(finalCustomerID);
      console.log('Adding customer ID to new sale:', finalCustomerID);
    }

    const createUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Sale.json`;

    console.log('=== CREATE NEW SALE REQUEST ===');
    console.log('URL:', createUrl);
    console.log('Sale lines count:', saleLines.length);

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(saleData)
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Lightspeed API error:', errorText);
      return Response.json({ 
        success: false,
        error: `Failed to create new sale: ${errorText}` 
      }, { status: createResponse.status });
    }

    const newSale = await createResponse.json();
    const newSaleID = newSale.Sale.saleID;

    console.log('Created new sale:', newSaleID);

    return Response.json({ 
      success: true,
      saleID: newSaleID,
      sale: newSale.Sale
    });

  } catch (error) {
    console.error('Error in lightspeedUpdateSale:', error);
    console.error('Error stack:', error.stack);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});