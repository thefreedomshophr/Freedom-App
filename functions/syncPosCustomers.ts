import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin check
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    const { locationId, limit = 10, nextUrl = null } = await req.json();
    
    if (!locationId) {
      return Response.json({ error: 'Missing locationId' }, { status: 400 });
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
    
    // Fetch only ONE batch of customers using next URL pagination, sorted by customerID
    const apiUrl = nextUrl || `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Customer.json?load_relations=["Contact"]&orderby=customerID&orderby_direction=ASC&limit=${limit}`;
    
    console.log(`Fetching customers from Lightspeed...`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error:`, response.status, errorText);
      return Response.json({ 
        error: `Failed to fetch customers from Lightspeed`,
        status: response.status,
        details: errorText 
      }, { status: 500 });
    }

    const data = await response.json();
    const customers = Array.isArray(data.Customer) ? data.Customer : (data.Customer ? [data.Customer] : []);
    
    console.log(`Fetched ${customers.length} customers`);
    
    // Get next URL for pagination
    const nextPageUrl = data['@attributes']?.next || null;
    const hasMore = !!nextPageUrl;
    
    // Get existing customers
    const existingCustomers = await base44.asServiceRole.entities.CustomerInformation.list();
    const existingMap = new Map(existingCustomers.map(c => [c.customerID, c]));
    
    let createdCount = 0;
    let updatedCount = 0;

    console.log(`Processing ${customers.length} customers...`);

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      const phones = customer.Contact?.Phones?.ContactPhone 
        ? (Array.isArray(customer.Contact.Phones.ContactPhone) 
          ? customer.Contact.Phones.ContactPhone 
          : [customer.Contact.Phones.ContactPhone])
        : [];

      const emails = customer.Contact?.Emails?.ContactEmail 
        ? (Array.isArray(customer.Contact.Emails.ContactEmail) 
          ? customer.Contact.Emails.ContactEmail 
          : [customer.Contact.Emails.ContactEmail])
        : [];

      const customerID = String(customer.customerID);
      const firstName = customer.firstName || '';
      const lastName = customer.lastName || '';
      const name = `${firstName} ${lastName}`.trim();

      // Extract phone numbers by type
      const homePhone = phones.find(p => p.useType === 'Home')?.number || '';
      const workPhone = phones.find(p => p.useType === 'Work')?.number || '';
      const mobilePhone = phones.find(p => p.useType === 'Mobile')?.number || '';
      const email = emails[0]?.address || '';

      const existing = existingMap.get(customerID);

      const customerData = {
        name,
        home: homePhone,
        work: workPhone,
        mobile: mobilePhone,
        email,
        customerID
      };

      if (existing) {
        await base44.asServiceRole.entities.CustomerInformation.update(existing.id, customerData);
        updatedCount++;
      } else {
        await base44.asServiceRole.entities.CustomerInformation.create(customerData);
        createdCount++;
      }

      // Add delay every 5 customers to avoid rate limits
      if ((i + 1) % 5 === 0 && i + 1 < customers.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      }

    console.log(`Completed: ${createdCount} created, ${updatedCount} updated`);
    
    return Response.json({ 
      success: true,
      synced: createdCount + updatedCount,
      created: createdCount,
      updated: updatedCount,
      hasMore: hasMore,
      nextUrl: nextPageUrl
    });
    
  } catch (error) {
    console.error('Error in syncPosCustomers:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});