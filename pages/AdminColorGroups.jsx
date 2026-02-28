import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, Image as ImageIcon, GripVertical } from "lucide-react";

export default function AdminColorGroups() {
  const [colorGroups, setColorGroups] = useState([]);
  const [colors, setColors] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({ name: '', colors: [], image_url: '', sort_order: 0 });
  const [selectedColors, setSelectedColors] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const groups = await base44.entities.ColorGroup.list('sort_order');
    const allColors = await base44.entities.Color.list();
    setColorGroups(groups);
    setColors(allColors);
  };

  const handleEdit = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      colors: group.colors || [],
      image_url: group.image_url || '',
      sort_order: group.sort_order || 0
    });
    setSelectedColors(group.colors || []);
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this color group?')) {
      await base44.entities.ColorGroup.delete(id);
      loadData();
    }
  };

  const handleSubmit = async () => {
    const data = { ...formData, colors: selectedColors };
    
    if (editingGroup) {
      await base44.entities.ColorGroup.update(editingGroup.id, data);
    } else {
      await base44.entities.ColorGroup.create(data);
    }
    
    setShowDialog(false);
    setEditingGroup(null);
    setFormData({ name: '', colors: [], image_url: '', sort_order: 0 });
    setSelectedColors([]);
    loadData();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, image_url: result.file_url });
    } catch (error) {
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const toggleColor = (colorName) => {
    if (selectedColors.includes(colorName)) {
      setSelectedColors(selectedColors.filter(c => c !== colorName));
    } else {
      setSelectedColors([...selectedColors, colorName]);
    }
  };

  const moveColorUp = (index) => {
    if (index === 0) return;
    const newColors = [...selectedColors];
    [newColors[index - 1], newColors[index]] = [newColors[index], newColors[index - 1]];
    setSelectedColors(newColors);
  };

  const moveColorDown = (index) => {
    if (index === selectedColors.length - 1) return;
    const newColors = [...selectedColors];
    [newColors[index], newColors[index + 1]] = [newColors[index + 1], newColors[index]];
    setSelectedColors(newColors);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-light">Color Groups</h1>
          <Button
            onClick={() => {
              setEditingGroup(null);
              setFormData({ name: '', colors: [], image_url: '', sort_order: 0 });
              setSelectedColors([]);
              setShowDialog(true);
            }}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Color Group
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {colorGroups.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{group.name}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(group)}
                      className="text-blue-500 hover:text-blue-600"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(group.id)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {group.image_url && (
                  <img
                    src={group.image_url}
                    alt={group.name}
                    className="w-full h-32 object-cover rounded-lg mb-4"
                  />
                )}
                <p className="text-sm text-muted-foreground">
                  {group.colors?.length || 0} colors
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {group.colors?.slice(0, 5).map((colorName, idx) => {
                    const color = colors.find(c => c.name === colorName);
                    return color ? (
                      <div key={idx} className="text-xs">
                        {color.name}
                      </div>
                    ) : null;
                  })}
                  {group.colors?.length > 5 && (
                    <span className="text-xs text-muted-foreground">+{group.colors.length - 5} more</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? 'Edit' : 'Add'} Color Group
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Group Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Blue, Red, Green"
                />
              </div>

              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label>Group Image</Label>
                <div className="flex gap-4 items-center">
                  {formData.image_url && (
                    <img src={formData.image_url} alt="Preview" className="w-20 h-20 object-cover rounded" />
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Select Colors</Label>
                <div className="grid grid-cols-3 gap-2 mt-2 max-h-64 overflow-y-auto p-2 bg-muted rounded">
                  {colors.map((color) => (
                    <div
                      key={color.id}
                      onClick={() => toggleColor(color.name)}
                      className={`cursor-pointer p-2 rounded flex items-center gap-2 ${
                        selectedColors.includes(color.name)
                          ? 'bg-blue-600'
                          : 'bg-card hover:bg-muted'
                      }`}
                    >
                      {color.image_url && (
                        <img src={color.image_url} alt={color.name} className="w-6 h-6 rounded" />
                      )}
                      <span className="text-sm">{color.name}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{selectedColors.length} colors selected</p>
              </div>

              {selectedColors.length > 0 && (
                <div>
                  <Label>Order Colors (Drag to Reorder)</Label>
                  <div className="space-y-2 mt-2 p-2 bg-muted rounded max-h-64 overflow-y-auto">
                    {selectedColors.map((colorName, index) => {
                      const color = colors.find(c => c.name === colorName);
                      return (
                        <div
                          key={colorName}
                          className="flex items-center gap-2 bg-card p-2 rounded"
                        >
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => moveColorUp(index)}
                              disabled={index === 0}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => moveColorDown(index)}
                              disabled={index === selectedColors.length - 1}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              ▼
                            </button>
                          </div>
                          {color?.image_url && (
                            <img src={color.image_url} alt={colorName} className="w-8 h-8 rounded" />
                          )}
                          <span className="text-sm flex-1">{colorName}</span>
                          <button
                            onClick={() => toggleColor(colorName)}
                            className="text-red-500 hover:text-red-600 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setShowDialog(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!formData.name || selectedColors.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {editingGroup ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}