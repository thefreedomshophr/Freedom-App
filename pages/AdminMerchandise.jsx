import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Search, Image as ImageIcon, Pencil, ArrowLeft, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CsvTemplateDownload from "../components/CsvTemplateDownload";

export default function AdminMerchandise() {
  const [merchandise, setMerchandise] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, status: '' });
  const [csvProgress, setCsvProgress] = useState({ current: 0, total: 0, status: '' });
  const [hasPermission, setHasPermission] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser.role === 'admin') {
        setHasPermission(true);
        loadMerchandise();
      } else {
        navigate(createPageUrl("AdminDashboard"));
      }
    } catch (error) {
      console.error("Failed to check user permissions:", error);
      navigate(createPageUrl("Home"));
    }
  };

  const loadMerchandise = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Merchandise.list('-created_date');
      setMerchandise(data);
    } catch (error) {
      console.error("Failed to load merchandise:", error);
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

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setCsvProgress({ current: 0, total: 3, status: 'Parsing CSV...' });

    try {
      // Parse CSV directly
      const merchandiseData = await parseCsvFile(file);
      
      if (!Array.isArray(merchandiseData) || merchandiseData.length === 0) {
        alert('No merchandise data found in CSV. Please check your file format.');
        setUploading(false);
        setCsvProgress({ current: 0, total: 0, status: '' });
        return;
      }

      setCsvProgress({ current: 1, total: 3, status: `Processing ${merchandiseData.length} items...` });

      // Get existing merchandise
      const existingItems = await base44.entities.Merchandise.list();
      const existingBySystemId = new Map(existingItems.filter(i => i.system_id).map(item => [item.system_id?.toString()?.trim(), item]));
      const existingByUpc = new Map(existingItems.filter(i => i.upc).map(item => [item.upc?.toString()?.trim(), item]));

      const itemsToCreate = [];
      const itemsToUpdate = [];

      for (const itemData of merchandiseData) {
        const systemId = itemData.system_id?.toString()?.trim();
        const upc = itemData.upc?.toString()?.trim();

        if (!systemId && !upc && !itemData.name) {
          continue;
        }

        const transformedItem = {
          name: itemData.name,
          system_id: systemId || '',
          price: parseFloat(itemData.price) || 0,
          itemID: itemData.item_id || itemData.itemid || '',
          upc: upc || ''
        };

        // Match existing by system_id first, then UPC
        const existingItem = (systemId && existingBySystemId.get(systemId)) || (upc && existingByUpc.get(upc));

        if (existingItem) {
          transformedItem.image_url = existingItem.image_url || '';
          itemsToUpdate.push({ id: existingItem.id, data: transformedItem });
        } else {
          transformedItem.image_url = '';
          itemsToCreate.push(transformedItem);
        }
      }

      setCsvProgress({ current: 2, total: 3, status: `Updating ${itemsToUpdate.length} items...` });

      // Update existing items
      for (let i = 0; i < itemsToUpdate.length; i++) {
        const { id, data } = itemsToUpdate[i];
        await base44.entities.Merchandise.update(id, data);
        
        setCsvProgress({ 
          current: 2, 
          total: 3, 
          status: `Updating items... (${i + 1}/${itemsToUpdate.length})` 
        });

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Create new items
      if (itemsToCreate.length > 0) {
        setCsvProgress({ current: 2, total: 3, status: `Creating ${itemsToCreate.length} new items...` });
        await base44.entities.Merchandise.bulkCreate(itemsToCreate);
      }

      setCsvProgress({ current: 3, total: 3, status: 'Complete! Reloading...' });

      await loadMerchandise();

      setTimeout(() => {
        setUploading(false);
        setCsvProgress({ current: 0, total: 0, status: '' });
      }, 2000);

      alert(`Successfully processed ${itemsToUpdate.length} updated items and ${itemsToCreate.length} new items.`);
    } catch (error) {
      console.error("Error uploading CSV:", error);
      alert(`Error processing CSV file: ${error.message || 'Unknown error'}`);
      setUploading(false);
      setCsvProgress({ current: 0, total: 0, status: '' });
    } finally {
      e.target.value = '';
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingImages(true);
    setUploadProgress({ current: 0, total: files.length, status: 'Uploading images...' });

    try {
      // Upload all images first and create a map
      const imageMap = {};
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({
          current: i + 1,
          total: files.length,
          status: `Uploading ${file.name}...`
        });

        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const fileNameWithExt = file.name.toLowerCase();
        const fileNameNoExt = file.name.replace(/\.[^/.]+$/, '').toLowerCase();
        imageMap[fileNameWithExt] = file_url;
        imageMap[fileNameNoExt] = file_url;
      }

      // Match and update merchandise based on their stored image filenames
      setUploadProgress({
        current: 0,
        total: merchandise.length,
        status: 'Matching images to merchandise...'
      });

      let matchedCount = 0;
      for (let i = 0; i < merchandise.length; i++) {
        const item = merchandise[i];
        
        if (item.image_url) {
          const imageKey = item.image_url.toLowerCase().replace(/\.[^/.]+$/, '');
          const imageKeyWithExt = item.image_url.toLowerCase();
          
          if (imageMap[imageKey] || imageMap[imageKeyWithExt]) {
            await base44.entities.Merchandise.update(item.id, {
              ...item,
              image_url: imageMap[imageKey] || imageMap[imageKeyWithExt]
            });
            matchedCount++;
          }
        }

        setUploadProgress({
          current: i + 1,
          total: merchandise.length,
          status: `Updating merchandise... (${matchedCount} matched)`
        });
      }

      setUploadProgress({
        current: merchandise.length,
        total: merchandise.length,
        status: `Complete! ${matchedCount} items updated with images.`
      });

      setTimeout(() => {
        loadMerchandise();
        setUploadingImages(false);
        setUploadProgress({ current: 0, total: 0, status: '' });
      }, 2000);

    } catch (error) {
      console.error("Error uploading images:", error);
      setUploadProgress({
        current: 0,
        total: 0,
        status: 'Error uploading images. Please try again.'
      });
      setTimeout(() => {
        setUploadingImages(false);
        setUploadProgress({ current: 0, total: 0, status: '' });
      }, 3000);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowDialog(true);
  };

  const handleNew = () => {
    setEditingItem({ name: '', system_id: '', itemID: '', price: 0, image_url: '' });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (editingItem.id) {
      await base44.entities.Merchandise.update(editingItem.id, editingItem);
    } else {
      await base44.entities.Merchandise.create(editingItem);
    }
    setShowDialog(false);
    setEditingItem(null);
    loadMerchandise();
  };

  const handleDelete = async (item) => {
    if (window.confirm(`Are you sure you want to delete ${item.name}?`)) {
      await base44.entities.Merchandise.delete(item.id);
      loadMerchandise();
    }
  };

  const filteredMerchandise = merchandise.filter(item =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.system_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!hasPermission) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800"></div>
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
            <h1 className="text-4xl font-light text-gray-900 mb-2">Merchandise Catalog</h1>
            <p className="text-gray-600 font-light">Manage your merchandise inventory</p>
          </div>
          <div className="flex gap-3">
            <CsvTemplateDownload type="merchandise" />
            <Button
              onClick={handleNew}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <ImageIcon className="w-4 h-4" />
              Add Item
            </Button>
            <label htmlFor="csv-upload">
              <Button
                disabled={uploading}
                asChild
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <span>
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Uploading CSV...' : 'Upload CSV'}
                </span>
              </Button>
            </label>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
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
                  {uploadingImages ? 'Uploading...' : 'Upload Images'}
                </span>
              </Button>
            </label>
            <input
              id="images-upload"
              type="file"
              accept=".svg,.png,.jpg,.jpeg"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </div>

        {uploading && (
          <Alert className="mb-6 bg-blue-50 border-blue-200">
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium text-blue-900">
                  <span>{csvProgress.status || 'Processing...'}</span>
                  <span>{Math.round(csvProgress.current)} / {csvProgress.total}</span>
                </div>
                <Progress
                  value={csvProgress.total > 0 ? (csvProgress.current / csvProgress.total) * 100 : 0}
                  className="h-2"
                />
              </div>
            </AlertDescription>
          </Alert>
        )}

        {uploadingImages && (
          <Alert className="mb-6">
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{uploadProgress.status}</span>
                  <span>{uploadProgress.current} / {uploadProgress.total}</span>
                </div>
                <Progress
                  value={(uploadProgress.current / uploadProgress.total) * 100}
                  className="h-2"
                />
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by name or system ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-gray-600">
                {filteredMerchandise.length} item{filteredMerchandise.length !== 1 ? 's' : ''}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800 mx-auto"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-32">Image</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>System ID</TableHead>
                      <TableHead>Item ID</TableHead>
                      <TableHead>UPC</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMerchandise.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          No merchandise found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMerchandise.map((item) => (
                        <TableRow key={item.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" />
                              ) : (
                                <ImageIcon className="w-8 h-8 text-gray-400" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted text-foreground px-2 py-1 rounded">
                              {item.system_id || 'N/A'}
                            </code>
                          </TableCell>
                          <TableCell>
                           {item.itemID ? (
                             <code className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                               {item.itemID}
                             </code>
                           ) : (
                             <span className="text-xs text-gray-400">-</span>
                           )}
                          </TableCell>
                          <TableCell>
                           {item.upc ? (
                             <code className="text-xs bg-muted text-foreground px-2 py-1 rounded">
                               {item.upc}
                             </code>
                           ) : (
                             <span className="text-xs text-gray-400">-</span>
                           )}
                          </TableCell>
                          <TableCell className="font-medium">
                            ${item.price?.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(item)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(item)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
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
          <DialogContent className="max-w-xl bg-gray-900 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-gray-100">
                {editingItem?.id ? 'Edit Merchandise' : 'Add New Merchandise'}
              </DialogTitle>
            </DialogHeader>
            {editingItem && (
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-300">Name</Label>
                  <Input
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                    className="bg-gray-800 border-gray-700 text-gray-100"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">System ID</Label>
                  <Input
                    value={editingItem.system_id}
                    onChange={(e) => setEditingItem({...editingItem, system_id: e.target.value})}
                    className="bg-gray-800 border-gray-700 text-gray-100"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Item ID (Lightspeed)</Label>
                  <Input
                    value={editingItem.itemID || ''}
                    onChange={(e) => setEditingItem({...editingItem, itemID: e.target.value})}
                    className="bg-gray-800 border-gray-700 text-gray-100"
                    placeholder="Enter manually"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">UPC (Barcode on item)</Label>
                  <Input
                    value={editingItem.upc || ''}
                    onChange={(e) => setEditingItem({...editingItem, upc: e.target.value})}
                    className="bg-gray-800 border-gray-700 text-gray-100"
                    placeholder="e.g., 012345678901"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingItem.price}
                    onChange={(e) => setEditingItem({...editingItem, price: parseFloat(e.target.value)})}
                    className="bg-gray-800 border-gray-700 text-gray-100"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Image Filename (for matching uploads)</Label>
                  <Input
                    value={editingItem.image_url}
                    onChange={(e) => setEditingItem({...editingItem, image_url: e.target.value})}
                    className="bg-gray-800 border-gray-700 text-gray-100"
                    placeholder="e.g., item-image.svg"
                  />
                </div>
                <Button onClick={handleSave} className="w-full bg-gray-700 hover:bg-gray-600 text-gray-100">
                  Save Changes
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}