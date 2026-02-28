import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Search, Image as ImageIcon, Pencil, ArrowLeft, Trash2, X, RefreshCw, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import SvgImage from "../components/SvgImage";
import CsvTemplateDownload from "../components/CsvTemplateDownload";

export default function AdminGarments() {
  const [garments, setGarments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [editingGarment, setEditingGarment] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterColor, setFilterColor] = useState("all");
  const [filterStyle, setFilterStyle] = useState("all");
  const [filterSize, setFilterSize] = useState("all");
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, status: '' });
  const [hasPermission, setHasPermission] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [deletingGarment, setDeletingGarment] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser.role === 'admin' || currentUser.can_manage_garments) {
        setHasPermission(true);
        loadGarments();
      } else {
        navigate(createPageUrl("AdminDashboard"));
      }
    } catch (error) {
      console.error("Failed to check user permissions:", error);
      navigate(createPageUrl("Home"));
    }
  };

  const loadGarments = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Garment.list('-created_date');
      setGarments(data);
    } catch (error) {
      console.error("Failed to load garments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: 0, status: 'Uploading CSV...' });

    try {
      // Upload with retry logic
      let uploadRetries = 3;
      let file_url;
      while (uploadRetries > 0) {
        try {
          const uploadResult = await base44.integrations.Core.UploadFile({ file });
          file_url = uploadResult.file_url;
          break;
        } catch (error) {
          uploadRetries--;
          if (error.message?.includes('rate limit') || error.response?.status === 429) {
            if (uploadRetries > 0) {
              setUploadProgress({ current: 0, total: 0, status: `Rate limited, retrying upload... (${uploadRetries} attempts left)` });
              await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
              throw new Error('Upload failed after multiple retries due to rate limiting');
            }
          } else {
            throw error;
          }
        }
      }

      setUploadProgress({ current: 0, total: 0, status: 'Extracting garment data...' });

      // Extract with retry logic
      let extractRetries = 3;
      let result;
      while (extractRetries > 0) {
        try {
          result = await base44.integrations.Core.ExtractDataFromUploadedFile({
            file_url,
            json_schema: {
              type: "array",
              items: {
                type: "object",
                  properties: {
                    Name: { type: "string" },
                    "System ID": { type: "string" },
                    "Sale Price": { type: "number" },
                    Size: { type: "string" },
                    Color: { type: "string" },
                    Style: { type: "string" },
                    "Front Max Print Width": { type: "number" },
                    "Front Max Print Height": { type: "number" },
                    "Back Max Print Width": { type: "number" },
                    "Back Max Print Height": { type: "number" },
                    "Rsleeve Max Print Width": { type: "number" },
                    "Rsleeve Max Print Height": { type: "number" },
                    "Lsleeve Max Print Width": { type: "number" },
                    "Lsleeve Max Print Height": { type: "number" },
                    "Front Image": { type: "string" },
                    "Back Image": { type: "string" },
                    "Rsleeve Image": { type: "string" },
                    "Lsleeve Image": { type: "string" },
                    Availability: { type: "string" },
                    itemID: { type: "string" }
                  }
              }
            }
          });
          break;
        } catch (error) {
          extractRetries--;
          if (error.message?.includes('rate limit') || error.response?.status === 429) {
            if (extractRetries > 0) {
              setUploadProgress({ current: 0, total: 0, status: `Extraction rate limited, retrying... (${extractRetries} attempts left)` });
              await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
              throw new Error('Data extraction failed after multiple retries due to rate limiting');
            }
          } else {
            throw error;
          }
        }
      }

      if (result.status === "success" && result.output) {
        const garmentsData = result.output;

        if (!Array.isArray(garmentsData) || garmentsData.length === 0) {
          alert('No garment data found in CSV or invalid format. Please check your file format.');
          setUploading(false);
          setUploadProgress({ current: 0, total: 0, status: '' });
          return;
        }

        setUploadProgress({ current: 0, total: garmentsData.length, status: `Processing ${garmentsData.length} garments...` });

        // Get all existing garments
        const existingGarments = await base44.entities.Garment.list();
        const existingGarmentsMap = new Map(existingGarments.map(g => [g.system_id?.toString()?.trim(), g]));

        const garmentsToCreate = [];
        const garmentsToUpdate = [];
        const skippedGarments = [];

        for (const garmentData of garmentsData) {
          const systemId = garmentData["System ID"]?.toString()?.trim();
          
          if (!systemId) {
            console.warn(`Garment "${garmentData.Name || 'Unnamed Garment'}" is missing System ID - skipping`);
            skippedGarments.push(garmentData.Name || 'Unnamed');
            continue;
          }

          // Build data object - assign all CSV values directly
          const transformedData = {
            name: garmentData.Name,
            system_id: systemId,
            itemID: garmentData.itemID || garmentData["Item ID"] || undefined,
            cost: garmentData["Sale Price"],
            size: garmentData.Size,
            color: garmentData.Color,
            style: garmentData.Style,
            availability: garmentData.Availability,
            front_max_print_width: garmentData["Front Max Print Width"],
            front_max_print_height: garmentData["Front Max Print Height"],
            back_max_print_width: garmentData["Back Max Print Width"],
            back_max_print_height: garmentData["Back Max Print Height"],
            rsleeve_max_print_width: garmentData["Rsleeve Max Print Width"],
            rsleeve_max_print_height: garmentData["Rsleeve Max Print Height"],
            lsleeve_max_print_width: garmentData["Lsleeve Max Print Width"],
            lsleeve_max_print_height: garmentData["Lsleeve Max Print Height"],
            front_image_filename: garmentData["Front Image"] ? garmentData["Front Image"].split('/').pop() : undefined,
            back_image_filename: garmentData["Back Image"] ? garmentData["Back Image"].split('/').pop() : undefined,
            rsleeve_image_filename: garmentData["Rsleeve Image"] ? garmentData["Rsleeve Image"].split('/').pop() : undefined,
            lsleeve_image_filename: garmentData["Lsleeve Image"] ? garmentData["Lsleeve Image"].split('/').pop() : undefined
          };

          if (existingGarmentsMap.has(systemId)) {
            const existingGarment = existingGarmentsMap.get(systemId);
            // Preserve image URLs
            transformedData.front_image_url = existingGarment.front_image_url || '';
            transformedData.back_image_url = existingGarment.back_image_url || '';
            transformedData.rsleeve_image_url = existingGarment.rsleeve_image_url || '';
            transformedData.lsleeve_image_url = existingGarment.lsleeve_image_url || '';
            
            console.log(`Will update garment ${systemId} (${garmentData.Name}):`, transformedData);
            
            garmentsToUpdate.push({ id: existingGarment.id, data: transformedData });
          } else {
            console.log(`Will create new garment ${systemId} (${garmentData.Name})`);
            transformedData.front_image_url = '';
            transformedData.back_image_url = '';
            transformedData.rsleeve_image_url = '';
            transformedData.lsleeve_image_url = '';
            garmentsToCreate.push(transformedData);
          }
        }

        console.log(`Total to update: ${garmentsToUpdate.length}, Total to create: ${garmentsToCreate.length}, Skipped: ${skippedGarments.length}`);

        setUploadProgress({ current: 0, total: garmentsToUpdate.length, status: `Updating ${garmentsToUpdate.length} existing garments...` });

        const updateFailures = [];

        // Update existing garments in batches of 10 to avoid rate limits
        const batchSize = 10;
        for (let batchStart = 0; batchStart < garmentsToUpdate.length; batchStart += batchSize) {
          const batch = garmentsToUpdate.slice(batchStart, batchStart + batchSize);
          const batchEnd = Math.min(batchStart + batchSize, garmentsToUpdate.length);
          
          setUploadProgress({ 
            current: batchStart, 
            total: garmentsToUpdate.length, 
            status: `Updating garments ${batchStart + 1}-${batchEnd} of ${garmentsToUpdate.length}...` 
          });
          
          for (let i = 0; i < batch.length; i++) {
            const { id, data } = batch[i];
            const globalIndex = batchStart + i;

            try {
              console.log(`Updating ${globalIndex + 1}/${garmentsToUpdate.length}: ${data.system_id} (${data.name})`);
              await base44.entities.Garment.update(id, data);
              console.log(`✓ Successfully updated ${data.system_id}`);

              setUploadProgress({ 
                current: globalIndex + 1, 
                total: garmentsToUpdate.length, 
                status: `Updating garments... (${globalIndex + 1}/${garmentsToUpdate.length})` 
              });

              // Small delay between items in batch
              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
              console.error(`✗ Failed to update garment ${data.name} (${data.system_id}):`, error);
              updateFailures.push({ name: data.name, systemId: data.system_id, error: error.message });
            }
          }
          
          // Longer delay between batches to avoid rate limits
          if (batchEnd < garmentsToUpdate.length) {
            setUploadProgress({ 
              current: batchEnd, 
              total: garmentsToUpdate.length, 
              status: `Completed batch ${Math.ceil(batchEnd / batchSize)} of ${Math.ceil(garmentsToUpdate.length / batchSize)}, waiting 5 seconds before next batch...` 
            });
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }

        setUploadProgress({ current: 0, total: garmentsToCreate.length, status: `Creating ${garmentsToCreate.length} new garments...` });

        // Create new garments
        if (garmentsToCreate.length > 0) {
          const batchSize = 10;

          for (let i = 0; i < garmentsToCreate.length; i += batchSize) {
            const batch = garmentsToCreate.slice(i, i + batchSize);

            try {
              await base44.entities.Garment.bulkCreate(batch);

              setUploadProgress({
                current: Math.min(i + batchSize, garmentsToCreate.length),
                total: garmentsToCreate.length,
                status: `Creating garments... (${Math.min(i + batchSize, garmentsToCreate.length)}/${garmentsToCreate.length})`
              });

              if (i + batchSize < garmentsToCreate.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            } catch (error) {
              console.error(`Failed to create batch starting at index ${i}:`, error);
            }
          }
        }

        // Store garment data with image filenames
        const garmentsWithImages = garmentsData.filter(g =>
          g["Front Image"] || g["Back Image"] || g["Rsleeve Image"] || g["Lsleeve Image"]
        );
        const pendingImageMatches = garmentsWithImages.map(g => ({
          "System ID": g["System ID"],
          "Front Image": g["Front Image"] ? g["Front Image"].split('/').pop() : null,
          "Back Image": g["Back Image"] ? g["Back Image"].split('/').pop() : null,
          "Rsleeve Image": g["Rsleeve Image"] ? g["Rsleeve Image"].split('/').pop() : null,
          "Lsleeve Image": g["Lsleeve Image"] ? g["Lsleeve Image"].split('/').pop() : null,
        }));
        localStorage.setItem('pendingGarmentImageMatches', JSON.stringify(pendingImageMatches));

        setUploadProgress({ current: garmentsData.length, total: garmentsData.length, status: 'Reloading garments...' });

        await loadGarments();

        setUploadProgress({ current: garmentsData.length, total: garmentsData.length, status: 'Complete!' });

        setTimeout(() => {
          setUploading(false);
          setUploadProgress({ current: 0, total: 0, status: '' });
        }, 2000);

        const imageMatchMessage = pendingImageMatches.length > 0
          ? `\n\n${pendingImageMatches.length} garments are waiting for images. Upload SVGs with matching filenames to link them.`
          : '';

        let message = `Successfully processed ${garmentsToUpdate.length} updated garments and ${garmentsToCreate.length} new garments.${imageMatchMessage}`;
        
        if (updateFailures.length > 0) {
          message += `\n\n⚠️ ${updateFailures.length} updates failed:\n${updateFailures.map(f => `- ${f.name} (${f.systemId}): ${f.error}`).join('\n')}`;
        }
        
        if (skippedGarments.length > 0) {
          message += `\n\n⚠️ ${skippedGarments.length} garments skipped (missing System ID): ${skippedGarments.join(', ')}`;
        }

        alert(message);
      } else {
        const errorMsg = result.details || 'Failed to extract garment data from CSV';
        console.error('Extraction failed:', result);
        alert(`CSV Upload Failed: ${errorMsg}\n\nPlease check that your CSV has these columns:\nName, System ID (REQUIRED), Sale Price, Size, Color, Style, Availability, Front/Back/Rsleeve/Lsleeve Max Print Width/Height, Front/Back/Rsleeve/Lsleeve Image`);
        setUploading(false);
        setUploadProgress({ current: 0, total: 0, status: '' });
      }
    } catch (error) {
      console.error("Error uploading CSV:", error);
      alert(`Error processing CSV file: ${error.message || 'Unknown error'}`);
      setUploading(false);
      setUploadProgress({ current: 0, total: 0, status: '' });
    } finally {
      e.target.value = '';
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingImages(true);
    setUploadProgress({ current: 0, total: files.length, status: 'Uploading SVG images...' });

    try {
      const storedPending = localStorage.getItem('pendingGarmentImageMatches');
      const pendingData = storedPending ? JSON.parse(storedPending) : [];

      const allGarments = await base44.entities.Garment.list();

      let matchedCount = 0;
      let uploadedFileUrls = {};

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name.toLowerCase();

        setUploadProgress({
          current: i + 1,
          total: files.length,
          status: `Processing image ${i + 1} of ${files.length}: ${file.name}...`
        });

        let file_url_uploaded = uploadedFileUrls[fileName];
        if (!file_url_uploaded) {
          let retries = 3;
          let uploaded = false;

          while (retries > 0 && !uploaded) {
            try {
              const { file_url } = await base44.integrations.Core.UploadFile({ file });
              file_url_uploaded = file_url;
              uploadedFileUrls[fileName] = file_url_uploaded;
              uploaded = true;

              if (i < files.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } catch (error) {
              retries--;
              if (error.message?.includes('rate limit') || error.response?.status === 429) {
                setUploadProgress({ current: i + 1, total: files.length, status: `Rate limited for ${file.name}, waiting before retry... (${retries} attempts left)` });
                await new Promise(resolve => setTimeout(resolve, 2000));
              } else {
                throw error;
              }
            }
          }

          if (!uploaded) {
            console.error(`Failed to upload ${file.name} after multiple retries.`);
            continue;
          }
        }

        const garmentsToUpdatePromises = allGarments.map(async garment => {
          const updates = {};
          let updated = false;

          const checkAndAssign = (garmentField, pendingField) => {
            const filenameFromGarment = garment[garmentField]?.toLowerCase();
            const filenameFromPending = pendingData.find(pd => pd["System ID"] === garment.system_id)?.[pendingField]?.toLowerCase();

            if ((filenameFromGarment && filenameFromGarment === fileName) ||
                (filenameFromPending && filenameFromPending === fileName)) {
              updates[garmentField.replace('_filename', '_url')] = file_url_uploaded;
              updates[garmentField] = file.name;
              updated = true;
            }
          };

          checkAndAssign('front_image_filename', 'Front Image');
          checkAndAssign('back_image_filename', 'Back Image');
          checkAndAssign('rsleeve_image_filename', 'Rsleeve Image');
          checkAndAssign('lsleeve_image_filename', 'Lsleeve Image');

          if (updated && Object.keys(updates).length > 0) {
            try {
              await base44.entities.Garment.update(garment.id, updates);
              matchedCount++;
            } catch (error) {
              console.error(`Failed to update garment ${garment.name} with image ${file.name}:`, error);
            }
          }
        });
        await Promise.all(garmentsToUpdatePromises);
      }

      setUploadProgress({ current: files.length, total: files.length, status: 'Reloading garments...' });

      localStorage.removeItem('pendingGarmentImageMatches');

      await loadGarments();

      setUploadProgress({ current: files.length, total: files.length, status: `Complete! ${matchedCount} image URLs updated.` });

      setTimeout(() => {
        setUploadingImages(false);
        setUploadProgress({ current: 0, total: 0, status: '' });
      }, 2000);

      alert(`Successfully processed ${files.length} image files. Updated image URLs for ${matchedCount} garment fields.`);
    } catch (error) {
      console.error('Error uploading images:', error);
      alert(`Error uploading images: ${error.message}`);
      setUploadingImages(false);
      setUploadProgress({ current: 0, total: 0, status: '' });
    } finally {
      e.target.value = '';
    }
  };

  const handleEdit = (garment) => {
    setEditingGarment(garment);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (editingGarment.id) {
      await base44.entities.Garment.update(editingGarment.id, editingGarment);
    }
    setShowDialog(false);
    setEditingGarment(null);
    loadGarments();
  };

  const handleDeleteClick = (garment) => {
    setDeletingGarment(garment);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (deletingGarment?.id) {
      await base44.entities.Garment.delete(deletingGarment.id);
      setShowDeleteDialog(false);
      setDeletingGarment(null);
      loadGarments();
    }
  };

  const filteredGarments = garments.filter(g => {
    const matchesSearch = g.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.color?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.style?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.system_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.availability?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesColor = filterColor === "all" || g.color?.toLowerCase() === filterColor.toLowerCase();
    const matchesStyle = filterStyle === "all" || g.style?.toLowerCase() === filterStyle.toLowerCase();
    const matchesSize = filterSize === "all" || g.size === filterSize;
    
    return matchesSearch && matchesColor && matchesStyle && matchesSize;
  });

  const uniqueColors = [...new Set(garments.map(g => g.color).filter(Boolean))].sort();
  const uniqueStyles = [...new Set(garments.map(g => g.style).filter(Boolean))].sort();
  const uniqueSizes = [...new Set(garments.map(g => g.size).filter(Boolean))].sort((a, b) => {
    const sizeOrder = ['S', 'M', 'L', 'XL', '2X', '3X'];
    return sizeOrder.indexOf(a) - sizeOrder.indexOf(b);
  });

  if (!hasPermission) {
    return (
      <div className="min-h-[calc(10vh-4rem)] p-6 md:p-12 flex items-center justify-center">
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

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-light mb-2">Garment Catalog</h1>
            <p className="text-muted-foreground font-light">Manage your garment inventory</p>
          </div>
          <div className="flex gap-3">
            <label htmlFor="csv-upload">
              <Button
                disabled={uploading}
                asChild
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <span>
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Processing CSV...' : 'Upload Garment CSV'}
                </span>
              </Button>
            </label>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="hidden"
            />

            <label htmlFor="images-upload">
              <Button
                disabled={uploadingImages}
                asChild
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <span>
                  <ImageIcon className="w-4 h-4" />
                  {uploadingImages ? 'Uploading...' : 'Upload SVG Images'}
                </span>
              </Button>
            </label>
            <input
              id="images-upload"
              type="file"
              accept=".svg"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </div>

        <Card className="border-0 shadow-lg mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">CSV Template</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Download the CSV template to ensure correct column headers for bulk upload.
            </p>
            <CsvTemplateDownload type="garments" />
          </CardContent>
        </Card>

        {(uploading || uploadingImages) && (
          <Alert className="mb-6 bg-blue-50 border-blue-200">
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-blue-900">
                  <span>{uploadProgress.status}</span>
                  {uploadProgress.total > 0 && (
                    <span>{uploadProgress.current} / {uploadProgress.total}</span>
                  )}
                </div>
                {uploadProgress.total > 0 && (
                  <Progress
                    value={(uploadProgress.current / uploadProgress.total) * 100}
                    className="h-2"
                  />
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search by name, system ID, color, style, or availability..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  {filteredGarments.length} garment{filteredGarments.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg border-2 border-border">
                <Label htmlFor="show-images" className="text-sm font-medium cursor-pointer">Show Images</Label>
                <Switch
                  id="show-images"
                  checked={showImages}
                  onCheckedChange={setShowImages}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Color:</Label>
                <Select value={filterColor} onValueChange={setFilterColor}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Colors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Colors</SelectItem>
                    {uniqueColors.map(color => (
                      <SelectItem key={color} value={color}>{color}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filterColor !== "all" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setFilterColor("all")}
                    className="h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Style:</Label>
                <Select value={filterStyle} onValueChange={setFilterStyle}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Styles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Styles</SelectItem>
                    {uniqueStyles.map(style => (
                      <SelectItem key={style} value={style}>{style}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filterStyle !== "all" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setFilterStyle("all")}
                    className="h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Size:</Label>
                <Select value={filterSize} onValueChange={setFilterSize}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All Sizes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sizes</SelectItem>
                    {uniqueSizes.map(size => (
                      <SelectItem key={size} value={size}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filterSize !== "all" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setFilterSize("all")}
                    className="h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {(filterColor !== "all" || filterStyle !== "all" || filterSize !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilterColor("all");
                    setFilterStyle("all");
                    setFilterSize("all");
                  }}
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear All Filters
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {showImages && <TableHead className="w-48">Images</TableHead>}
                      <TableHead>Name</TableHead>
                      <TableHead>System ID</TableHead>
                      <TableHead>Item ID</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Style</TableHead>
                      <TableHead>Availability</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGarments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={showImages ? 10 : 9} className="text-center py-8 text-muted-foreground">
                          No garments found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredGarments.map((garment) => (
                        <TableRow key={garment.id}>
                          {showImages && (
                            <TableCell>
                              <div className="flex gap-1">
                                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center overflow-hidden" title="Front">
                                  <SvgImage
                                    src={garment.front_image_url}
                                    alt="Front"
                                    className="w-full h-full flex items-center justify-center"
                                    fallback={<span className="text-xs text-muted-foreground">F</span>}
                                  />
                                </div>
                                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center overflow-hidden" title="Back">
                                  <SvgImage
                                    src={garment.back_image_url}
                                    alt="Back"
                                    className="w-full h-full flex items-center justify-center"
                                    fallback={<span className="text-xs text-muted-foreground">B</span>}
                                  />
                                </div>
                                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center overflow-hidden" title="Right Sleeve">
                                  <SvgImage
                                    src={garment.rsleeve_image_url}
                                    alt="Right Sleeve"
                                    className="w-full h-full flex items-center justify-center"
                                    fallback={<span className="text-xs text-muted-foreground">RS</span>}
                                  />
                                </div>
                                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center overflow-hidden" title="Left Sleeve">
                                  <SvgImage
                                    src={garment.lsleeve_image_url}
                                    alt="Left Sleeve"
                                    className="w-full h-full flex items-center justify-center"
                                    fallback={<span className="text-xs text-muted-foreground">LS</span>}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="font-medium">{garment.name}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {garment.system_id}
                            </code>
                          </TableCell>
                          <TableCell>
                            {garment.itemID ? (
                              <code className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-2 py-1 rounded">
                                {garment.itemID}
                              </code>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            ${garment.cost?.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{garment.size}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {garment.color}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {garment.style || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {garment.availability || 'All'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(garment)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteClick(garment)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Garment</DialogTitle>
            </DialogHeader>
            {editingGarment && (
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={editingGarment.name || ''}
                    onChange={(e) => setEditingGarment({...editingGarment, name: e.target.value})}
                  />
                </div>
                <div>
                  <Label>System ID</Label>
                  <Input
                    value={editingGarment.system_id || ''}
                    onChange={(e) => setEditingGarment({...editingGarment, system_id: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Item ID (Lightspeed)</Label>
                  <Input
                    value={editingGarment.itemID || ''}
                    onChange={(e) => setEditingGarment({...editingGarment, itemID: e.target.value})}
                    placeholder="Synced from Lightspeed"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Sale Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editingGarment.cost || ''}
                      onChange={(e) => setEditingGarment({...editingGarment, cost: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label>Size</Label>
                    <Input
                      value={editingGarment.size || ''}
                      onChange={(e) => setEditingGarment({...editingGarment, size: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Color</Label>
                    <Input
                      value={editingGarment.color || ''}
                      onChange={(e) => setEditingGarment({...editingGarment, color: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Style</Label>
                    <Input
                      value={editingGarment.style || ''}
                      onChange={(e) => setEditingGarment({...editingGarment, style: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <Label>Availability</Label>
                  <Input
                    value={editingGarment.availability || ''}
                    onChange={(e) => setEditingGarment({...editingGarment, availability: e.target.value})}
                    placeholder="e.g., FR, SH, CB or FR, SH"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use: FR (Freedom), SH (Sharkys), CB (Cannon Beach Freedom)
                  </p>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3">Front View Max Print Dimensions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Width (inches)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={editingGarment.front_max_print_width || ''}
                        onChange={(e) => setEditingGarment({...editingGarment, front_max_print_width: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label>Height (inches)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={editingGarment.front_max_print_height || ''}
                        onChange={(e) => setEditingGarment({...editingGarment, front_max_print_height: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3">Back View Max Print Dimensions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Width (inches)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={editingGarment.back_max_print_width || ''}
                        onChange={(e) => setEditingGarment({...editingGarment, back_max_print_width: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label>Height (inches)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={editingGarment.back_max_print_height || ''}
                        onChange={(e) => setEditingGarment({...editingGarment, back_max_print_height: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3">Right Sleeve Max Print Dimensions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Width (inches)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={editingGarment.rsleeve_max_print_width || ''}
                        onChange={(e) => setEditingGarment({...editingGarment, rsleeve_max_print_width: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label>Height (inches)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={editingGarment.rsleeve_max_print_height || ''}
                        onChange={(e) => setEditingGarment({...editingGarment, rsleeve_max_print_height: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3">Left Sleeve Max Print Dimensions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Width (inches)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={editingGarment.lsleeve_max_print_width || ''}
                        onChange={(e) => setEditingGarment({...editingGarment, lsleeve_max_print_width: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label>Height (inches)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={editingGarment.lsleeve_max_print_height || ''}
                        onChange={(e) => setEditingGarment({...editingGarment, lsleeve_max_print_height: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Front Image Filename</Label>
                  <Input
                    value={editingGarment.front_image_filename || ''}
                    onChange={(e) => setEditingGarment({...editingGarment, front_image_filename: e.target.value})}
                    placeholder="e.g., shirt-front.svg"
                  />
                </div>
                <div>
                  <Label>Back Image Filename</Label>
                  <Input
                    value={editingGarment.back_image_filename || ''}
                    onChange={(e) => setEditingGarment({...editingGarment, back_image_filename: e.target.value})}
                    placeholder="e.g., shirt-back.svg"
                  />
                </div>
                <div>
                  <Label>Right Sleeve Image Filename</Label>
                  <Input
                    value={editingGarment.rsleeve_image_filename || ''}
                    onChange={(e) => setEditingGarment({...editingGarment, rsleeve_image_filename: e.target.value})}
                    placeholder="e.g., shirt-rsleeve.svg"
                  />
                </div>
                <div>
                  <Label>Left Sleeve Image Filename</Label>
                  <Input
                    value={editingGarment.lsleeve_image_filename || ''}
                    onChange={(e) => setEditingGarment({...editingGarment, lsleeve_image_filename: e.target.value})}
                    placeholder="e.g., shirt-lsleeve.svg"
                  />
                </div>
                <Button onClick={handleSave} className="w-full">
                  Save Changes
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Garment</DialogTitle>
            </DialogHeader>
            <p>
              Are you sure you want to delete <span className="font-semibold">{deletingGarment?.name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-4">
              <Button
                onClick={() => setShowDeleteDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}