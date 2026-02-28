import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Star cloudPRNT server endpoint
// The printer polls this URL to check for print jobs

const APP_ID = Deno.env.get('BASE44_APP_ID');
const CLOUDPRNT_AUTH_KEY = Deno.env.get('CLOUDPRNT_AUTH_KEY');
const SERVICE_TOKEN = Deno.env.get('BASE44_SERVICE_TOKEN');

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const contentType = req.headers.get('content-type') || '';
    
    console.log('=== CloudPRNT Request ===');
    console.log('Method:', req.method);
    console.log('URL:', url.toString());
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    
    // Check if request has Base44 headers (from app) or not (from printer/browser)
    const hasBase44Headers = req.headers.has('base44-app-id');
    
    // For printer requests (no auth headers), verify the auth key
    if (!hasBase44Headers) {
      const authKey = url.searchParams.get('auth');
      console.log('Printer request - checking auth key');
      
      if (!authKey || authKey !== CLOUDPRNT_AUTH_KEY) {
        console.log('Invalid or missing auth key');
        return Response.json({ error: 'Unauthorized - invalid auth key' }, { status: 401 });
      }
      
      console.log('Auth key validated');
    }
    
    // Create client based on request type
    let base44;
    if (hasBase44Headers) {
      // App request - use request client
      base44 = createClientFromRequest(req);
    } else {
      // Printer request - use service token if available
      if (SERVICE_TOKEN) {
        base44 = createClient(APP_ID, { serviceToken: SERVICE_TOKEN });
      } else {
        // Fallback to request client (service role operations from env)
        base44 = createClientFromRequest(req);
      }
    }
    
    // Handle GET request - printer polling for jobs
    if (req.method === 'GET') {
      const printerMac = req.headers.get('x-star-mac') || url.searchParams.get('mac');
      
      console.log('GET request - printer polling');
      console.log('Printer MAC:', printerMac);
      
      // Find pending jobs for this printer (or any printer if mac not specified in job)
      const pendingJobs = await base44.asServiceRole.entities.PrintJob.filter({
        status: 'pending'
      });
      
      // Find a job for this printer or an unassigned job
      const job = pendingJobs.find(j => !j.printer_mac || j.printer_mac === printerMac);
      
      console.log('Pending jobs count:', pendingJobs.length);
      console.log('Job found for printer:', !!job);
      
      if (job) {
        console.log('Returning jobReady: true for job:', job.id);
        // cloudPRNT expects JSON with jobReady: true and a mediaTypes array
        return Response.json({
          jobReady: true,
          mediaTypes: ['text/plain']
        });
      }
      
      console.log('No jobs available, returning jobReady: false');
      // No jobs available - return jobReady: false
      return Response.json({
        jobReady: false
      });
    }
    
    // Handle POST - printer requesting print data or creating new job from app
    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      console.log('POST handler - Content-Type:', contentType);
      
      // Check if printer is requesting the actual print data (Star cloudPRNT protocol)
      // The printer sends POST with mediaType it wants after receiving jobReady: true
      if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        console.log('Printer requesting print data');
        const printerMac = req.headers.get('x-star-mac') || '';
        
        // Find pending job
        const pendingJobs = await base44.asServiceRole.entities.PrintJob.filter({
          status: 'pending'
        });
        
        const job = pendingJobs.find(j => !j.printer_mac || j.printer_mac === printerMac);
        
        if (job) {
          // Mark as printing
          await base44.asServiceRole.entities.PrintJob.update(job.id, { status: 'printing' });
          
          // Return the receipt as plain text
          return new Response(job.receipt_data, {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Star-Print-Job-ID': job.id
            }
          });
        }
        
        return new Response('', { status: 200 });
      }
      
      // Check if it's a printer callback (job completion)
      const jobId = req.headers.get('x-star-print-job-id');
      console.log('Checking for printer callback, jobId:', jobId);
      if (jobId) {
        console.log('Processing printer callback for job:', jobId);
        const success = req.headers.get('x-star-result') === 'success';
        await base44.asServiceRole.entities.PrintJob.update(jobId, { 
          status: success ? 'completed' : 'failed' 
        });
        return new Response('OK', { status: 200 });
      }
      
      // Otherwise it's a request from the app to create a new print job
      if (contentType.includes('application/json')) {
        console.log('Creating new print job from app');
        const body = await req.json();
        console.log('Request body:', JSON.stringify(body));
        
        const { receipt_data, sale_id, location_id, employee_code, printer_mac } = body;
        
        if (!receipt_data) {
          console.log('ERROR: receipt_data missing');
          return Response.json({ error: 'receipt_data is required' }, { status: 400 });
        }
        
        console.log('Creating PrintJob entity...');
        const job = await base44.asServiceRole.entities.PrintJob.create({
          status: 'pending',
          receipt_data,
          sale_id: sale_id || '',
          location_id: location_id || '',
          employee_code: employee_code || '',
          printer_mac: printer_mac || ''
        });
        
        console.log('PrintJob created successfully:', job.id);
        return Response.json({ success: true, jobId: job.id });
      }
    }
    
    // Handle DELETE - clear completed/failed jobs
    if (req.method === 'DELETE') {
      // For app requests, base44 is already initialized from request
      const completedJobs = await base44.asServiceRole.entities.PrintJob.filter({
        status: 'completed'
      });
      const failedJobs = await base44.asServiceRole.entities.PrintJob.filter({
        status: 'failed'
      });
      
      for (const job of [...completedJobs, ...failedJobs]) {
        await base44.asServiceRole.entities.PrintJob.delete(job.id);
      }
      
      return Response.json({ success: true, deleted: completedJobs.length + failedJobs.length });
    }
    
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
    
  } catch (error) {
    console.error('cloudPRNT error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});