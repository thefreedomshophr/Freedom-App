import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Link as LinkIcon, CheckCircle, AlertCircle, RefreshCw, Copy, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLocationApiSetup() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const locationId = urlParams.get('locationId');

  const [location, setLocation] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    lightspeed_client_id: '',
    lightspeed_client_secret: ''
  });

  useEffect(() => {
    if (!locationId) {
      navigate(createPageUrl("AdminLocations"));
      return;
    }
    loadData();
    const baseUrl = window.location.origin;
    setCallbackUrl(`${baseUrl}/api/functions/lightspeedCallback`);
  }, [locationId]);

  const loadData = async () => {
    await Promise.all([loadLocation(), loadTokenInfo()]);
  };

  const loadLocation = async () => {
    try {
      const locations = await base44.entities.Location.filter({ id: locationId });
      if (locations.length === 0) {
        navigate(createPageUrl("AdminLocations"));
        return;
      }
      const loc = locations[0];
      setLocation(loc);
      setFormData({
        lightspeed_client_id: loc.lightspeed_client_id || '',
        lightspeed_client_secret: loc.lightspeed_client_secret || ''
      });
    } catch (error) {
      console.error('Error loading location:', error);
    }
  };

  const loadTokenInfo = async () => {
    try {
      const tokens = await base44.entities.PosToken.filter({ location_id: locationId });
      if (tokens.length > 0) {
        setTokenInfo(tokens[0]);
      }
    } catch (error) {
      console.error('Error loading token info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!formData.lightspeed_client_id || !formData.lightspeed_client_secret) {
      alert('Please enter both Client ID and Client Secret');
      return;
    }

    setSaving(true);
    try {
      await base44.entities.Location.update(locationId, {
        lightspeed_client_id: formData.lightspeed_client_id,
        lightspeed_client_secret: formData.lightspeed_client_secret
      });
      await loadLocation();
      alert('Credentials saved successfully');
    } catch (error) {
      console.error('Error saving credentials:', error);
      alert('Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    if (!location?.lightspeed_client_id || !location?.lightspeed_client_secret) {
      alert('Please save your Client ID and Client Secret first');
      return;
    }

    try {
      const state = `location_${locationId}_${Date.now()}`;
      
      const response = await base44.functions.invoke('lightspeedGetAuthUrl', { 
        state,
        locationId,
        clientId: location.lightspeed_client_id
      });
      
      if (!response.data?.success || !response.data?.auth_url) {
        alert('Failed to generate authorization URL');
        return;
      }
      
      window.top.location.href = response.data.auth_url;
    } catch (error) {
      console.error('Error connecting:', error);
      alert('Failed to connect: ' + error.message);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect the Lightspeed API for ${location?.name}?`)) {
      return;
    }

    try {
      if (tokenInfo) {
        await base44.entities.PosToken.delete(tokenInfo.id);
        setTokenInfo(null);
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      alert('Failed to disconnect');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isExpired = () => {
    if (!tokenInfo?.expires_at) return false;
    return new Date(tokenInfo.expires_at) <= new Date();
  };

  const expiresIn = () => {
    if (!tokenInfo?.expires_at) return '';
    const diff = new Date(tokenInfo.expires_at) - new Date();
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 24) return `${Math.floor(hours / 24)} days`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes} minutes`;
  };

  if (!location) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-100"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12 bg-gray-900">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("AdminLocations"))}
          className="mb-6 gap-2 text-gray-300 hover:text-gray-100"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Locations
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl font-light text-gray-100 mb-2">
              Lightspeed API Setup - {location.name}
            </h1>
            <p className="text-gray-400">Configure API credentials for this location</p>
          </div>

          {/* API Credentials */}
          <Card className="border-0 shadow-lg bg-gray-800">
            <CardHeader>
              <CardTitle className="text-xl text-gray-100">API Credentials</CardTitle>
              <CardDescription className="text-gray-400">
                Enter the Client ID and Client Secret for this location's API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="clientId" className="text-gray-300">Client ID</Label>
                <Input
                  id="clientId"
                  value={formData.lightspeed_client_id}
                  onChange={(e) => setFormData({ ...formData, lightspeed_client_id: e.target.value })}
                  placeholder="Enter your Lightspeed Client ID"
                  className="bg-gray-700 border-gray-600 text-gray-100"
                />
              </div>
              <div>
                <Label htmlFor="clientSecret" className="text-gray-300">Client Secret</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  value={formData.lightspeed_client_secret}
                  onChange={(e) => setFormData({ ...formData, lightspeed_client_secret: e.target.value })}
                  placeholder="Enter your Lightspeed Client Secret"
                  className="bg-gray-700 border-gray-600 text-gray-100"
                />
              </div>
              <Button
                onClick={handleSaveCredentials}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {saving ? 'Saving...' : 'Save Credentials'}
              </Button>
            </CardContent>
          </Card>

          {/* Setup Instructions */}
          <Card className="border-0 shadow-lg bg-gray-800">
            <CardHeader>
              <CardTitle className="text-xl text-gray-100">Setup Instructions</CardTitle>
              <CardDescription className="text-gray-400">
                Follow these steps to connect your Lightspeed account for this location
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-blue-900/20 border-blue-700">
                <AlertDescription className="text-gray-300">
                  <strong className="text-gray-100">Important:</strong> You need to register this redirect URI in your Lightspeed developer account BEFORE connecting.
                </AlertDescription>
              </Alert>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">
                  1. Copy this Redirect URI
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={callbackUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-700 rounded-md bg-gray-900 text-gray-100 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(callbackUrl)}
                    className="border-gray-700 text-gray-300 hover:text-gray-100 hover:bg-gray-700"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                {copied && (
                  <p className="text-sm text-green-400 mt-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Copied!
                  </p>
                )}
              </div>

              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-gray-100">2. Register in Lightspeed:</p>
                <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                  <li>Go to your Lightspeed developer portal</li>
                  <li>Create or edit your API application</li>
                  <li>Add the Redirect URI shown above</li>
                  <li>Make sure to enable the "employee:all" scope</li>
                  <li>Copy the Client ID and Client Secret</li>
                  <li>Paste them in the API Credentials section above</li>
                  <li>Save your changes</li>
                </ol>
                <a
                  href="https://cloud.lightspeedapp.com/oauth/register.php"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2"
                >
                  Open Lightspeed Developer Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Connection Status */}
          <Card className="border-0 shadow-lg bg-gray-800">
            <CardHeader>
              <CardTitle className="text-2xl text-gray-100">Connection Status</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                  <p className="text-gray-400 mt-4">Loading...</p>
                </div>
              ) : tokenInfo ? (
                <div className="space-y-6">
                  <div className={`p-4 rounded-lg border-2 ${isExpired() ? 'bg-red-900/20 border-red-700' : 'bg-green-900/20 border-green-700'}`}>
                    <div className="flex items-center gap-3">
                      {isExpired() ? (
                        <AlertCircle className="w-6 h-6 text-red-400" />
                      ) : (
                        <CheckCircle className="w-6 h-6 text-green-400" />
                      )}
                      <div>
                        <p className={`font-medium ${isExpired() ? 'text-red-200' : 'text-green-200'}`}>
                          {isExpired() ? 'Connection Expired' : 'Connected to Lightspeed'}
                        </p>
                        <p className={`text-sm ${isExpired() ? 'text-red-300' : 'text-green-300'}`}>
                          {isExpired() ? 'Please reconnect' : `Token expires in ${expiresIn()}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Connected Since:</span>
                      <span className="font-medium text-gray-200">{new Date(tokenInfo.created_date).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Token Type:</span>
                      <span className="font-medium text-gray-200">{tokenInfo.token_type}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Scope:</span>
                      <span className="font-medium text-gray-200">{tokenInfo.scope || 'employee:all'}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {isExpired() && (
                      <Button
                        onClick={handleConnect}
                        className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                      >
                        <LinkIcon className="w-4 h-4" />
                        Reconnect
                      </Button>
                    )}
                    <Button
                      onClick={handleDisconnect}
                      variant="outline"
                      className="flex-1 border-red-700 text-red-400 hover:bg-red-900/20"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <LinkIcon className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-medium text-gray-100 mb-2">
                    Not Connected
                  </h3>
                  <p className="text-gray-400 mb-6 max-w-md mx-auto">
                    Make sure you've saved your API credentials and completed the setup instructions above, then click Connect.
                  </p>
                  <Button
                    onClick={handleConnect}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                    size="lg"
                    disabled={!location?.lightspeed_client_id || !location?.lightspeed_client_secret}
                  >
                    <LinkIcon className="w-5 h-5" />
                    Connect to Lightspeed
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}