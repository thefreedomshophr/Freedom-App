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
import { Textarea } from "@/components/ui/textarea";

export default function AdminPlacements() {
  const [placements, setPlacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlacement, setEditingPlacement] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasPermission, setHasPermission] = useState(false);

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
        loadPlacements();
      } else {
        navigate(createPageUrl("AdminDashboard"));
      }
    } catch (error) {
      console.error("Permission check failed:", error);
      base44.auth.redirectToLogin(window.location.href);
    }
  };

  const loadPlacements = async () => {
    try {
      const data = await base44.entities.Placement.list();
      setPlacements(data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    } catch (error) {
      console.error("Failed to load placements:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (placement) => {
    setEditingPlacement({ ...placement });
    setShowDialog(true);
  };

  const handleNew = () => {
    setEditingPlacement({ 
      name: "", 
      display_name: "", 
      description: "",
      sort_order: placements.length
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      if (editingPlacement.id) {
        await base44.entities.Placement.update(editingPlacement.id, editingPlacement);
      } else {
        await base44.entities.Placement.create(editingPlacement);
      }
      setShowDialog(false);
      setEditingPlacement(null);
      loadPlacements();
    } catch (error) {
      console.error("Failed to save placement:", error);
      alert("Failed to save placement. Please try again.");
    }
  };

  const handleDelete = async (placement) => {
    if (!confirm(`Delete placement "${placement.display_name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await base44.entities.Placement.delete(placement.id);
      loadPlacements();
    } catch (error) {
      console.error("Failed to delete placement:", error);
      alert("Failed to delete placement. Please try again.");
    }
  };

  const filteredPlacements = placements.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
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
            <h1 className="text-4xl font-light mb-2">Placement Options</h1>
            <p className="text-muted-foreground font-light">Manage available placement options for prints</p>
          </div>
          <Button
            onClick={handleNew}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Placement
          </Button>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search placements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {filteredPlacements.length} placement{filteredPlacements.length !== 1 ? 's' : ''}
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
                      <TableHead>Display Name</TableHead>
                      <TableHead>Internal Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-32">Sort Order</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlacements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No placements found. Add your first placement option to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPlacements.map((placement) => (
                        <TableRow key={placement.id}>
                          <TableCell className="font-medium">{placement.display_name}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-sm">{placement.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{placement.description || '-'}</TableCell>
                          <TableCell>
                            <span className="text-sm bg-muted px-2 py-1 rounded">
                              {placement.sort_order}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(placement)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(placement)}
                                className="text-red-500"
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPlacement?.id ? 'Edit Placement' : 'Add New Placement'}</DialogTitle>
              <DialogDescription>
                Configure a placement option for prints on garments
              </DialogDescription>
            </DialogHeader>
            {editingPlacement && (
              <div className="space-y-4">
                <div>
                  <Label>Display Name</Label>
                  <Input
                    value={editingPlacement.display_name}
                    onChange={(e) => setEditingPlacement({...editingPlacement, display_name: e.target.value})}
                    placeholder="e.g., Front Center, Back Center"
                  />
                </div>
                <div>
                  <Label>Internal Name</Label>
                  <Input
                    value={editingPlacement.name}
                    onChange={(e) => setEditingPlacement({...editingPlacement, name: e.target.value})}
                    placeholder="e.g., front_center, back_center"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Use lowercase with underscores (no spaces)</p>
                </div>
                <div>
                  <Label>Description (Optional)</Label>
                  <Textarea
                    value={editingPlacement.description || ''}
                    onChange={(e) => setEditingPlacement({...editingPlacement, description: e.target.value})}
                    placeholder="Brief description of this placement..."
                  />
                </div>
                <div>
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    value={editingPlacement.sort_order}
                    onChange={(e) => setEditingPlacement({...editingPlacement, sort_order: parseInt(e.target.value) || 0})}
                  />
                </div>
                <Button
                  onClick={handleSave}
                  disabled={!editingPlacement.name.trim() || !editingPlacement.display_name.trim()}
                  className="w-full disabled:opacity-50"
                >
                  {editingPlacement.id ? 'Save Changes' : 'Add Placement'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}