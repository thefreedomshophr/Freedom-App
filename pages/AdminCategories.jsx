import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminCategories() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const handleFetchCategories = async () => {
    setLoading(true);
    setResponse('');

    try {
      // Get Freedom location
      const locations = await base44.entities.Location.list();
      const freedomLocation = locations.find(loc => loc.name === 'Freedom');

      if (!freedomLocation) {
        setResponse('Error: Freedom location not found');
        setLoading(false);
        return;
      }

      const result = await base44.functions.invoke('lightspeedGetCategories', {
        locationId: freedomLocation.id
      });

      setResponse(JSON.stringify(result.data, null, 2));
    } catch (error) {
      setResponse(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-light mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-8">Admin access required.</p>
          <Button onClick={() => navigate(createPageUrl("Home"))}>
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
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
          <h1 className="text-4xl font-light mb-2">Manage Categories</h1>
          <p className="text-muted-foreground">Retrieve Lightspeed categories</p>
        </motion.div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Fetch Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleFetchCategories}
              disabled={loading}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Get All Categories
                </>
              )}
            </Button>

            {response && (
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Response:</label>
                <Textarea
                  value={response}
                  readOnly
                  className="bg-muted font-mono text-xs h-96"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}