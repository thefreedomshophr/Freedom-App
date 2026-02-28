import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    console.log('\n=== CREATE POS CUSTOMER STARTED ===');
    
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { firstName, lastName, phone, email } = body;

    // Check if POS is paused
    const user = await base44.auth.me();
    if (user?.pos_paused) {
      console.log('POS is paused - returning mock customer');
      return Response.json({
        success: true,
        customerID: 'PAUSED-' + Date.now(),
        message: 'POS paused - mock customer created'
      });
    }

    if (!firstName || !lastName || !phone) {
      console.log('❌ Missing required fields');
      return Response.json({ 
        error: 'firstName, lastName, and phone are required' 
      }, { status: 400 });
    }

    console.log('Customer data:');
    console.log('  - firstName:', firstName);
    console.log('  - lastName:', lastName);
    console.log('  - phone:', phone);

    // Check if customer already exists in our database
    console.log('\n--- Checking Local Database ---');
    const existingCustomers = await base44.asServiceRole.entities.CustomerInformation.filter({ phone });
    
    if (existingCustomers.length > 0) {
      console.log('✓ Customer exists in local database');
      const localCustomer = existingCustomers[0];
      
      if (localCustomer.customerID) {
        console.log('✓ Has customerID:', localCustomer.customerID);
        return Response.json({ 
          success: true,
          customerExists: true,
          customerID: localCustomer.customerID,
          localCustomer: localCustomer
        });
      }
    }

    console.log('Customer not in local DB or missing customerID, checking POS...');

    // Get access token
    console.log('\n--- Getting Lightspeed Access Token ---');
    const tokenResponse = await base44.functions.invoke('lightspeedGetToken');
    
    if (!tokenResponse.data.success) {
      console.log('❌ Failed to get access token');
      return Response.json({ 
        error: 'Failed to get access token',
        needsReauth: tokenResponse.data.needsReauth 
      }, { status: 401 });
    }

    const accessToken = tokenResponse.data.access_token;
    console.log('✓ Access token obtained');

    // Decode token to get accountID
    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const accountID = payload.acct;
    console.log('Account ID:', accountID);

    // Search for existing customer in POS by mobile phone (useType:Mobile) ONLY
    console.log('\n--- Searching POS for Existing Customer ---');
    // Normalize phone (remove all non-digits)
    const normalizedPhone = phone.replace(/\D/g, '');

    // Fetch all customers with pagination since Lightspeed doesn't support phone number filtering
    let allCustomers = [];
    let nextUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Customer.json?load_relations=["Contact"]&limit=100`;

    while (nextUrl) {
      const searchResponse = await fetch(nextUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!searchResponse.ok) {
        const searchResponseText = await searchResponse.text();
        console.log('❌ Search failed:', searchResponse.status, searchResponseText);
        break;
      }

      const searchResponseText = await searchResponse.text();
      const searchData = JSON.parse(searchResponseText);
      const customers = Array.isArray(searchData.Customer) ? searchData.Customer : (searchData.Customer ? [searchData.Customer] : []);

      allCustomers = allCustomers.concat(customers);

      // Use the next URL from the response attributes
      nextUrl = searchData['@attributes']?.next || '';
    }

    console.log(`Fetched ${allCustomers.length} total customers, searching for phone: ${normalizedPhone}`);

    // Filter for exact phone match (any useType, not just Mobile)
    let posCustomer = null;

    for (const customer of allCustomers) {
      const phones = customer.Contact?.Phones?.ContactPhone;
      if (!phones) continue;

      const phoneArray = Array.isArray(phones) ? phones : [phones];
      
      for (const phoneObj of phoneArray) {
        const customerPhone = phoneObj.number?.replace(/\D/g, '') || '';
        if (customerPhone === normalizedPhone) {
          posCustomer = customer;
          console.log('✅ Found existing customer with matching phone:', customer.customerID, customer.firstName, customer.lastName, 'useType:', phoneObj.useType);
          break;
        }
      }
      
      if (posCustomer) break;
    }

    if (!posCustomer) {
      console.log('❌ No customer found with phone:', normalizedPhone, 'after searching', allCustomers.length, 'customers');
    }

    if (posCustomer) {
      console.log('✓ Found existing customer in POS:', posCustomer.customerID);
      
      // Save to local database if not already there
      if (existingCustomers.length === 0) {
        await base44.asServiceRole.entities.CustomerInformation.create({
          name: `${firstName} ${lastName}`,
          phone: phone,
          email: email || '',
          customerID: posCustomer.customerID
        });
        console.log('✓ Saved to local database');
      } else if (!existingCustomers[0].customerID) {
        // Update existing record with customerID
        await base44.asServiceRole.entities.CustomerInformation.update(existingCustomers[0].id, {
          customerID: posCustomer.customerID
        });
        console.log('✓ Updated local database with customerID');
      }
      
      return Response.json({ 
        success: true,
        customerExists: true,
        customerID: posCustomer.customerID,
        pos_customer: posCustomer
      });
    }
    
    console.log('No existing customer found in POS, creating new one...');

    // Create new customer in POS
    console.log('\n--- Creating New Customer in POS ---');
    const customerData = {
      firstName,
      lastName,
      Contact: {
        Phones: {
          ContactPhone: {
            number: phone,
            useType: 'Mobile'
          }
        }
      }
    };

    if (email && email.trim()) {
      customerData.Contact.Emails = {
        ContactEmail: {
          address: email,
          useType: 'Primary'
        }
      };
    }

    const createUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Customer.json`;
    
    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(customerData)
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log('❌ Create failed:', errorText);
      return Response.json({ 
        error: `Failed to create customer: ${errorText}` 
      }, { status: createResponse.status });
    }

    const createdCustomer = await createResponse.json();
    const newCustomerID = createdCustomer.Customer.customerID;
    console.log('✅ Customer created in POS:', newCustomerID);

    // Save to local database
    await base44.asServiceRole.entities.CustomerInformation.create({
      name: `${firstName} ${lastName}`,
      phone: phone,
      email: email || '',
      customerID: newCustomerID
    });
    console.log('✓ Saved to local database');

    console.log('=== CREATE POS CUSTOMER COMPLETED ===\n');

    return Response.json({ 
      success: true,
      customerExists: false,
      customerID: newCustomerID,
      pos_customer: createdCustomer.Customer
    });

  } catch (error) {
    console.error('\n❌ EXCEPTION in createPosCustomer ❌');
    console.error('Error:', error.message);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});