import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Server, Save, Send } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminPrinterServer() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [formData, setFormData] = useState({
    server_url: ''
  });
  const [testData, setTestData] = useState(JSON.stringify({
    print_job: {
      items: [
        { name: "Large Black Hoodie", price: 45.00, quantity: 1 },
        { name: "Logo Print - Front", price: 15.00, quantity: 1 },
        { name: "Wax Protection", price: 10.00, quantity: 1 }
      ],
      total: 70.00,
      customer: "Test Customer",
      date: new Date().toISOString().split('T')[0]
    }
  }, null, 2));
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    checkAdminAndLoadConfig();
  }, []);

  const checkAdminAndLoadConfig = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser.role !== 'admin') {
        navigate(createPageUrl("AdminDashboard"));
        return;
      }
      await loadConfig();
    } catch (error) {
      console.error('Error checking admin:', error);
      navigate(createPageUrl("AdminDashboard"));
    }
  };

  const loadConfig = async () => {
    try {
      const configs = await base44.entities.PrinterConfig.list();
      if (configs.length > 0) {
        const existingConfig = configs[0];
        setConfig(existingConfig);
        setFormData({
          server_url: existingConfig.server_url || ''
        });
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.server_url.trim()) {
      alert('Please fill in the server URL');
      return;
    }

    setSaving(true);
    try {
      if (config) {
        await base44.entities.PrinterConfig.update(config.id, formData);
      } else {
        await base44.entities.PrinterConfig.create(formData);
      }
      await loadConfig();
      alert('Printer server configuration saved successfully');
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration');
    }
    setSaving(false);
  };

  const handleTestPrint = async () => {
    if (!formData.server_url.trim()) {
      alert('Please save your server configuration first');
      return;
    }

    setTesting(true);
    setTestResult(null);
    
    try {
      const payload = JSON.parse(testData);
      console.log('Sending to:', `${formData.server_url}/print`);
      console.log('Payload:', payload);
      
      const response = await base44.functions.invoke('testPrinterServer', {
        server_url: formData.server_url,
        payload: payload
      });

      console.log('Response:', response.data);
      
      if (response.data.success) {
        setTestResult({ success: true, message: 'Print job sent successfully', data: response.data.data });
      } else {
        setTestResult({ success: false, message: response.data.error || `Server returned ${response.data.status}` });
      }
    } catch (error) {
      console.error('Print test error:', error);
      setTestResult({ success: false, message: `Error: ${error.message}` });
    }
    
    setTesting(false);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("AdminDashboard"))}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-light mb-2">
            Printer Server Configuration
          </h1>
          <p className="text-muted-foreground font-light">
            Configure your Raspberry Pi printer server connection
          </p>
        </motion.div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Server className="w-5 h-5" />
              Server Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="server_url">
                Server URL *
              </Label>
              <Input
                id="server_url"
                value={formData.server_url}
                onChange={(e) => setFormData({ ...formData, server_url: e.target.value })}
                placeholder="http://192.168.1.100:5000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The URL where your Raspberry Pi printer server is running
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {config && (
          <Card className="border-0 shadow-lg mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-green-500">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Configuration saved</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Server: {config.server_url}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-lg mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Test Print Job</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="test_data">
                Test Data
              </Label>
              <Textarea
                id="test_data"
                value={testData}
                onChange={(e) => setTestData(e.target.value)}
                placeholder="Enter test receipt content..."
                rows={6}
                className="font-mono"
              />
            </div>

            <Button
              onClick={handleTestPrint}
              disabled={testing || !config}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Send className="w-4 h-4" />
              {testing ? 'Sending...' : 'Send Test Print'}
            </Button>

            {testResult && (
              <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-500/10 border border-green-500' : 'bg-red-500/10 border border-red-500'}`}>
                <p className={`font-semibold ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
                  {testResult.success ? '✓ Success' : '✗ Error'}
                </p>
                <p className="text-sm mt-1">{testResult.message}</p>
                {testResult.data && (
                  <pre className="text-xs text-muted-foreground mt-2 overflow-auto">
                    {JSON.stringify(testResult.data, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}