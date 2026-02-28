import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerID, firstName, lastName, email, phone, locationId } = await req.json();

    if (!customerID || !locationId) {
      return Response.json({ error: 'Missing customerID or locationId' }, { status: 400 });
    }

    // Get location to retrieve access token
    const locations = await base44.asServiceRole.entities.Location.filter({ id: locationId });
    if (locations.length === 0) {
      return Response.json({ error: 'Location not found' }, { status: 404 });
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

    console.log('📝 Updating customer:', customerID);
    console.log('Data:', { firstName, lastName, email, phone });

    // Build update data
    const customerData = {
      firstName: firstName || '',
      lastName: lastName || ''
    };

    // Build contact update - include both email AND mobile phone
    const contactData = {
      Emails: {
        ContactEmail: email ? {
          address: email,
          useType: 'Primary'
        } : undefined
      },
      Phones: {
        ContactPhone: phone ? {
          number: phone.replace(/\D/g, ''),
          useType: 'Mobile'
        } : undefined
      }
    };

    const updateUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Customer/${customerID}.json`;
    
    console.log('Update URL:', updateUrl);
    console.log('Update data:', JSON.stringify({ ...customerData, Contact: contactData }, null, 2));
    
    const response = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...customerData,
        Contact: contactData
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json({ 
        error: 'Failed to update customer',
        details: errorText 
      }, { status: response.status });
    }

    const data = await response.json();

    return Response.json({
      success: true,
      customerID: data.Customer.customerID
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});