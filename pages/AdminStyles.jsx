import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Search, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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

export default function AdminStyles() {
  const [styles, setStyles] = useState([]);
  const [styleGroups, setStyleGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStyle, setEditingStyle] = useState(null);
  const [editingStyleGroup, setEditingStyleGroup] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [hasPermission, setHasPermission] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [placements, setPlacements] = useState([]);
  const [styleConfigs, setStyleConfigs] = useState([]);
  const [editingStyleConfig, setEditingStyleConfig] = useState(null);
  const [showPlacementDialog, setShowPlacementDialog] = useState(false);
  const [availablePrintAreas, setAvailablePrintAreas] = useState([]);
  const [garments, setGarments] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      
      const currentUser = await base44.auth.me();
      if (currentUser.role === 'admin' || currentUser.can_manage_garments) {
        setHasPermission(true);
        loadStyles();
        loadStyleGroups();
        loadPlacements();
        loadStyleConfigs();
      } else {
        navigate(createPageUrl("AdminDashboard"));
      }
    } catch (error) {
      console.error("Permission check failed:", error);
      base44.auth.redirectToLogin(window.location.href);
    }
  };

  const loadStyles = async () => {
    try {
      const loadedGarments = await base44.entities.Garment.list();
      setGarments(loadedGarments);
      
      // Get unique styles with counts
      const styleMap = {};
      loadedGarments.forEach(garment => {
        if (garment.style) {
          if (!styleMap[garment.style]) {
            styleMap[garment.style] = {
              name: garment.style,
              count: 0,
              garmentIds: []
            };
          }
          styleMap[garment.style].count++;
          styleMap[garment.style].garmentIds.push(garment.id);
        }
      });
      
      const uniqueStyles = Object.values(styleMap);
      setStyles(uniqueStyles);
    } catch (error) {
      console.error("Failed to load styles:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStyleGroups = async () => {
    try {
      const groups = await base44.entities.StyleGroup.list();
      setStyleGroups(groups.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    } catch (error) {
      console.error("Failed to load style groups:", error);
    }
  };

  const loadPlacements = async () => {
    try {
      const data = await base44.entities.Placement.list();
      setPlacements(data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    } catch (error) {
      console.error("Failed to load placements:", error);
    }
  };

  const loadStyleConfigs = async () => {
    try {
      const configs = await base44.entities.Style.list();
      setStyleConfigs(configs);
    } catch (error) {
      console.error("Failed to load style configs:", error);
    }
  };

  const handleEdit = (style) => {
    setEditingStyle({ originalName: style.name, newName: style.name, garmentIds: style.garmentIds });
    setShowDialog(true);
  };

  const handleEditPlacements = (style) => {
    const existingConfig = styleConfigs.find(c => c.style_name === style.name);
    if (existingConfig) {
      setEditingStyleConfig({ 
        ...existingConfig,
        adult_placements: existingConfig.adult_placements || [],
        sleeve_placements: existingConfig.sleeve_placements || [],
        crest_placements: existingConfig.crest_placements || [],
        baby_placements: existingConfig.baby_placements || [],
        jr_placements: existingConfig.jr_placements || [],
        kid_placements: existingConfig.kid_placements || [],
        leg_placements: existingConfig.leg_placements || [],
        oversize_placements: existingConfig.oversize_placements || [],
        patch_placements: existingConfig.patch_placements || []
      });
    } else {
      setEditingStyleConfig({
        style_name: style.name,
        adult_placements: [],
        sleeve_placements: [],
        crest_placements: [],
        baby_placements: [],
        jr_placements: [],
        kid_placements: [],
        leg_placements: [],
        oversize_placements: [],
        patch_placements: []
      });
    }
    
    // Load available print areas for this style
    const sampleGarment = garments.find(g => g.style === style.name);
    const areas = [];
    
    // Styles with dual front print areas (rprint-area and lprint-area)
    const dualFrontStyles = ['Quarter Zip', 'Zip Hoodie', 'Sweatpants', 'Youth Sweatpants'];
    const hasDualFront = dualFrontStyles.includes(style.name);
    
    if (sampleGarment) {
      if (sampleGarment.front_image_url) {
        if (hasDualFront) {
          areas.push({ value: 'front:rprint-area', label: 'Front Right' });
          areas.push({ value: 'front:lprint-area', label: 'Front Left' });
        } else {
          areas.push({ value: 'front:print-area', label: 'Front' });
        }
      }
      if (sampleGarment.back_image_url) {
        areas.push({ value: 'back:print-area', label: 'Back' });
      }
      if (sampleGarment.rsleeve_image_url) {
        areas.push({ value: 'right:print-area', label: 'Right Sleeve' });
      }
      if (sampleGarment.lsleeve_image_url) {
        areas.push({ value: 'left:print-area', label: 'Left Sleeve' });
      }
    }
    
    // Default fallback if no garment found
    if (areas.length === 0) {
      areas.push({ value: 'front:print-area', label: 'Front' });
    }
    
    setAvailablePrintAreas(areas);
    setShowPlacementDialog(true);
  };

  const handleSavePlacements = async () => {
    try {
      // Clean the config to only include fields that have values
      const cleanedConfig = {
        style_name: editingStyleConfig.style_name,
        adult_placements: editingStyleConfig.adult_placements || [],
        sleeve_placements: editingStyleConfig.sleeve_placements || [],
        crest_placements: editingStyleConfig.crest_placements || [],
        baby_placements: editingStyleConfig.baby_placements || [],
        jr_placements: editingStyleConfig.jr_placements || [],
        kid_placements: editingStyleConfig.kid_placements || [],
        leg_placements: editingStyleConfig.leg_placements || [],
        oversize_placements: editingStyleConfig.oversize_placements || [],
        patch_placements: editingStyleConfig.patch_placements || []
      };

      if (editingStyleConfig.id) {
        await base44.entities.Style.update(editingStyleConfig.id, cleanedConfig);
      } else {
        await base44.entities.Style.create(cleanedConfig);
      }
      setShowPlacementDialog(false);
      setEditingStyleConfig(null);
      loadStyleConfigs();
    } catch (error) {
      console.error("Failed to save style placements:", error);
      alert("Failed to save style placements. Please try again.");
    }
  };

  const togglePlacement = (printSize, placementName) => {
    const field = `${printSize}_placements`;
    const current = editingStyleConfig[field] || [];
    const exists = current.find(p => p.name === placementName);
    
    const updated = exists
      ? current.filter(p => p.name !== placementName)
      : [...current, { name: placementName, x: 50, y: 50, print_area: 'front:print-area' }];
    
    setEditingStyleConfig({ ...editingStyleConfig, [field]: updated });
  };

  const updatePlacementCoords = (printSize, placementName, coord, value) => {
    const field = `${printSize}_placements`;
    const current = editingStyleConfig[field] || [];
    const updated = current.map(p => 
      p.name === placementName 
        ? { ...p, [coord]: value === '' ? 0 : parseFloat(value) }
        : p
    );
    setEditingStyleConfig({ ...editingStyleConfig, [field]: updated });
  };

  const updatePlacementArea = (printSize, placementName, printArea) => {
    const field = `${printSize}_placements`;
    const current = editingStyleConfig[field] || [];
    const updated = current.map(p => 
      p.name === placementName 
        ? { ...p, print_area: printArea }
        : p
    );
    setEditingStyleConfig({ ...editingStyleConfig, [field]: updated });
  };

  const handleNew = () => {
    setEditingStyle({ originalName: null, newName: "", garmentIds: [] });
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      if (editingStyle.originalName) {
        // Update all garments with this style
        for (const garmentId of editingStyle.garmentIds) {
          const garment = await base44.entities.Garment.list();
          const garmentToUpdate = garment.find(g => g.id === garmentId);
          if (garmentToUpdate) {
            await base44.entities.Garment.update(garmentId, {
              ...garmentToUpdate,
              style: editingStyle.newName
            });
          }
        }
      }
      // For new styles, they'll be used when creating garments
      
      setShowDialog(false);
      setEditingStyle(null);
      loadStyles();
    } catch (error) {
      console.error("Failed to save style:", error);
      alert("Failed to save style. Please try again.");
    }
  };

  const handleDelete = async (style) => {
    if (style.count > 0) {
      const confirm = window.confirm(
        `This style is used by ${style.count} garment(s). Deleting it will remove the style from all these garments. Are you sure?`
      );
      if (!confirm) return;
    }

    try {
      // Update all garments with this style to have empty style
      for (const garmentId of style.garmentIds) {
        const garment = await base44.entities.Garment.list();
        const garmentToUpdate = garment.find(g => g.id === garmentId);
        if (garmentToUpdate) {
          await base44.entities.Garment.update(garmentId, {
            ...garmentToUpdate,
            style: ""
          });
        }
      }
      
      loadStyles();
    } catch (error) {
      console.error("Failed to delete style:", error);
      alert("Failed to delete style. Please try again.");
    }
  };

  const handleNewGroup = () => {
    setEditingStyleGroup({ 
      id: null, 
      name: "", 
      styles: [],
      image_url: "",
      sort_order: styleGroups.length 
    });
    setSelectedImage(null);
    setShowGroupDialog(true);
  };

  const handleEditGroup = (group) => {
    setEditingStyleGroup({ ...group });
    setSelectedImage(null);
    setShowGroupDialog(true);
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const response = await base44.integrations.Core.UploadFile({ file });
      setSelectedImage(response.file_url);
      setEditingStyleGroup({ ...editingStyleGroup, image_url: response.file_url });
    } catch (error) {
      console.error("Failed to upload image:", error);
      alert("Failed to upload image");
    }
  };

  const handleSaveGroup = async () => {
    try {
      if (editingStyleGroup.id) {
        await base44.entities.StyleGroup.update(editingStyleGroup.id, editingStyleGroup);
      } else {
        await base44.entities.StyleGroup.create(editingStyleGroup);
      }
      setShowGroupDialog(false);
      setEditingStyleGroup(null);
      setSelectedImage(null);
      loadStyleGroups();
    } catch (error) {
      console.error("Failed to save style group:", error);
      alert("Failed to save style group. Please try again.");
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!confirm(`Delete style group "${group.name}"? This will not delete the styles themselves.`)) {
      return;
    }

    try {
      await base44.entities.StyleGroup.delete(group.id);
      loadStyleGroups();
    } catch (error) {
      console.error("Failed to delete style group:", error);
      alert("Failed to delete style group. Please try again.");
    }
  };

  const toggleStyleInGroup = (styleName) => {
    const currentStyles = editingStyleGroup.styles || [];
    const newStyles = currentStyles.includes(styleName)
      ? currentStyles.filter(s => s !== styleName)
      : [...currentStyles, styleName];
    setEditingStyleGroup({ ...editingStyleGroup, styles: newStyles });
  };

  const filteredStyles = styles.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredStyleGroups = styleGroups.filter(g =>
    g.name?.toLowerCase().includes(groupSearchTerm.toLowerCase())
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
            <h1 className="text-4xl font-light mb-2">Garment Styles</h1>
            <p className="text-muted-foreground font-light">Manage available garment styles and groups</p>
          </div>
        </div>

        {/* Style Groups Section */}
        <Card className="border-0 shadow-lg mb-8">
          <CardHeader className="border-b">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-light">Style Groups</h2>
                <p className="text-sm text-muted-foreground mt-1">Group styles together for easier browsing</p>
              </div>
              <Button
                onClick={handleNewGroup}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Group
              </Button>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search style groups..."
                  value={groupSearchTerm}
                  onChange={(e) => setGroupSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {filteredStyleGroups.length} group{filteredStyleGroups.length !== 1 ? 's' : ''}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group Name</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Styles</TableHead>
                    <TableHead className="w-32">Sort Order</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStyleGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No style groups found. Add your first group to organize styles.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStyleGroups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell>
                          {group.image_url ? (
                            <img src={group.image_url} alt={group.name} className="w-12 h-12 object-cover rounded" />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                              No image
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {group.styles?.length || 0} style{group.styles?.length !== 1 ? 's' : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm bg-muted px-2 py-1 rounded">
                            {group.sort_order}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditGroup(group)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteGroup(group)}
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
          </CardContent>
        </Card>

        {/* Individual Styles Section */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-light">Individual Styles</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage individual garment styles</p>
              </div>
              <Button
                onClick={handleNew}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Style
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search styles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {filteredStyles.length} style{filteredStyles.length !== 1 ? 's' : ''}
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
                      <TableHead>Style Name</TableHead>
                      <TableHead className="w-32">Garments</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStyles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          No styles found. Add your first style to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStyles.map((style) => (
                        <TableRow key={style.name}>
                          <TableCell className="font-medium">{style.name}</TableCell>
                          <TableCell>
                            <span className="text-sm bg-muted px-2 py-1 rounded">
                              {style.count} garment{style.count !== 1 ? 's' : ''}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditPlacements(style)}
                              >
                                Placements
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(style)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(style)}
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
              <DialogTitle>{editingStyle?.originalName ? 'Edit Style' : 'Add New Style'}</DialogTitle>
              {editingStyle?.originalName && (
                <DialogDescription>
                  This will update all {editingStyle.garmentIds.length} garment(s) using this style.
                </DialogDescription>
              )}
            </DialogHeader>
            {editingStyle && (
              <div className="space-y-4">
                <div>
                  <Label>Style Name</Label>
                  <Input
                    value={editingStyle.newName}
                    onChange={(e) => setEditingStyle({...editingStyle, newName: e.target.value})}
                    placeholder="e.g., T-Shirt, Hoodie, Tank Top"
                  />
                </div>
                <Button
                  onClick={handleSave}
                  disabled={!editingStyle.newName.trim()}
                  className="w-full disabled:opacity-50"
                >
                  {editingStyle.originalName ? 'Save Changes' : 'Add Style'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Style Group Dialog */}
        <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingStyleGroup?.id ? 'Edit Style Group' : 'Add New Style Group'}</DialogTitle>
              <DialogDescription>
                Group multiple styles together for easier browsing
              </DialogDescription>
            </DialogHeader>
            {editingStyleGroup && (
              <div className="space-y-4">
                <div>
                  <Label>Group Name</Label>
                  <Input
                    value={editingStyleGroup.name}
                    onChange={(e) => setEditingStyleGroup({...editingStyleGroup, name: e.target.value})}
                    placeholder="e.g., Tops, Bottoms, Outerwear"
                  />
                </div>
                
                <div>
                  <Label>Group Image</Label>
                  <div className="mt-2">
                    {(selectedImage || editingStyleGroup.image_url) && (
                      <img 
                        src={selectedImage || editingStyleGroup.image_url} 
                        alt="Preview" 
                        className="w-32 h-32 object-cover rounded mb-2"
                      />
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                    />
                  </div>
                </div>

                <div>
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    value={editingStyleGroup.sort_order}
                    onChange={(e) => setEditingStyleGroup({...editingStyleGroup, sort_order: parseInt(e.target.value) || 0})}
                  />
                </div>

                <div>
                  <Label>Select Styles for this Group</Label>
                  <div className="mt-2 border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                    {styles.map(style => (
                      <div key={style.name} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`style-${style.name}`}
                          checked={(editingStyleGroup.styles || []).includes(style.name)}
                          onChange={() => toggleStyleInGroup(style.name)}
                          className="w-4 h-4"
                        />
                        <label htmlFor={`style-${style.name}`} className="flex-1 cursor-pointer">
                          {style.name} ({style.count} garment{style.count !== 1 ? 's' : ''})
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {(editingStyleGroup.styles || []).length} style{(editingStyleGroup.styles || []).length !== 1 ? 's' : ''} selected
                  </p>
                </div>

                <Button
                  onClick={handleSaveGroup}
                  disabled={!editingStyleGroup.name.trim() || !editingStyleGroup.styles?.length}
                  className="w-full disabled:opacity-50"
                >
                  {editingStyleGroup.id ? 'Save Changes' : 'Create Group'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Placement Configuration Dialog */}
        <Dialog open={showPlacementDialog} onOpenChange={setShowPlacementDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Configure Placements for {editingStyleConfig?.style_name}
              </DialogTitle>
              <DialogDescription>
                Select which placement options are available for each print size
              </DialogDescription>
            </DialogHeader>
            {editingStyleConfig && (
              <div className="space-y-6">
                {['adult', 'sleeve', 'crest', 'baby', 'jr', 'kid', 'leg', 'oversize', 'patch'].map(printSize => (
                  <div key={printSize} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3 capitalize">{printSize} Size Prints</h3>
                    <div className="space-y-3">
                      {placements.map(placement => {
                        const placementConfig = (editingStyleConfig[`${printSize}_placements`] || []).find(p => p.name === placement.name);
                        const isChecked = !!placementConfig;
                        
                        return (
                          <div key={placement.id} className="border rounded p-3 bg-muted/30">
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="checkbox"
                                id={`${printSize}-${placement.name}`}
                                checked={isChecked}
                                onChange={() => togglePlacement(printSize, placement.name)}
                                className="w-4 h-4"
                              />
                              <label htmlFor={`${printSize}-${placement.name}`} className="cursor-pointer font-medium">
                                {placement.display_name}
                              </label>
                            </div>
                            
                            {isChecked && (
                              <div className="ml-6 space-y-2">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Print Area</Label>
                                  <select
                                    value={placementConfig.print_area || 'front:print-area'}
                                    onChange={(e) => updatePlacementArea(printSize, placement.name, e.target.value)}
                                    className="w-full h-8 text-sm font-medium border rounded-md px-2 bg-background"
                                  >
                                    {(availablePrintAreas || []).map(area => (
                                      <option key={area?.value} value={area?.value}>
                                        {area?.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">X Position (%)</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={placementConfig.x ?? 50}
                                      onChange={(e) => updatePlacementCoords(printSize, placement.name, 'x', e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Y Position (%)</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={placementConfig.y ?? 50}
                                      onChange={(e) => updatePlacementCoords(printSize, placement.name, 'y', e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {(editingStyleConfig[`${printSize}_placements`] || []).length} placement{(editingStyleConfig[`${printSize}_placements`] || []).length !== 1 ? 's' : ''} configured
                    </p>
                  </div>
                ))}

                <Button
                  onClick={handleSavePlacements}
                  className="w-full"
                >
                  Save Placement Configuration
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}