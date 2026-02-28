import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, List, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDiscontinued() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [lastSync, setLastSync] = useState(null);
  const [fetchingShops, setFetchingShops] = useState(false);
  const [tagId, setTagId] = useState('discontinued');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const data = await base44.entities.DiscontinuedLog.list('-sync_date', 10000);
      setLogs(data);
      if (data.length > 0) {
        setLastSync(data[0].sync_date);
      }
      setCurrentPage(1);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!tagId) {
      alert('Please enter a tag ID');
      return;
    }
    setSyncing(true);
    setSyncStatus('Starting sync...');
    setSyncProgress({ current: 0, total: 0 });

    let startIndex = 0;
    let hasMore = true;
    let totalSaved = 0;

    try {
      while (hasMore) {
        const response = await base44.functions.invoke('syncDiscontinuedInventory', { 
          tagId,
          startIndex 
        });

        if (!response.data.success) {
          throw new Error(response.data.error || 'Sync failed');
        }

        hasMore = response.data.hasMore;
        startIndex = response.data.nextIndex;
        totalSaved += response.data.savedInBatch;

        setSyncStatus(`Processing: ${response.data.processedCount}/${response.data.totalItems} items checked, ${totalSaved} saved`);
        setSyncProgress({ 
          current: response.data.processedCount, 
          total: response.data.totalItems 
        });

        // Small delay between batches
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setSyncStatus(`✓ Sync complete! Saved ${totalSaved} discontinued items with 0 inventory.`);
      
      // Reload logs without blocking
      loadLogs().catch(err => console.error('Error reloading logs:', err));
    } catch (error) {
      console.error('Error syncing:', error);
      setSyncStatus(`✗ Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleGetTags = async () => {
    setFetchingShops(true);
    try {
      const locations = await base44.entities.Location.list();
      const sharkysLocation = locations.find(loc => loc.name === 'Sharkys');
      
      if (!sharkysLocation) {
        alert('Sharkys location not found');
        return;
      }

      const response = await base44.functions.invoke('lightspeedGetTags', {
        locationId: sharkysLocation.id
      });
      
      if (response.data.success) {
        const tags = response.data.tags;
        console.log('=== ALL TAGS ===');
        console.log(JSON.stringify(response.data.fullResponse, null, 2));
        tags.forEach(tag => {
          console.log(`Tag ID: ${tag.tagID}, Name: "${tag.name}"`);
        });
        console.log('=================');
        alert(`Found ${tags.length} tags - check console for full details:\n\n${tags.map(t => `${t.name}: ${t.tagID}`).join('\n')}`);
      } else {
        alert('Failed to fetch tags: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
      alert('Error fetching tags: ' + error.message);
    } finally {
      setFetchingShops(false);
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      alert('No data to export');
      return;
    }

    // Create CSV content
    const csvContent = [
      'System ID,Name',
      ...logs.map(log => `"${log.system_sku || ''}","${log.item_name || ''}"`)
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `discontinued_inventory_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate(createPageUrl("AdminDashboard"))}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-light">Discontinued Inventory</h1>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleExportCSV}
              disabled={logs.length === 0}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button
              onClick={handleGetTags}
              disabled={fetchingShops}
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <List className={`w-4 h-4 ${fetchingShops ? 'animate-spin' : ''}`} />
              {fetchingShops ? 'Fetching...' : 'Get All Tags'}
            </Button>
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        </div>

        <div className="space-y-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm">Tag Name:</label>
              <Input
                type="text"
                value={tagId}
                onChange={(e) => setTagId(e.target.value)}
                placeholder="Enter tag name"
                className="w-40"
              />
            </div>
            {lastSync && (
              <p className="text-muted-foreground text-sm">
                Last synced: {new Date(lastSync).toLocaleString()}
              </p>
            )}
          </div>

          {syncing && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Sync Progress</span>
                    {syncProgress.total > 0 && (
                      <span className="text-muted-foreground text-sm">
                        {syncProgress.current} / {syncProgress.total}
                      </span>
                    )}
                  </div>
                  {syncProgress.total > 0 && (
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-300"
                        style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                      />
                    </div>
                  )}
                  <p className="text-muted-foreground text-sm flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {syncStatus || 'Processing...'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Discontinued Items</CardTitle>
              {logs.length > 0 && (
                <div className="text-muted-foreground text-sm">
                  Total: <span className="font-semibold">{logs.length}</span> items
                  {logs.length > itemsPerPage && (
                    <span className="ml-2">
                      (Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, logs.length)})
                    </span>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No discontinued items found. Click "Sync Now" to fetch data.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium text-center">FR</th>
                        <th className="px-4 py-3 font-medium text-center">SH</th>
                        <th className="px-4 py-3 font-medium text-center">CB</th>
                        <th className="px-4 py-3 font-medium text-center">AD</th>
                        <th className="px-4 py-3 font-medium text-center">PS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((log, index) => (
                        <tr key={log.id} className={index % 2 === 0 ? 'bg-muted/30' : ''}>
                          <td className="px-4 py-3">{log.item_name}</td>
                          <td className="px-4 py-3 text-center">{log.fr_quantity || 0}</td>
                          <td className="px-4 py-3 text-center">{log.sh_quantity || 0}</td>
                          <td className="px-4 py-3 text-center">{log.cb_quantity || 0}</td>
                          <td className="px-4 py-3 text-center">{log.ad_quantity || 0}</td>
                          <td className="px-4 py-3 text-center">{log.ps_quantity || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {logs.length > itemsPerPage && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <span className="text-muted-foreground text-sm">
                      Page {currentPage} of {Math.ceil(logs.length / itemsPerPage)}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(logs.length / itemsPerPage), p + 1))}
                      disabled={currentPage >= Math.ceil(logs.length / itemsPerPage)}
                      className="gap-2"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}