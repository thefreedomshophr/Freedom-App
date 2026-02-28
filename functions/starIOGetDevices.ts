import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { apiKey, deviceGroupPath, region } = await req.json();

    if (!apiKey || !deviceGroupPath) {
      return Response.json({ 
        error: 'API Key and Device Group Path are required' 
      }, { status: 400 });
    }

    // Extract just the path from full URL if provided (e.g., "Freedom" from "https://device.stario.online/cloudprnt/Freedom")
    let groupPath = deviceGroupPath;
    if (deviceGroupPath.startsWith('http')) {
      groupPath = deviceGroupPath.split('/').pop();
    }

    // Determine API base URL based on region
    const apiBase = region === 'eu' 
      ? 'https://eu-api.stario.online/v1'
      : 'https://api.stario.online/v1';

    // Get list of devices in the device group
    const devicesResponse = await fetch(
      `${apiBase}/a/${groupPath}/d`,
      {
        headers: {
          'Star-Api-Key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!devicesResponse.ok) {
      const errorText = await devicesResponse.text();
      console.error('StarIO API Error:', {
        status: devicesResponse.status,
        statusText: devicesResponse.statusText,
        details: errorText
      });
      return Response.json({ 
        error: 'Failed to fetch devices', 
        details: errorText,
        status: devicesResponse.status
      }, { status: 500 });
    }

    const deviceList = await devicesResponse.json();

    return Response.json({ 
      devices: deviceList.map(d => ({
        accessIdentifier: d.AccessIdentifier,
        name: d.Name || d.MacAddress,
        macAddress: d.MacAddress,
        model: d.Model,
        online: d.LastConnection !== undefined ? d.LastConnection <= 90 : false
      }))
    });

  } catch (error) {
    console.error('StarIO get devices error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});