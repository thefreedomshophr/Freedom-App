import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Search, Pencil, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AdminIcons() {
  const navigate = useNavigate();
  const [icons, setIcons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingIcon, setEditingIcon] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploading, setUploading] = useState(false);

  // Default icons that should exist
  const defaultIcons = [
    { identifier: "home_color", page_name: "Home", description: "Garment Color option icon" },
    { identifier: "home_style", page_name: "Home", description: "Garment Style option icon" },
    { identifier: "home_print", page_name: "Home", description: "Print Design option icon" },
    { identifier: "layout_home_button", page_name: "Layout Navigation", description: "Home button icon in top navigation bar" },
    { identifier: "employee_code_logo", page_name: "EmployeeCode", description: "Logo icon on the employee code entry page" },
    { identifier: "admin_prints", page_name: "Admin Dashboard", description: "Manage Prints section icon" },
    { identifier: "admin_garments", page_name: "Admin Dashboard", description: "Manage Garments section icon" },
    { identifier: "admin_colors", page_name: "Admin Dashboard", description: "Manage Colors section icon" },
    { identifier: "admin_icons", page_name: "Admin Dashboard", description: "Manage Icons section icon" },
    { identifier: "admin_users", page_name: "Admin Dashboard", description: "Manage Users section icon" },
    { identifier: "garment_type_tops", page_name: "GarmentTypeSelection", description: "Tops option icon on 'What type of garment?' page" },
    { identifier: "garment_type_bottoms", page_name: "GarmentTypeSelection", description: "Bottoms option icon on 'What type of garment?' page" }
  ];

  useEffect(() => {
    loadIcons();
  }, []);

  const loadIcons = async () => {
    try {
      const data = await base44.entities.CustomIcon.list();
      
      // Create icons for any missing defaults
      const existingIdentifiers = data.map(icon => icon.identifier);
      const missingIcons = defaultIcons.filter(
        def => !existingIdentifiers.includes(def.identifier)
      );
      
      if (missingIcons.length > 0) {
        await base44.entities.CustomIcon.bulkCreate(
          missingIcons.map(icon => ({ ...icon, icon_url: "" }))
        );
        // Reload after creating defaults
        const refreshedData = await base44.entities.CustomIcon.list();
        setIcons(refreshedData);
      } else {
        setIcons(data);
      }
    } catch (error) {
      console.error("Failed to load icons:", error);
    }
    setLoading(false);
  };

  const handleEdit = (icon) => {
    setEditingIcon(icon);
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      if (editingIcon.id) {
        await base44.entities.CustomIcon.update(editingIcon.id, editingIcon);
      }
      setShowDialog(false);
      setEditingIcon(null);
      loadIcons();
    } catch (error) {
      console.error("Error saving icon:", error);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEditingIcon({ ...editingIcon, icon_url: file_url });
    } catch (error) {
      console.error("Error uploading image:", error);
    }
    setUploading(false);
  };

  const filteredIcons = icons.filter(icon =>
    icon.identifier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    icon.page_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    icon.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <h1 className="text-4xl font-light text-gray-900 mb-2">Custom Icons</h1>
            <p className="text-gray-600 font-light">Customize icons across the application</p>
          </div>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search icons..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-gray-600">
                {filteredIcons.length} icon{filteredIcons.length !== 1 ? 's' : ''}
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
                      <TableHead className="w-20">Preview</TableHead>
                      <TableHead>Identifier</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20">Edit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIcons.map((icon) => (
                      <TableRow key={icon.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                            {icon.icon_url ? (
                              <img 
                                src={icon.icon_url} 
                                alt={icon.identifier}
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <span className="text-xs text-gray-400">No icon</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{icon.identifier}</TableCell>
                        <TableCell>{icon.page_name}</TableCell>
                        <TableCell className="text-sm text-gray-600">{icon.description}</TableCell>
                        <TableCell>
                          {icon.icon_url ? (
                            <span className="text-xs text-green-600 font-medium">Custom</span>
                          ) : (
                            <span className="text-xs text-gray-400">Default</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(icon)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-gray-100">Edit Icon</DialogTitle>
            </DialogHeader>
            {editingIcon && (
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-200">Identifier</Label>
                  <Input
                    value={editingIcon.identifier}
                    disabled
                    className="bg-gray-100 font-mono text-gray-900"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">Page</Label>
                  <Input
                    value={editingIcon.page_name}
                    disabled
                    className="bg-gray-100 text-gray-900"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">Description</Label>
                  <Textarea
                    value={editingIcon.description || ''}
                    onChange={(e) => setEditingIcon({...editingIcon, description: e.target.value})}
                    className="bg-white text-gray-900 border-gray-300"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">Current Icon</Label>
                  <div className="mt-2 p-4 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-300">
                    {editingIcon.icon_url ? (
                      <img 
                        src={editingIcon.icon_url} 
                        alt="Current icon"
                        className="w-24 h-24 object-contain"
                      />
                    ) : (
                      <span className="text-gray-500">No custom icon set</span>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-gray-200">Upload New Icon (PNG recommended)</Label>
                  <div className="mt-2">
                    <label htmlFor="icon-upload">
                      <Button 
                        disabled={uploading} 
                        asChild
                        className="w-full gap-2 bg-gray-700 hover:bg-gray-600 text-white"
                      >
                        <span>
                          <Upload className="w-4 h-4" />
                          {uploading ? 'Uploading...' : 'Choose Image'}
                        </span>
                      </Button>
                    </label>
                    <input
                      id="icon-upload"
                      type="file"
                      accept=".png,.jpg,.jpeg,.svg"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-200">Or paste icon URL</Label>
                  <Input
                    value={editingIcon.icon_url || ''}
                    onChange={(e) => setEditingIcon({...editingIcon, icon_url: e.target.value})}
                    placeholder="https://example.com/icon.png"
                    className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-500"
                  />
                </div>
                <Button onClick={handleSave} className="w-full bg-gray-700 hover:bg-gray-600 text-white">
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