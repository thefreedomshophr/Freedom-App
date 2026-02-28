import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Upload, Edit, Search, Package, Loader2, Download } from "lucide-react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import CsvTemplateDownload from "../components/CsvTemplateDownload";

export default function AdminPrints() {
  const navigate = useNavigate();
  const [prints, setPrints] = useState([]);
  const [filteredPrints, setFilteredPrints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrint, setSelectedPrint] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [user, setUser] = useState(null);
  const [pendingPrintData, setPendingPrintData] = useState([]); // New state for holding prints from CSV that need image matches
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    let filtered = prints;
    
    // Filter by archived status
    if (!showArchived) {
      filtered = filtered.filter(p => p.is_active !== false);
    }
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.system_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.categories?.some(category => category.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    setFilteredPrints(filtered);
  }, [searchTerm, prints, showArchived]);

  const checkPermissions = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role === 'admin' || currentUser.manage_prints) {
        loadPrints();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setLoading(false);
    }
  };

  const loadPrints = async () => {
    try {
      const data = await base44.entities.Print.list();
      setPrints(data);
      setFilteredPrints(data);
    } catch (error) {
      console.error('Error loading prints:', error);
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

          // Parse header row - simple split since headers shouldn't have commas
          const rawHeaders = lines[0].split(',');
          
          // Normalize headers to snake_case
          const headers = rawHeaders.map(h => 
            h.trim().toLowerCase().replace(/['"]/g, '').replace(/\s+/g, '_').replace(/\r/g, '')
          );
          
          console.log('CSV Headers:', headers);
          console.log('Raw header line:', lines[0]);
          
          // Parse data rows - handle quoted values with commas
          const data = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].replace(/\r/g, ''); // Remove carriage returns
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

            // Log first row to debug header/value alignment
            if (i === 1) {
              console.log('=== CSV PARSING DEBUG ===');
              console.log('Raw line:', line);
              console.log('Headers:', headers);
              console.log('Values:', values);
              console.log('Header count:', headers.length, 'Value count:', values.length);
              for (let k = 0; k < Math.max(headers.length, values.length); k++) {
                console.log(`  [${k}] header="${headers[k] || 'MISSING'}" => value="${values[k] || 'MISSING'}"`);
              }
            }

            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });

            if (row.system_id || row.name) {
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

      // Parse CSV directly - no AI extraction
      const printsData = await parseCsvFile(file);
      
      console.log('Parsed CSV data:', printsData);

      if (!Array.isArray(printsData) || printsData.length === 0) {
        alert('No print data found in CSV. Please check your file format.');
        setUploading(false);
        setUploadStatus('');
        setUploadProgress(0);
        return;
      }
        
        console.log('Processing prints:', printsData);

      setUploadStatus(`Processing ${printsData.length} prints...`);
      setUploadProgress(50);

        // Get all existing prints
        const existingPrints = await base44.entities.Print.list();
        const existingPrintsMap = new Map(existingPrints.map(p => [p.system_id, p]));

        const printsToCreate = [];
        const printsToUpdate = [];

        for (const printData of printsData) {
          // Ensure system_id exists for all prints
          if (!printData.system_id) {
            console.warn(`Print "${printData.name || 'Unnamed Print'}" is missing system_id - skipping`);
            continue;
          }

          if (existingPrintsMap.has(printData.system_id)) {
            const existingPrint = existingPrintsMap.get(printData.system_id);
            printsToUpdate.push({ id: existingPrint.id, printDataFromCsv: printData, existingPrint });
          } else {
            printsToCreate.push(printData);
          }
        }

        setUploadStatus(`Updating ${printsToUpdate.length} existing prints...`);
        setUploadProgress(70);

        // Update existing prints in batches of 10 to avoid rate limits
        const batchSize = 10;
        for (let batchStart = 0; batchStart < printsToUpdate.length; batchStart += batchSize) {
          const batch = printsToUpdate.slice(batchStart, batchStart + batchSize);
          const batchEnd = Math.min(batchStart + batchSize, printsToUpdate.length);
          
          setUploadStatus(`Updating prints ${batchStart + 1}-${batchEnd} of ${printsToUpdate.length}...`);
          
          for (let i = 0; i < batch.length; i++) {
            const { id, printDataFromCsv: print, existingPrint } = batch[i];
            const globalIndex = batchStart + i;
            
            // Log every field for first print
            if (globalIndex === 0) {
              console.log('=== FIRST PRINT DEBUG ===');
              console.log('All CSV fields:', Object.keys(print));
              console.log('Full print object:', JSON.stringify(print, null, 2));
              console.log('print.tops_placements =', print.tops_placements);
              console.log('print.bottoms_placements =', print.bottoms_placements);
              console.log('print.image =', print.image);
            }
            
            // Parse categories - they use | as separator in CSV
            let categoriesArray = [];
            if (print.categories && typeof print.categories === 'string') {
              // Check if categories use pipe separator or comma
              if (print.categories.includes('|')) {
                categoriesArray = print.categories.split('|').map(t => t.trim()).filter(t => t);
              } else {
                categoriesArray = print.categories.split(',').map(t => t.trim()).filter(t => t);
              }
            }
            
            // Parse placements - they use | or , as separator
            // CSV column header "Tops Placements" normalizes to "tops_placements" -> maps to front_placements field
            let frontPlacements = [];
            const topPlacementsValue = print.tops_placements || print.top_placements || '';
            if (globalIndex === 0) console.log(`Print ${print.name} - tops_placements raw:`, topPlacementsValue);
            if (topPlacementsValue && typeof topPlacementsValue === 'string') {
              if (topPlacementsValue.includes('|')) {
                frontPlacements = topPlacementsValue.split('|').map(t => t.trim()).filter(t => t);
              } else {
                frontPlacements = topPlacementsValue.split(',').map(t => t.trim()).filter(t => t);
              }
            }

            // CSV column header "Bottoms Placements" normalizes to "bottoms_placements" -> maps to bottom_placements field
            let bottomPlacements = [];
            const bottomPlacementsValue = print.bottoms_placements || print.bottom_placements || '';
            if (globalIndex === 0) console.log(`Print ${print.name} - bottoms_placements raw:`, bottomPlacementsValue);
            if (bottomPlacementsValue && typeof bottomPlacementsValue === 'string') {
              if (bottomPlacementsValue.includes('|')) {
                bottomPlacements = bottomPlacementsValue.split('|').map(t => t.trim()).filter(t => t);
              } else {
                bottomPlacements = bottomPlacementsValue.split(',').map(t => t.trim()).filter(t => t);
              }
            }
            
            // Get image value - check multiple possible column names
            const imageValue = print.image || print.image_filename || '';

            const updateData = {
              name: print.name || existingPrint.name,
              cost: parseFloat(print.cost) || 0,
              system_id: print.system_id,
              itemID: print.itemid || print.itemID || '',
              primary_matches: print.primary_matches || '',
              secondary_matches: print.secondary_matches || '',
              is_active: print.active === '1' || print.active === 1 || print.active === 'true',
              image_url: existingPrint.image_url || '',
              description: print.description || print.desciption || '',
              availability: print.availability || '',
              width: parseFloat(print.width) || null,
              height: parseFloat(print.height) || null,
              print_size: print.print_size || '',
              garment_type: print.garment_type || 'tops',
              categories: categoriesArray,
              front_placements: frontPlacements,
              bottom_placements: bottomPlacements,
              image_filename: imageValue || existingPrint.image_filename || ''
            };
            
            if (globalIndex === 0) {
              console.log('=== UPDATE DATA FOR FIRST PRINT ===');
              console.log('Raw CSV print.description:', print.description);
              console.log('Raw CSV print object keys:', Object.keys(print));
              console.log('updateData:', JSON.stringify(updateData, null, 2));
            }

            try {
              await base44.entities.Print.update(id, updateData);
            } catch (error) {
              // Handle rate limit with retry
              if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
                setUploadStatus(`Rate limited - waiting before retrying ${print.name}...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                try {
                  await base44.entities.Print.update(id, updateData);
                } catch (retryError) {
                  console.error(`Failed to update print ${print.name} after retry:`, retryError);
                }
              } else {
                console.error(`Failed to update print ${print.name}:`, error);
              }
            }
            
            // Small delay between items in batch
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          // Longer delay between batches to avoid rate limits
          if (batchEnd < printsToUpdate.length) {
            setUploadStatus(`Completed batch ${Math.ceil(batchEnd / batchSize)} of ${Math.ceil(printsToUpdate.length / batchSize)}, waiting 5 seconds before next batch...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }

        setUploadStatus(`Creating ${printsToCreate.length} new prints...`);
        setUploadProgress(85);

        // Create new prints in smaller batches to avoid rate limits
        if (printsToCreate.length > 0) {
          const batchSize = 10;
          
          for (let i = 0; i < printsToCreate.length; i += batchSize) {
            const batch = printsToCreate.slice(i, i + batchSize);
            
            const newPrintsPayload = batch.map((print) => {
              // Parse categories
              let categoriesArray = [];
              if (print.categories && typeof print.categories === 'string') {
                if (print.categories.includes('|')) {
                  categoriesArray = print.categories.split('|').map(t => t.trim()).filter(t => t);
                } else {
                  categoriesArray = print.categories.split(',').map(t => t.trim()).filter(t => t);
                }
              }

              // Parse placements - CSV header "Tops Placements" normalizes to "tops_placements"
              let frontPlacements = [];
              const topPlacementsValue = print.tops_placements || print.top_placements || '';
              if (topPlacementsValue && typeof topPlacementsValue === 'string') {
                if (topPlacementsValue.includes('|')) {
                  frontPlacements = topPlacementsValue.split('|').map(t => t.trim()).filter(t => t);
                } else {
                  frontPlacements = topPlacementsValue.split(',').map(t => t.trim()).filter(t => t);
                }
              }

              // CSV header "Bottoms Placements" normalizes to "bottoms_placements"
              let bottomPlacements = [];
              const bottomPlacementsValue = print.bottoms_placements || print.bottom_placements || '';
              if (bottomPlacementsValue && typeof bottomPlacementsValue === 'string') {
                if (bottomPlacementsValue.includes('|')) {
                  bottomPlacements = bottomPlacementsValue.split('|').map(t => t.trim()).filter(t => t);
                } else {
                  bottomPlacements = bottomPlacementsValue.split(',').map(t => t.trim()).filter(t => t);
                }
              }
              
              return {
                name: print.name,
                description: print.description || '',
                cost: parseFloat(print.cost) || 0,
                system_id: print.system_id,
                itemID: print.itemid || '',
                primary_matches: print.primary_matches || '',
                secondary_matches: print.secondary_matches || '',
                categories: categoriesArray,
                availability: print.availability || '',
                width: parseFloat(print.width) || null,
                height: parseFloat(print.height) || null,
                print_size: print.print_size || '',
                garment_type: print.garment_type || 'tops',
                is_active: print.active === '1' || print.active === 1 || print.active === 'true',
                image_url: 'https://via.placeholder.com/300x300?text=No+Image',
                front_placements: frontPlacements,
                bottom_placements: bottomPlacements,
                image_filename: print.image || ''
              };
            });

            try {
              await base44.entities.Print.bulkCreate(newPrintsPayload);
            } catch (error) {
              // Handle rate limit with retry
              if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
                setUploadStatus(`Rate limited - waiting before retrying batch...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                try {
                  await base44.entities.Print.bulkCreate(newPrintsPayload);
                } catch (retryError) {
                  console.error(`Failed to create batch after retry:`, retryError);
                }
              } else {
                console.error(`Failed to create batch starting at index ${i}:`, error);
              }
            }
            
            // Add delay between batches
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }

        // Store print data with image filenames for later matching
        const printsWithImages = printsData.filter(p => p.image);
        setPendingPrintData(printsWithImages);
        localStorage.setItem('pendingPrintImageMatches', JSON.stringify(printsWithImages));

        setUploadStatus('Reloading prints...');
        setUploadProgress(95);

        await loadPrints();

        setUploadProgress(100);
      setUploadStatus('Complete!');

      setTimeout(() => {
        setUploading(false);
        setUploadStatus('');
        setUploadProgress(0);
      }, 2000);

      const imageMatchMessage = printsWithImages.length > 0 
        ? `\n\n${printsWithImages.length} prints are waiting for images. Upload images with matching filenames to link them.`
        : '';

      alert(`Successfully processed ${printsToUpdate.length} updated prints and ${printsToCreate.length} new prints${imageMatchMessage}`);
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

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      let matched = 0;
      let unmatched = 0;

      // Load pending print data from localStorage
      const storedPending = localStorage.getItem('pendingPrintImageMatches');
      const pendingData = storedPending ? JSON.parse(storedPending) : [];

      setUploadStatus(`Processing ${files.length} images in batches...`);

      // Get all existing prints to match against
      const allPrints = await base44.entities.Print.list();

      // Process in batches of 10
      const batchSize = 10;
      for (let batchStart = 0; batchStart < files.length; batchStart += batchSize) {
        const batch = files.slice(batchStart, batchStart + batchSize);
        const batchEnd = Math.min(batchStart + batchSize, files.length);
        
        setUploadStatus(`Processing images ${batchStart + 1}-${batchEnd} of ${files.length}...`);

        for (let i = 0; i < batch.length; i++) {
          const file = batch[i];
          const globalIndex = batchStart + i;
          const fileName = file.name.toLowerCase();

          setUploadProgress((globalIndex / files.length) * 90);

          // Find prints that need this image
          const printsNeedingThisImage = allPrints.filter(p =>
            p.image_filename?.toLowerCase() === fileName ||
            pendingData.some(pd => pd.system_id === p.system_id && pd.image?.toLowerCase() === fileName)
          );

          if (printsNeedingThisImage.length > 0) {
            // Upload image once
            let retries = 3;
            let uploaded = false;
            let file_url_uploaded = '';
            
            while (retries > 0 && !uploaded) {
              try {
                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                file_url_uploaded = file_url;
                uploaded = true;
              } catch (error) {
                retries--;
                if (error.message?.includes('rate limit') || error.response?.status === 429) {
                  console.log(`Rate limited, waiting 2 seconds before retry... (${retries} retries left)`);
                  setUploadStatus(`Rate limited, waiting before retry... (${globalIndex + 1}/${files.length})`);
                  await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                  throw error;
                }
              }
            }
            
            if (!uploaded) {
              throw new Error(`Failed to upload ${file.name} after multiple retries`);
            }

            // Update all matching prints with the uploaded image URL
            for (const printToUpdate of printsNeedingThisImage) {
              await base44.entities.Print.update(printToUpdate.id, {
                image_url: file_url_uploaded
              });
              matched++;
            }
          } else {
            unmatched++;
          }

          // Small delay between items in batch
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Longer delay between batches
        if (batchEnd < files.length) {
          setUploadStatus(`Completed batch ${Math.ceil(batchEnd / batchSize)} of ${Math.ceil(files.length / batchSize)}, waiting 5 seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      setUploadStatus('Reloading prints...');
      setUploadProgress(95);

      await loadPrints();

      setUploadProgress(100);
      setUploadStatus('Complete!');

      setTimeout(() => {
        setUploading(false);
        setUploadStatus('');
        setUploadProgress(0);
      }, 2000);

      alert(`Matched ${matched} images to prints. ${unmatched > 0 ? `${unmatched} files did not match any print image filenames from the CSV.` : ''}`);
    } catch (error) {
      console.error('Error uploading images:', error);
      alert(`Error uploading images: ${error.message}`);
      setUploading(false);
      setUploadStatus('');
      setUploadProgress(0);
    } finally {
      event.target.value = '';
    }
  };

  const handleEditPrint = (print) => {
    setSelectedPrint({ ...print });
    setShowEditDialog(true);
  };

  const handleSavePrint = async () => {
    if (!selectedPrint) return;

    try {
      // Ensure placements are arrays if they were edited as strings
      const payload = {
        ...selectedPrint,
        front_placements: typeof selectedPrint.front_placements === 'string'
          ? selectedPrint.front_placements.split(',').map(t => t.trim()).filter(t => t)
          : selectedPrint.front_placements,
        bottom_placements: typeof selectedPrint.bottom_placements === 'string'
          ? selectedPrint.bottom_placements.split(',').map(t => t.trim()).filter(t => t)
          : selectedPrint.bottom_placements,
      };

      await base44.entities.Print.update(selectedPrint.id, payload);
      setShowEditDialog(false);
      setSelectedPrint(null);
      loadPrints();
    } catch (error) {
      console.error('Error saving print:', error);
      alert('Error saving print');
    }
  };

  const handleTagsChange = (categoriesString) => {
    const categories = categoriesString.split(',').map(t => t.trim()).filter(t => t);
    setSelectedPrint({ ...selectedPrint, categories });
  };

  const handlePlacementsChange = (field, placementsString) => {
    const placements = placementsString.split(',').map(p => p.trim()).filter(p => p);
    setSelectedPrint({ ...selectedPrint, [field]: placements });
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-12 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && !user.manage_prints)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-light mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-8">You don't have permission to manage prints.</p>
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
          <div>
            <h1 className="text-4xl font-light mb-2">Print Management</h1>
            <p className="text-muted-foreground">Manage your print designs and inventory</p>
          </div>
        </motion.div>

        {/* Upload Status Bar */}
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

        <Card className="shadow-lg mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Upload Print Data (CSV)</CardTitle>
              <CsvTemplateDownload type="prints" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Updates existing prints by System ID or adds new ones. Include an "active" column (1=active, 0=inactive).
              Optionally include an "image" column with filenames for later matching.
            </p>
            <Input
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              disabled={uploading}
            />
          </CardContent>
        </Card>

        <div className="sticky top-20 z-10 mb-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Upload Print Images</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Upload images here. They will be matched to prints that have an "image" filename specified in a previously uploaded CSV.
              </p>
              <div className="space-y-3">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle>All Prints ({filteredPrints.length})</CardTitle>
              <div className="flex items-center gap-4">
                <Button
                  variant={showArchived ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowArchived(!showArchived)}
                >
                  {showArchived ? "Showing Archived" : "Show Archived"}
                </Button>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search prints..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Image</th>
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">System ID</th>
                    <th className="text-left py-3 px-4">Item ID</th>
                    <th className="text-left py-3 px-4">Cost</th>
                    <th className="text-left py-3 px-4">Size</th>
                    <th className="text-left py-3 px-4">Categories</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrints.map((print) => (
                    <tr key={print.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        {print.image_url ? (
                          <img
                            src={print.image_url}
                            alt={print.name}
                            className="w-12 h-12 object-contain rounded bg-gray-400"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-400 rounded flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-700" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">{print.name}</td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-sm">{print.system_id || '-'}</td>
                      <td className="py-3 px-4">
                        {print.itemID ? (
                          <code className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-2 py-1 rounded">
                            {print.itemID}
                          </code>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">${print.cost?.toFixed(2)}</td>
                      <td className="py-3 px-4 text-sm">
                        {print.print_size || '-'}
                        {print.width && print.height && (
                          <div className="text-xs text-muted-foreground">
                            {print.width}" × {print.height}"
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {print.categories?.slice(0, 2).map((category, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {category}
                            </Badge>
                          ))}
                          {print.categories?.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{print.categories.length - 2}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={print.is_active ? "default" : "secondary"}
                          className={print.is_active ? "bg-green-600 text-white" : ""}
                        >
                          {print.is_active ? "Active" : "Archived"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPrint(print)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Print</DialogTitle>
            </DialogHeader>
            {selectedPrint && (
              <div className="space-y-4">
                {selectedPrint.image_url && (
                  <div className="flex justify-center">
                    <img
                      src={selectedPrint.image_url}
                      alt={selectedPrint.name}
                      className="w-48 h-48 object-contain rounded bg-gray-400 p-4"
                    />
                  </div>
                )}

                <div>
                  <Label>Name</Label>
                  <Input
                    value={selectedPrint.name || ''}
                    onChange={(e) => setSelectedPrint({ ...selectedPrint, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label>System ID</Label>
                  <Input
                    value={selectedPrint.system_id || ''}
                    onChange={(e) => setSelectedPrint({ ...selectedPrint, system_id: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Item ID (Lightspeed)</Label>
                  <Input
                    value={selectedPrint.itemID || ''}
                    onChange={(e) => setSelectedPrint({ ...selectedPrint, itemID: e.target.value })}
                    placeholder="Synced from Lightspeed"
                  />
                </div>

                <div>
                  <Label>Primary Matches (comma-separated system_ids)</Label>
                  <Input
                    value={selectedPrint.primary_matches || ''}
                    onChange={(e) => setSelectedPrint({ ...selectedPrint, primary_matches: e.target.value })}
                    placeholder="e.g., 12345, 12346"
                  />
                </div>

                <div>
                  <Label>Secondary Matches (comma-separated system_ids)</Label>
                  <Input
                    value={selectedPrint.secondary_matches || ''}
                    onChange={(e) => setSelectedPrint({ ...selectedPrint, secondary_matches: e.target.value })}
                    placeholder="e.g., 12347, 12348"
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={selectedPrint.description || ''}
                    onChange={(e) => setSelectedPrint({ ...selectedPrint, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Cost ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={selectedPrint.cost || ''}
                      onChange={(e) => setSelectedPrint({ ...selectedPrint, cost: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <Label>Status</Label>
                    <Select
                      value={selectedPrint.is_active ? "active" : "archived"}
                      onValueChange={(value) => setSelectedPrint({ ...selectedPrint, is_active: value === "active" })}
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Width (inches)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={selectedPrint.width || ''}
                      onChange={(e) => setSelectedPrint({ ...selectedPrint, width: parseFloat(e.target.value) || null })}
                    />
                  </div>

                  <div>
                    <Label>Height (inches)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={selectedPrint.height || ''}
                      onChange={(e) => setSelectedPrint({ ...selectedPrint, height: parseFloat(e.target.value) || null })}
                    />
                  </div>
                </div>

                <div>
                  <Label>Print Size</Label>
                  <Input
                    value={selectedPrint.print_size || ''}
                    onChange={(e) => setSelectedPrint({ ...selectedPrint, print_size: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Garment Type</Label>
                  <Select
                    value={selectedPrint.garment_type || 'tops'}
                    onValueChange={(value) => setSelectedPrint({ ...selectedPrint, garment_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tops">Tops</SelectItem>
                      <SelectItem value="bottoms">Bottoms</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Categories (comma-separated)</Label>
                  <Input
                    value={selectedPrint.categories?.join(', ') || ''}
                    onChange={(e) => handleTagsChange(e.target.value)}
                    placeholder="e.g., Multi Color, Sports, Kids"
                  />
                </div>

                <div>
                  <Label>Top Placements (comma-separated)</Label>
                  <Input
                    value={selectedPrint.front_placements?.join(', ') || ''}
                    onChange={(e) => handlePlacementsChange('front_placements', e.target.value)}
                    placeholder="e.g., Full Front, Left Chest"
                  />
                </div>

                <div>
                  <Label>Bottom Placements (comma-separated)</Label>
                  <Input
                    value={selectedPrint.bottom_placements?.join(', ') || ''}
                    onChange={(e) => handlePlacementsChange('bottom_placements', e.target.value)}
                    placeholder="e.g., Left Thigh, Back Waist"
                  />
                </div>

                <div>
                  <Label>Availability (e.g., FR, SH, CB)</Label>
                  <Input
                    value={selectedPrint.availability || ''}
                    onChange={(e) => setSelectedPrint({ ...selectedPrint, availability: e.target.value })}
                    placeholder="FR, SH, CB"
                  />
                </div>

                <div>
                  <Label>Image Filename (for matching uploaded images)</Label>
                  <Input
                    value={selectedPrint.image_filename || ''}
                    onChange={(e) => setSelectedPrint({ ...selectedPrint, image_filename: e.target.value })}
                    placeholder="e.g., my-print-image.png"
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setShowEditDialog(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSavePrint}
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