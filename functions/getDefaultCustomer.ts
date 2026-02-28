import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Check if POS is paused
    const user = await base44.auth.me();
    if (user?.pos_paused) {
      console.log('POS is paused - returning mock default customer');
      return Response.json({
        success: true,
        customerID: 'PAUSED-DEFAULT',
        message: 'POS paused - mock default customer'
      });
    }

        // Get access token
    const tokenResponse = await base44.functions.invoke('lightspeedGetToken');
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

    // Search for customer with phone 9716010888
    const searchUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Customer.json?load_relations=["Contact"]`;
    
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      return Response.json({ 
        error: `Failed to search customers: ${errorText}` 
      }, { status: searchResponse.status });
    }

    const searchData = await searchResponse.json();
    const customers = Array.isArray(searchData.Customer) ? searchData.Customer : (searchData.Customer ? [searchData.Customer] : []);

    // Find customer with phone 9716010888
    const defaultPhone = '9716010888';
    const normalizedDefaultPhone = defaultPhone.replace(/\D/g, '');
    
    const defaultCustomer = customers.find(customer => {
      if (!customer.Contact?.Phones) return false;
      
      const phones = Array.isArray(customer.Contact.Phones.ContactPhone) 
        ? customer.Contact.Phones.ContactPhone 
        : (customer.Contact.Phones.ContactPhone ? [customer.Contact.Phones.ContactPhone] : []);
      
      return phones.some(p => {
        const normalizedPhone = (p.number || '').replace(/\D/g, '');
        return normalizedPhone === normalizedDefaultPhone;
      });
    });

    if (!defaultCustomer) {
      return Response.json({ 
        error: 'Default customer not found. Please create a customer with phone 9716010888 in Lightspeed.' 
      }, { status: 404 });
    }

    return Response.json({ 
      success: true,
      customerID: defaultCustomer.customerID
    });

  } catch (error) {
    console.error('Error getting default customer:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});