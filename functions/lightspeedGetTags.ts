import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { locationId } = await req.json();

    // Get access token
    const tokenResponse = await base44.functions.invoke('lightspeedGetToken', { locationId });
    const tokenData = tokenResponse.data;

    if (!tokenData.success) {
      return Response.json({ success: false, error: 'Failed to get access token' }, { status: 401 });
    }

    const accessToken = tokenData.access_token;

    // Decode JWT to get account ID
    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const accountID = payload.acct;

    // Fetch tags
    const tagsResponse = await fetch(`https://api.lightspeedapp.com/API/V3/Account/${accountID}/Tag.json`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!tagsResponse.ok) {
      const errorText = await tagsResponse.text();
      return Response.json({ 
        success: false, 
        error: 'Failed to fetch tags from Lightspeed',
        details: errorText 
      }, { status: 500 });
    }

    const tagsData = await tagsResponse.json();
    const tags = Array.isArray(tagsData.Tag) ? tagsData.Tag : (tagsData.Tag ? [tagsData.Tag] : []);

    // Log full tags list to Device Logs
    await base44.asServiceRole.entities.DeviceLog.create({
      message: `All Lightspeed Tags (${tags.length} total)`,
      level: 'info',
      data: JSON.stringify(tags, null, 2)
    });

    return Response.json({
      success: true,
      tags,
      fullResponse: tagsData,
      message: `Logged ${tags.length} tags to Device Logs`
    });

  } catch (error) {
    console.error('[lightspeedGetTags] Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});