import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Search, ArrowLeft, Upload } from "lucide-react";
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

export default function AdminColors() {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingColor, setEditingColor] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasPermission, setHasPermission] = useState(false);
  const [uploading, setUploading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser.role === 'admin' || currentUser.can_manage_colors) {
        setHasPermission(true);
        loadColors();
      } else {
        setLoading(false);
        navigate(createPageUrl("AdminDashboard"));
      }
    } catch (error) {
      console.error("Permission check failed:", error);
      setLoading(false);
      navigate(createPageUrl("Home"));
    }
  };

  const loadColors = async () => {
    try {
      const data = await base44.entities.Color.list('-created_date');
      setColors(data);
    } catch (error) {
      console.error("Failed to load colors:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (color) => {
    setEditingColor(color);
    setShowDialog(true);
  };

  const handleNew = () => {
    setEditingColor({ name: "", image_url: "" });
    setShowDialog(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEditingColor({ ...editingColor, image_url: file_url });
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!editingColor.image_url) {
      alert('Please upload a color image');
      return;
    }
    
    try {
      if (editingColor.id) {
        await base44.entities.Color.update(editingColor.id, editingColor);
      } else {
        await base44.entities.Color.create(editingColor);
      }
      setShowDialog(false);
      setEditingColor(null);
      loadColors();
    } catch (error) {
      console.error("Failed to save color:", error);
    }
  };

  const handleDelete = async (color) => {
    if (window.confirm(`Are you sure you want to delete ${color.name}?`)) {
      try {
        await base44.entities.Color.delete(color.id);
        loadColors();
      } catch (error) {
        console.error("Failed to delete color:", error);
      }
    }
  };

  const filteredColors = colors.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !hasPermission) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (!hasPermission && !loading) {
    return null;
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

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-light mb-2">Color Options</h1>
            <p className="text-muted-foreground font-light">Manage available garment colors</p>
          </div>
          <Button
            onClick={handleNew}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Color
          </Button>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search colors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {filteredColors.length} color{filteredColors.length !== 1 ? 's' : ''}
              </div>
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
                      <TableHead className="w-24">Preview</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredColors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          No colors found. Add your first color to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredColors.map((color) => (
                        <TableRow key={color.id}>
                          <TableCell>
                            {color.image_url ? (
                              <img 
                                src={color.image_url} 
                                alt={color.name}
                                className="w-16 h-16 rounded-lg border-2 object-cover"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-lg border-2 bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                No image
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{color.name}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(color)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(color)}
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingColor?.id ? 'Edit Color' : 'Add New Color'}</DialogTitle>
            </DialogHeader>
            {editingColor && (
              <div className="space-y-4">
                <div>
                  <Label>Color Name</Label>
                  <Input
                    value={editingColor.name}
                    onChange={(e) => setEditingColor({...editingColor, name: e.target.value})}
                    placeholder="e.g., Navy Blue"
                  />
                </div>
                <div>
                  <Label>Color Image (Required)</Label>
                  <div className="relative">
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-foreground/50 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploading}
                      />
                      {editingColor.image_url ? (
                        <div className="space-y-2">
                          <img 
                            src={editingColor.image_url} 
                            alt="Color preview"
                            className="w-32 h-32 mx-auto rounded-lg object-cover border-2"
                          />
                          <p className="text-sm text-muted-foreground">Image uploaded</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingColor({...editingColor, image_url: ""});
                            }}
                          >
                            Remove Image
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                          <p className="text-sm font-medium">
                            {uploading ? 'Uploading...' : 'Click or drag to upload color image'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            JPG, PNG recommended
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleSave}
                  className="w-full"
                  disabled={uploading || !editingColor.image_url}
                >
                  {editingColor.id ? 'Save Changes' : 'Add Color'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}