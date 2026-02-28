import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Link as LinkIcon, CheckCircle, AlertCircle, RefreshCw, Copy, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminPosSetup() {
  const navigate = useNavigate();
  const [tokenInfo, setTokenInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [user, setUser] = useState(null);
  const [posPaused, setPosPaused] = useState(false);

  useEffect(() => {
    loadData();
    // Get the callback URL dynamically
    const baseUrl = window.location.origin;
    setCallbackUrl(`${baseUrl}/api/functions/lightspeedCallback`);
  }, []);

  const loadData = async () => {
    await Promise.all([loadTokenInfo(), loadUser()]);
  };

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setPosPaused(currentUser.pos_paused || false);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadTokenInfo = async () => {
    try {
      const tokens = await base44.entities.PosToken.list();
      if (tokens.length > 0) {
        setTokenInfo(tokens[0]);
      }
    } catch (error) {
      console.error('Error loading token info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      // Generate random state for OAuth security
      const state = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      
      // Store state in localStorage for verification
      localStorage.setItem('lightspeed_oauth_state', state);
      
      console.log('Calling backend to get auth URL...');
      
      // Get auth URL from backend
      const response = await base44.functions.invoke('lightspeedGetAuthUrl', { state });
      
      console.log('Backend response:', response);
      
      const data = response.data;
      
      if (!data || !data.success || !data.auth_url) {
        console.error('Invalid response:', data);
        alert('Failed to generate authorization URL. Make sure LIGHTSPEED_CLIENT_ID is set in secrets.');
        return;
      }
      
      console.log('Redirecting to:', data.auth_url);
      
      // Direct redirect to Lightspeed authorization page
      window.top.location.href = data.auth_url;
    } catch (error) {
      console.error('Error connecting:', error);
      alert('Failed to connect: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Lightspeed?')) {
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

  const handleTogglePause = async () => {
    try {
      const newValue = !posPaused;
      await base44.auth.updateMe({ pos_paused: newValue });
      setPosPaused(newValue);
    } catch (error) {
      console.error('Error toggling POS pause:', error);
      alert('Failed to update POS status');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("AdminDashboard"))}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl font-light mb-2">Lightspeed POS Setup</h1>
            <p className="text-muted-foreground">Connect your Lightspeed Retail account</p>
          </div>

          {/* Setup Instructions */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Setup Instructions</CardTitle>
              <CardDescription>
                Follow these steps to connect your Lightspeed account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-blue-500/10 border-blue-500">
                <AlertDescription>
                  <strong>Important:</strong> You need to register this redirect URI in your Lightspeed developer account BEFORE connecting.
                </AlertDescription>
              </Alert>

              <div>
                <label className="text-sm font-medium block mb-2">
                  1. Copy this Redirect URI
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={callbackUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border rounded-md bg-muted font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(callbackUrl)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                {copied && (
                  <p className="text-sm text-green-500 mt-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Copied!
                  </p>
                )}
              </div>

              <div className="bg-muted border rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium">2. Register in Lightspeed:</p>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Go to your Lightspeed developer portal</li>
                  <li>Create or edit your API application</li>
                  <li>Add the Redirect URI shown above</li>
                  <li>Make sure to enable the "employee:all" scope</li>
                  <li>Save your changes</li>
                </ol>
                <a
                  href="https://cloud.lightspeedapp.com/oauth"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1 mt-2"
                >
                  Open Lightspeed Developer Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-4">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  <strong>Note:</strong> After registering the redirect URI in Lightspeed, you need to set the following environment variables in your app settings:
                </p>
                <ul className="text-sm text-yellow-600 dark:text-yellow-400 mt-2 space-y-1 list-disc list-inside">
                  <li>LIGHTSPEED_CLIENT_ID</li>
                  <li>LIGHTSPEED_CLIENT_SECRET</li>
                  <li>LIGHTSPEED_REDIRECT_URI (should match the URL above)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* POS Pause Control */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">POS Integration Control</CardTitle>
              <CardDescription>
                Pause POS integration for testing without sending data to Lightspeed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">POS Integration Status</p>
                  <p className="text-sm text-muted-foreground">
                    {posPaused ? 'Paused - No data sent to Lightspeed' : 'Active - Syncing with Lightspeed'}
                  </p>
                </div>
                <Button
                  onClick={handleTogglePause}
                  variant={posPaused ? "default" : "outline"}
                  className={posPaused 
                    ? "bg-green-600 hover:bg-green-700 text-white" 
                    : "border-yellow-500 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                  }
                >
                  {posPaused ? 'Resume POS' : 'Pause POS'}
                </Button>
              </div>
              {posPaused && (
                <Alert className="bg-yellow-500/10 border-yellow-500 mt-4">
                  <AlertDescription className="text-yellow-600 dark:text-yellow-400">
                    <strong>Testing Mode:</strong> All POS operations will be simulated. No data will be sent to Lightspeed.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Connection Status */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Connection Status</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground mt-4">Loading...</p>
                </div>
              ) : tokenInfo ? (
                <div className="space-y-6">
                  <div className={`p-4 rounded-lg border-2 ${isExpired() ? 'bg-red-500/10 border-red-500' : 'bg-green-500/10 border-green-500'}`}>
                    <div className="flex items-center gap-3">
                      {isExpired() ? (
                        <AlertCircle className="w-6 h-6 text-red-500" />
                      ) : (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      )}
                      <div>
                        <p className={`font-medium ${isExpired() ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {isExpired() ? 'Connection Expired' : 'Connected to Lightspeed'}
                        </p>
                        <p className={`text-sm ${isExpired() ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {isExpired() ? 'Please reconnect' : `Token expires in ${expiresIn()}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Connected Since:</span>
                      <span className="font-medium">{new Date(tokenInfo.created_date).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Token Type:</span>
                      <span className="font-medium">{tokenInfo.token_type}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Scope:</span>
                      <span className="font-medium">{tokenInfo.scope || 'employee:all'}</span>
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
                      className="flex-1 border-red-500 text-red-500 hover:bg-red-500/10"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <LinkIcon className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">
                    Not Connected
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Make sure you've completed the setup instructions above, then click Connect.
                  </p>
                  <Button
                    onClick={handleConnect}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                    size="lg"
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