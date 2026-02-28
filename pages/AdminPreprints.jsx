import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, Search, Trash2, Loader2, RefreshCw, Pencil, Download } from "lucide-react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminPreprints() {
  const navigate = useNavigate();
  const [preprints, setPreprints] = useState([]);
  const [filteredPreprints, setFilteredPreprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [user, setUser] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);
  const [editingPreprint, setEditingPreprint] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [placements, setPlacements] = useState([]);
  const [prints, setPrints] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showMissingPlacements, setShowMissingPlacements] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  useEffect(() => {
    checkPermissions();
    loadPlacements();
    loadPrints();
  }, []);

  const loadPlacements = async () => {
    try {
      const data = await base44.entities.Placement.list();
      setPlacements(data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    } catch (error) {
      console.error('Error loading placements:', error);
    }
  };

  const loadPrints = async () => {
    try {
      const data = await base44.entities.Print.list();
      setPrints(data);
    } catch (error) {
      console.error('Error loading prints:', error);
    }
  };

  useEffect(() => {
    let filtered = preprints;
    
    // Filter by archived status
    if (!showArchived) {
      filtered = filtered.filter(p => p.is_active !== false);
    }
    
    // Filter by missing placements
    if (showMissingPlacements) {
      filtered = filtered.filter(p => 
        (p.print1_system_id && !p.print1_placement) ||
        (p.print2_system_id && !p.print2_placement)
      );
    }
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.preprint_system_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.blank_system_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.print1_system_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.print2_system_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredPreprints(filtered);
    setCurrentPage(1); // Reset to page 1 when filters change
  }, [searchTerm, preprints, showArchived, showMissingPlacements]);

  const checkPermissions = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role === 'admin') {
        loadPreprints();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setLoading(false);
    }
  };

  const loadPreprints = async () => {
    try {
      const data = await base44.entities.Preprint.list();
      // Show all preprints in admin (including archived)
      setPreprints(data);
      setFilteredPreprints(data);
    } catch (error) {
      console.error('Error loading preprints:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseCsvFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            reject(new Error('CSV must have a header row and at least one data row'));
            return;
          }

          const rawHeaders = lines[0].split(',');
          const headers = rawHeaders.map(h => 
            h.trim().toLowerCase().replace(/['"]/g, '').replace(/\s+/g, '_').replace(/\r/g, '')
          );
          
          const data = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].replace(/\r/g, '');
            const values = [];
            let current = '';
            let inQuotes = false;

            for (let j = 0; j < line.length; j++) {
              const char = line[j];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                values.push(current.trim().replace(/^["']|["']$/g, ''));
                current = '';
              } else {
                current += char;
              }
            }
            values.push(current.trim().replace(/^["']|["']$/g, ''));

            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });

            if (row.preprint_system_id || row.blank_system_id) {
              data.push(row);
            }
          }

          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      setUploadStatus('Parsing CSV...');
      setUploadProgress(20);

      const preprintsData = await parseCsvFile(file);
      
      if (!Array.isArray(preprintsData) || preprintsData.length === 0) {
        alert('No preprint data found in CSV. Please check your file format.');
        setUploading(false);
        setUploadStatus('');
        setUploadProgress(0);
        return;
      }

      setUploadStatus(`Processing ${preprintsData.length} preprints...`);
      setUploadProgress(50);

      const existingPreprints = await base44.entities.Preprint.list();
      const existingMap = new Map(existingPreprints.map(p => [p.preprint_system_id, p]));

      const preprintsToCreate = [];
      const preprintsToUpdate = [];

      for (const preprintData of preprintsData) {
        if (!preprintData.preprint_system_id) {
          console.warn('Preprint missing preprint_system_id - skipping');
          continue;
        }

        const active = preprintData.active === '1' || preprintData.active === 1 || preprintData.active === true;

        const preprintPayload = {
          preprint_system_id: preprintData.preprint_system_id,
          blank_system_id: preprintData.blank_system_id || '',
          print1_system_id: preprintData.print1_system_id || '',
          print1_placement: preprintData.print1_placement || '',
          print2_system_id: preprintData.print2_system_id || '',
          print2_placement: preprintData.print2_placement || '',
          is_active: active
        };

        if (existingMap.has(preprintData.preprint_system_id)) {
          // Update existing
          const existing = existingMap.get(preprintData.preprint_system_id);
          preprintsToUpdate.push({ id: existing.id, data: preprintPayload });
        } else {
          // Create new
          preprintsToCreate.push(preprintPayload);
        }
      }

      // Process updates one at a time with delays
      for (let i = 0; i < preprintsToUpdate.length; i++) {
        const progress = 70 + ((i / preprintsToUpdate.length) * 15);
        setUploadStatus(`Updating preprint ${i + 1} of ${preprintsToUpdate.length}...`);
        setUploadProgress(progress);

        await base44.entities.Preprint.update(preprintsToUpdate[i].id, preprintsToUpdate[i].data);
        
        // Wait 500ms between each update
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Process creates one at a time with delays
      for (let i = 0; i < preprintsToCreate.length; i++) {
        const progress = 85 + ((i / preprintsToCreate.length) * 10);
        setUploadStatus(`Creating preprint ${i + 1} of ${preprintsToCreate.length}...`);
        setUploadProgress(progress);

        await base44.entities.Preprint.create(preprintsToCreate[i]);
        
        // Wait 500ms between each create
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setUploadStatus('Reloading preprints...');
      setUploadProgress(95);

      await loadPreprints();

      setUploadProgress(100);
      setUploadStatus('Complete!');

      setTimeout(() => {
        setUploading(false);
        setUploadStatus('');
        setUploadProgress(0);
      }, 2000);

      alert(`Successfully processed ${preprintsData.length} preprints:\n- Created: ${preprintsToCreate.length}\n- Updated: ${preprintsToUpdate.length}`);
    } catch (error) {
      console.error('Error uploading CSV:', error);
      alert(`Error processing CSV file: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
      setUploadStatus('');
      setUploadProgress(0);
      event.target.value = '';
    }
  };

  const handleEdit = (preprint) => {
    setEditingPreprint({ ...preprint });
    setShowEditDialog(true);
  };

  const handleSavePreprint = async () => {
    if (!editingPreprint) return;

    try {
      await base44.entities.Preprint.update(editingPreprint.id, {
        preprint_system_id: editingPreprint.preprint_system_id,
        blank_system_id: editingPreprint.blank_system_id,
        print1_system_id: editingPreprint.print1_system_id,
        print1_placement: editingPreprint.print1_placement || '',
        print2_system_id: editingPreprint.print2_system_id || '',
        print2_placement: editingPreprint.print2_placement || '',
        is_active: editingPreprint.is_active !== false
      });
      setShowEditDialog(false);
      setEditingPreprint(null);
      loadPreprints();
    } catch (error) {
      console.error('Error saving preprint:', error);
      alert('Error saving preprint');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this preprint?')) return;

    try {
      await base44.entities.Preprint.delete(id);
      loadPreprints();
    } catch (error) {
      console.error('Error deleting preprint:', error);
      alert('Error deleting preprint');
    }
  };

  const downloadTemplate = () => {
    const csvContent = "preprint_system_id,blank_system_id,print1_system_id,print1_placement,print2_system_id,print2_placement,active\n210000012345,210000067890,210000011111,Front Center,210000022222,Right Sleeve,1";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "preprints_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCsv = () => {
    // Create a map for quick print lookup
    const printMap = new Map(prints.map(p => [p.system_id, p.name]));

    // Create CSV content with headers
    let csvContent = "preprint_system_id,blank_system_id,print1_name,print1_system_id,print1_placement,print2_name,print2_system_id,print2_placement,active\n";
    
    // Add all preprints
    preprints.forEach(preprint => {
      const print1Name = printMap.get(preprint.print1_system_id) || '';
      const print2Name = printMap.get(preprint.print2_system_id) || '';
      
      const row = [
        preprint.preprint_system_id || '',
        preprint.blank_system_id || '',
        print1Name,
        preprint.print1_system_id || '',
        preprint.print1_placement || '',
        print2Name,
        preprint.print2_system_id || '',
        preprint.print2_placement || '',
        preprint.is_active === false ? '0' : '1'
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `preprints_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSync = async () => {
    if (!confirm('This will fetch all items with category ID 86 (PRE-PRINT) from Lightspeed. Continue?')) {
      return;
    }

    setSyncing(true);
    setSyncProgress(0);
    setSyncStatus('Starting sync...');

    try {
      // Get selected location from localStorage
      const storedLocation = localStorage.getItem('selectedLocation');
      if (!storedLocation) {
        alert('No location selected. Please select a location first.');
        setSyncing(false);
        return;
      }
      
      const selectedLocation = JSON.parse(storedLocation);
      console.log('📍 Using location:', selectedLocation);

      // Step 1: Fetch all items with category ID 86 from Lightspeed
      setSyncStatus('Fetching items with category ID 86...');
      setSyncProgress(5);
      
      const fetchResponse = await base44.functions.invoke('lightspeedGetItemsByCategoryId', {
        locationId: selectedLocation.id,
        categoryId: 86
      });

      console.log('📦 Full Lightspeed Response:', JSON.stringify(fetchResponse.data, null, 2));

      if (!fetchResponse.data.success) {
        throw new Error(fetchResponse.data.error || 'Failed to fetch items from Lightspeed');
      }

      const lightspeedItems = fetchResponse.data.items || [];
      console.log('📋 Preprint System IDs found:', lightspeedItems.map(item => item.systemSku).join(', '));
      
      setSyncStatus(`Found ${lightspeedItems.length} items with category ID 86`);
      setSyncProgress(15);

      // Step 2: Create/update Preprint records
      setSyncStatus('Creating preprint records...');
      const existingPreprints = await base44.entities.Preprint.list();
      const existingMap = new Map(existingPreprints.map(p => [p.preprint_system_id, p]));

      const newPreprints = lightspeedItems.filter(item => !existingMap.has(item.systemSku));
      
      if (newPreprints.length > 0) {
        const preprintsToCreate = newPreprints.map(item => ({
          preprint_system_id: item.systemSku,
          blank_system_id: '',
          print1_system_id: '',
          print2_system_id: ''
        }));
        
        await base44.entities.Preprint.bulkCreate(preprintsToCreate);
        setSyncStatus(`Created ${newPreprints.length} new preprint records`);
      }
      
      setSyncProgress(25);

      // Step 3: Load all garments and prints for matching
      setSyncStatus('Loading garments and prints...');
      const allGarments = await base44.entities.Garment.list();
      const allPrints = await base44.entities.Print.list();

      // Create lookup maps by itemID
      const garmentsByItemID = new Map(allGarments.map(g => [g.itemID, g]));
      const printsByItemID = new Map(allPrints.map(p => [p.itemID, p]));

      // Reload preprints after creating new ones
      const preprints = await base44.entities.Preprint.list();
      setSyncProgress(30);
      // Step 4: Process components for all preprints
      let updated = 0;
      let failed = 0;

      for (let i = 0; i < preprints.length; i++) {
        const preprint = preprints[i];
        const progress = 30 + ((i + 1) / preprints.length) * 65;
        setSyncProgress(progress);
        setSyncStatus(`Processing components ${i + 1}/${preprints.length}: ${preprint.preprint_system_id}`);

        try {
          // Search Lightspeed for this preprint
          const response = await base44.functions.invoke('lightspeedGetItemDetails', {
            barcode: preprint.preprint_system_id,
            locationId: selectedLocation.id
          });

          if (!response.data.success || !response.data.item) {
            console.warn(`Item not found: ${preprint.preprint_system_id}`);
            failed++;
            continue;
          }

          const item = response.data.item;

          // Check if it's an assembly
          if (item.itemType !== 'assembly' || !item.ItemComponents) {
            console.warn(`Item is not an assembly: ${preprint.preprint_system_id}`);
            failed++;
            continue;
          }

          // Parse components
          const components = Array.isArray(item.ItemComponents.ItemComponent)
            ? item.ItemComponents.ItemComponent
            : [item.ItemComponents.ItemComponent];

          let blankSystemId = '';
          const printSystemIds = [];

          // Match each component
          for (const component of components) {
            const componentItemID = component.componentItemID;

            // Check if it's a garment
            if (garmentsByItemID.has(componentItemID)) {
              const garment = garmentsByItemID.get(componentItemID);
              blankSystemId = garment.system_id;
              continue;
            }

            // Check if it's a print
            if (printsByItemID.has(componentItemID)) {
              const print = printsByItemID.get(componentItemID);
              printSystemIds.push(print.system_id);
            }
          }

          // Update the preprint record
          const updateData = {
            blank_system_id: blankSystemId || '',
            print1_system_id: printSystemIds[0] || '',
            print2_system_id: printSystemIds[1] || ''
          };

          await base44.entities.Preprint.update(preprint.id, updateData);
          updated++;

          // Delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`Error processing ${preprint.preprint_system_id}:`, error);
          failed++;
        }
      }

      setSyncStatus('Complete!');
      setSyncProgress(100);

      setTimeout(() => {
        setSyncing(false);
        setSyncStatus('');
        setSyncProgress(0);
      }, 2000);

      await loadPreprints();
      alert(`Sync started!\nProcessing ${preprints.length} preprints in batches of 5.\nThis will continue in the background.`);

    } catch (error) {
      console.error('Error syncing preprints:', error);
      alert(`Error syncing preprints: ${error.message}`);
      setSyncing(false);
      setSyncStatus('');
      setSyncProgress(0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-12 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-light mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-8">You don't have permission to manage preprints.</p>
          <Button onClick={() => navigate(createPageUrl("Home"))}>
            Return Home
          </Button>
        </div>
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
          <h1 className="text-4xl font-light mb-2">Manage Preprints</h1>
          <p className="text-muted-foreground">Manage preprinted garment configurations</p>
        </motion.div>

        {uploading && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="border-2 border-blue-500">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{uploadStatus}</p>
                    <p className="text-xs text-muted-foreground mt-1">{Math.round(uploadProgress)}% complete</p>
                  </div>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {syncing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="border-2 border-green-500">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <RefreshCw className="w-5 h-5 animate-spin text-green-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{syncStatus}</p>
                    <p className="text-xs text-muted-foreground mt-1">{Math.round(syncProgress)}% complete</p>
                  </div>
                </div>
                <Progress value={syncProgress} className="h-2" />
              </CardContent>
            </Card>
          </motion.div>
        )}

        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Upload Preprints (CSV)</CardTitle>
              <div className="flex gap-2">
                <Button onClick={handleExportCsv} variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
                <Button onClick={handleSync} disabled={uploading || syncing} className="gap-2 bg-green-600 hover:bg-green-700">
                  <RefreshCw className="w-4 h-4" />
                  Sync Components
                </Button>
                <Button onClick={downloadTemplate} variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" />
                  Download Template
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Upload a CSV with columns: preprint_system_id, blank_system_id, print1_system_id, print1_placement, print2_system_id, print2_placement, active (1=active, 0=archived)
            </p>
            <Input
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              disabled={uploading}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle>All Preprints ({filteredPreprints.length} total, showing {Math.min(itemsPerPage, filteredPreprints.length - (currentPage - 1) * itemsPerPage)})</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={showMissingPlacements ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowMissingPlacements(!showMissingPlacements)}
                >
                  Missing Placements
                </Button>
                <Button
                  variant={showArchived ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowArchived(!showArchived)}
                >
                  {showArchived ? "Hide Archived" : "Show Archived"}
                </Button>
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search preprints..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredPreprints.length > itemsPerPage && (
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPreprints.length)} of {filteredPreprints.length} preprints
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-2 px-3">
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {Math.ceil(filteredPreprints.length / itemsPerPage)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredPreprints.length / itemsPerPage), p + 1))}
                    disabled={currentPage === Math.ceil(filteredPreprints.length / itemsPerPage)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Preprint System ID</th>
                    <th className="text-left py-3 px-4">Blank System ID</th>
                    <th className="text-left py-3 px-4">Print 1</th>
                    <th className="text-left py-3 px-4">Print 2</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPreprints.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((preprint) => {
                    const print1 = prints.find(p => p.system_id === preprint.print1_system_id);
                    const print2 = prints.find(p => p.system_id === preprint.print2_system_id);
                    
                    return (
                      <tr key={preprint.id} className={`border-b hover:bg-muted/50 ${preprint.is_active === false ? 'opacity-50' : ''}`}>
                        <td className="py-3 px-4 font-mono text-sm">{preprint.preprint_system_id}</td>
                        <td className="py-3 px-4 text-muted-foreground font-mono text-sm">{preprint.blank_system_id || '-'}</td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {print1 && <div className="text-sm font-medium">{print1.name}</div>}
                            <div className="text-muted-foreground font-mono text-xs">{preprint.print1_system_id || '-'}</div>
                            {preprint.print1_placement && (
                              <div className="text-xs text-blue-600">📍 {preprint.print1_placement}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {print2 && <div className="text-sm font-medium">{print2.name}</div>}
                            <div className="text-muted-foreground font-mono text-xs">{preprint.print2_system_id || '-'}</div>
                            {preprint.print2_placement && (
                              <div className="text-xs text-blue-600">📍 {preprint.print2_placement}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {preprint.is_active === false ? (
                            <span className="text-xs text-red-500 font-medium">Archived</span>
                          ) : (
                            <span className="text-xs text-green-600 font-medium">Active</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(preprint)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(preprint.id)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredPreprints.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPreprints.length)} of {filteredPreprints.length} preprints
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-2 px-3">
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {Math.ceil(filteredPreprints.length / itemsPerPage)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredPreprints.length / itemsPerPage), p + 1))}
                    disabled={currentPage === Math.ceil(filteredPreprints.length / itemsPerPage)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Preprint</DialogTitle>
            </DialogHeader>
            {editingPreprint && (
              <div className="space-y-4">
                <div>
                  <Label>Preprint System ID</Label>
                  <Input
                    value={editingPreprint.preprint_system_id || ''}
                    onChange={(e) => setEditingPreprint({ ...editingPreprint, preprint_system_id: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Blank System ID</Label>
                  <Input
                    value={editingPreprint.blank_system_id || ''}
                    onChange={(e) => setEditingPreprint({ ...editingPreprint, blank_system_id: e.target.value })}
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3">Print 1</h3>
                  <div className="space-y-3">
                    <div>
                      <Label>System ID</Label>
                      <Input
                        value={editingPreprint.print1_system_id || ''}
                        onChange={(e) => setEditingPreprint({ ...editingPreprint, print1_system_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Placement</Label>
                      <Select
                        value={editingPreprint.print1_placement || ''}
                        onValueChange={(value) => setEditingPreprint({ ...editingPreprint, print1_placement: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select placement" />
                        </SelectTrigger>
                        <SelectContent>
                          {placements.map((placement) => (
                            <SelectItem key={placement.name} value={placement.name}>
                              {placement.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        This will be auto-assigned when scanning the preprint into a sale
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3">Print 2 (Optional)</h3>
                  <div className="space-y-3">
                    <div>
                      <Label>System ID</Label>
                      <Input
                        value={editingPreprint.print2_system_id || ''}
                        onChange={(e) => setEditingPreprint({ ...editingPreprint, print2_system_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Placement</Label>
                      <Select
                        value={editingPreprint.print2_placement || ''}
                        onValueChange={(value) => setEditingPreprint({ ...editingPreprint, print2_placement: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select placement" />
                        </SelectTrigger>
                        <SelectContent>
                          {placements.map((placement) => (
                            <SelectItem key={placement.name} value={placement.name}>
                              {placement.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        This will be auto-assigned when scanning the preprint into a sale
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3">Status</h3>
                  <Select
                    value={editingPreprint.is_active === false ? 'archived' : 'active'}
                    onValueChange={(value) => setEditingPreprint({ ...editingPreprint, is_active: value === 'active' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditDialog(false);
                      setEditingPreprint(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSavePreprint}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}