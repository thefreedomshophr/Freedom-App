import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

export default function AdminItemIDs() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [freedomLocation, setFreedomLocation] = useState(null);
  const [fetchedItems, setFetchedItems] = useState([]);
  const [startingSystemId, setStartingSystemId] = useState('');
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    checkPermissions();
    loadFreedomLocation();
  }, []);

  const checkPermissions = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser.role !== 'admin') {
        navigate(createPageUrl("AdminDashboard"));
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      navigate(createPageUrl("Home"));
    } finally {
      setLoading(false);
    }
  };

  const loadFreedomLocation = async () => {
    try {
      const locations = await base44.entities.Location.list();
      const freedom = locations.find(loc => loc.name === 'Freedom');
      setFreedomLocation(freedom);
    } catch (error) {
      console.error('Error loading Freedom location:', error);
    }
  };

  const handleGetItemIds = async () => {
    if (!freedomLocation) {
      alert('Freedom location not found. Please configure it first.');
      return;
    }

    setFetching(true);
    setFetchedItems([]);
    
    try {
      const response = await base44.functions.invoke('lightspeedExportItems', {
        locationId: freedomLocation.id
      });
      
      if (!response.data.success) {
        alert(response.data.error || 'Failed to fetch items');
        return;
      }

      let items = response.data.items.filter(item => item.systemSku);
      
      // Filter items by starting system ID if provided
      if (startingSystemId.trim()) {
        items = items.filter(item => item.systemSku > startingSystemId.trim());
      }

      setFetchedItems(items);
      alert(`Fetched ${items.length} items`);
    } catch (error) {
      console.error('Error fetching items:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setFetching(false);
    }
  };

  const handleDownloadCsv = () => {
    if (fetchedItems.length === 0) {
      alert('No items to download. Click "Get Item IDs" first.');
      return;
    }

    // Generate CSV
    const csvContent = "systemSku,itemID\n" + 
      fetchedItems.map(item => `${item.systemSku},${item.itemID}`).join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lightspeed_items_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
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
          <h1 className="text-4xl font-light mb-2">Manage itemIDs</h1>
          <p className="text-muted-foreground">Download Lightspeed itemID data</p>
        </motion.div>

        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Download Item IDs from Lightspeed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Fetch itemIDs and systemSkus from Lightspeed, optionally starting after a specific system ID.
            </p>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Starting System ID (optional - leave blank for all items)
              </label>
              <Input
                type="text"
                placeholder="e.g., A123"
                value={startingSystemId}
                onChange={(e) => setStartingSystemId(e.target.value)}
                className="mb-4"
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleGetItemIds}
                disabled={fetching}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {fetching ? 'Fetching...' : 'Get Item IDs'}
              </Button>
              <Button
                onClick={handleDownloadCsv}
                disabled={fetchedItems.length === 0}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4" />
                Download CSV ({fetchedItems.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}