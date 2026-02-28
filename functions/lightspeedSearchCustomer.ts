import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phone, locationId } = await req.json();

    if (!phone) {
      return Response.json({ error: 'Missing phone' }, { status: 400 });
    }

    if (!locationId) {
      return Response.json({ error: 'Missing locationId' }, { status: 400 });
    }

    // Get access token for Lightspeed API
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

    // Normalize phone (remove all non-digits)
    const normalizedPhone = phone.replace(/\D/g, '');
    console.log('🔍 Searching Lightspeed for phone:', normalizedPhone);

    // Fetch all customers with pagination since Lightspeed doesn't support phone number filtering
    let allCustomers = [];
    let nextUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Customer.json?load_relations=["Contact"]&limit=100`;

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const responseText = await response.text();
        await base44.asServiceRole.entities.DeviceLog.create({
          message: 'Lightspeed Customer Fetch Failed',
          level: 'error',
          data: JSON.stringify({
            status: response.status,
            statusText: response.statusText,
            body: responseText
          }, null, 2)
        });
        break;
      }

      const responseText = await response.text();
      const data = JSON.parse(responseText);
      const customers = Array.isArray(data.Customer) ? data.Customer : (data.Customer ? [data.Customer] : []);

      allCustomers = allCustomers.concat(customers);

      // Use the next URL from the response attributes
      nextUrl = data['@attributes']?.next || '';
    }

    await base44.asServiceRole.entities.DeviceLog.create({
      message: 'Lightspeed Customer Search',
      level: 'info',
      data: JSON.stringify({
        phone: normalizedPhone,
        totalCustomersFetched: allCustomers.length
      }, null, 2)
    });

    // Filter for exact phone match (any useType, not just Mobile)
    let foundCustomer = null;

    for (const customer of allCustomers) {
      const phones = customer.Contact?.Phones?.ContactPhone;
      if (!phones) continue;

      const phoneArray = Array.isArray(phones) ? phones : [phones];
      
      for (const phone of phoneArray) {
        const customerPhone = phone.number?.replace(/\D/g, '') || '';
        if (customerPhone === normalizedPhone) {
          foundCustomer = customer;
          console.log('✅ Found customer with matching phone:', customer.customerID, customer.firstName, customer.lastName, 'useType:', phone.useType);
          break;
        }
      }
      
      if (foundCustomer) break;
    }

    if (!foundCustomer) {
      console.log('❌ No customer found with phone:', normalizedPhone);
      await base44.asServiceRole.entities.DeviceLog.create({
        message: 'Customer Not Found After Full Search',
        level: 'warn',
        data: JSON.stringify({
          searchedPhone: normalizedPhone,
          totalCustomersSearched: allCustomers.length
        }, null, 2)
      });
    }

    if (foundCustomer) {
      const customerID = String(foundCustomer.customerID);
      const firstName = foundCustomer.firstName || '';
      const lastName = foundCustomer.lastName || '';

      // Extract email from Contact.Emails.ContactEmail array
      const emails = foundCustomer.Contact?.Emails?.ContactEmail 
        ? (Array.isArray(foundCustomer.Contact.Emails.ContactEmail) 
          ? foundCustomer.Contact.Emails.ContactEmail 
          : [foundCustomer.Contact.Emails.ContactEmail])
        : [];

      const email = emails[0]?.address || '';

      console.log('📋 Returning customer data:', { customerID, firstName, lastName, email, phone: normalizedPhone });

      return Response.json({
        success: true,
        found: true,
        customer: {
          customerID,
          firstName,
          lastName,
          email,
          phone: normalizedPhone
        }
      });
    }

    console.log('❌ Customer not found');

    return Response.json({
      success: true,
      found: false
    });

  } catch (error) {
    console.error('Error in lightspeedSearchCustomer:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});