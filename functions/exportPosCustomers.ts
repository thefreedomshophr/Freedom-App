import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    const { locationId } = await req.json();
    
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
    
    // Fetch all customers in batches
    let allCustomers = [];
    let nextUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Customer.json?load_relations=["Contact"]&limit=100`;

    while (nextUrl) {
      console.log(`Fetching customers... (total so far: ${allCustomers.length})`);
      
      const response = await fetch(nextUrl, {
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
      allCustomers = [...allCustomers, ...customers];
      
      // Get next page URL
      nextUrl = data['@attributes']?.next || null;
      
      // Add delay to avoid rate limits
      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Fetched total of ${allCustomers.length} customers`);

    // Generate CSV
    const csvRows = [
      ['Name', 'Home', 'Work', 'Mobile', 'Email', 'Customer ID']
    ];

    allCustomers.forEach(customer => {
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

      const firstName = customer.firstName || '';
      const lastName = customer.lastName || '';
      const name = `${firstName} ${lastName}`.trim();
      const homePhone = phones.find(p => p.useType === 'Home')?.number || '';
      const workPhone = phones.find(p => p.useType === 'Work')?.number || '';
      const mobilePhone = phones.find(p => p.useType === 'Mobile')?.number || '';
      const email = emails[0]?.address || '';

      csvRows.push([name, homePhone, workPhone, mobilePhone, email, customer.customerID]);
    });

    const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=lightspeed-customers-${new Date().toISOString().split('T')[0]}.csv`
      }
    });
    
  } catch (error) {
    console.error('Error in exportPosCustomers:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});