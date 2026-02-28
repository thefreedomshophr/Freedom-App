import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    console.log('lightspeedGetEmployees called');
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    console.log('User authenticated:', user?.email);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get request body
    const body = await req.json();
    const { locationId } = body;
    
    console.log('Getting access token for location:', locationId);
    const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
    console.log('Token response:', tokenResponse.data);
    const tokenData = tokenResponse.data;
    
    if (!tokenData.success) {
      return Response.json({ 
        success: false, 
        error: 'Failed to get access token',
        needsReauth: true
      }, { status: 401 });
    }
    
    const accessToken = tokenData.access_token;
    
    // Decode JWT to get account ID
    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const accountID = payload.acct;
    
    console.log('Fetching employees for account:', accountID);
    
    const employees = [];
    let nextUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountID}/Employee.json?limit=100`;
    
    // Fetch all employees with pagination using next URLs
    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch employees:', errorText);
        return Response.json({ 
          success: false, 
          error: 'Failed to fetch employees from Lightspeed' 
        }, { status: response.status });
      }
      
      const data = await response.json();
      const employeeData = data.Employee;
      
      if (employeeData) {
        const employeeArray = Array.isArray(employeeData) ? employeeData : [employeeData];
        employees.push(...employeeArray);
      }
      
      // Use the next URL from the response, or stop if there isn't one
      nextUrl = data['@attributes']?.next || null;
    }
    
    console.log(`Found ${employees.length} employees`);
    
    // Map to simplified structure
    const processedEmployees = employees.map(emp => ({
      employeeID: emp.employeeID,
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      employeeCode: emp.employeeCode || ''
    }));
    
    return Response.json({
      success: true,
      employees: processedEmployees,
      count: processedEmployees.length
    });
    
  } catch (error) {
    console.error('Error fetching employees:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});