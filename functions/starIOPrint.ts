import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const STARIO_API_KEY = Deno.env.get('STARIO_API_KEY');
const STARIO_DEVICE_GROUP_PATH = Deno.env.get('STARIO_DEVICE_GROUP_PATH');
const STARIO_REGION = Deno.env.get('STARIO_REGION') || 'us';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { receipt_data, device_id, location_id } = await req.json();

    if (!receipt_data) {
      return Response.json({ error: 'receipt_data is required' }, { status: 400 });
    }

    // Determine API base URL based on region
    const apiBase = STARIO_REGION === 'eu' 
      ? 'https://eu-api.stario.online/v1'
      : 'https://api.stario.online/v1';

    // Extract just the path from device group URL (e.g., "Freedom" from "https://device.stario.online/cloudprnt/Freedom")
    let deviceGroupPath = STARIO_DEVICE_GROUP_PATH;
    if (deviceGroupPath.startsWith('http')) {
      deviceGroupPath = deviceGroupPath.split('/').pop();
    }

    // Get device_id from location if not explicitly provided
    let targetDeviceId = device_id;
    
    console.log('Received location_id:', location_id);
    console.log('Received device_id:', device_id);
    
    if (!targetDeviceId && location_id) {
      try {
        const locations = await base44.asServiceRole.entities.Location.filter({ id: location_id });
        console.log('Found locations:', locations.length);
        
        if (locations.length > 0) {
          const location = locations[0];
          console.log('Location stario_device_id:', location.stario_device_id);
          
          if (location.stario_device_id) {
            targetDeviceId = location.stario_device_id;
          }
        }
      } catch (error) {
        console.error('Error fetching location:', error);
        return Response.json({ 
          error: `Failed to fetch location: ${error.message}` 
        }, { status: 500 });
      }
    }

    console.log('Final targetDeviceId:', targetDeviceId);

    if (!targetDeviceId) {
      return Response.json({ 
        error: 'No device configured for this location. Please set up a printer in Admin > Printer Setup.' 
      }, { status: 400 });
    }

    // Send print job
    const printUrl = `${apiBase}/a/${deviceGroupPath}/d/${targetDeviceId}/q`;
    console.log('Print URL:', printUrl);
    console.log('API Base:', apiBase);
    console.log('Device Group Path:', deviceGroupPath);
    console.log('Device ID:', targetDeviceId);
    
    const printResponse = await fetch(printUrl, {
      method: 'POST',
      headers: {
        'Star-Api-Key': STARIO_API_KEY,
        'Content-Type': 'text/vnd.star.markup'
      },
      body: receipt_data
    });

    console.log('Print response status:', printResponse.status);
    
    if (!printResponse.ok) {
      const errorText = await printResponse.text();
      console.error('Print API error:', errorText);
      return Response.json({ 
        error: 'Print job failed', 
        details: errorText,
        status: printResponse.status,
        url: printUrl
      }, { status: 500 });
    }

    const result = await printResponse.json();

    return Response.json({ 
      success: true, 
      jobId: result.JobId,
      deviceId: targetDeviceId,
      message: 'Print job sent successfully'
    });

  } catch (error) {
    console.error('StarIO print error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});