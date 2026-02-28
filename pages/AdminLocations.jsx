import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Pencil, Trash2, MapPin, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminLocations() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [formData, setFormData] = useState({ name: '' });
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState(null);
  const [user, setUser] = useState(null);
  const [lightspeedShops, setLightspeedShops] = useState([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [lightspeedRegisters, setLightspeedRegisters] = useState([]);
  const [loadingRegisters, setLoadingRegisters] = useState(false);

  useEffect(() => {
    checkAdminAndLoadData();
    loadLightspeedShops();
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser.role !== 'admin') {
        navigate(createPageUrl("AdminDashboard"));
        return;
      }
      setUser(currentUser);
      await loadLocations();
    } catch (error) {
      console.error('Error checking admin:', error);
      navigate(createPageUrl("AdminDashboard"));
    }
  };

  const loadLocations = async () => {
    try {
      const data = await base44.entities.Location.list();
      setLocations(data);
    } catch (error) {
      console.error('Error loading locations:', error);
    }
    setLoading(false);
  };

  const loadLightspeedShops = async () => {
    setLoadingShops(true);
    try {
      // Get first location with credentials to load shops
      const locations = await base44.entities.Location.list();
      const locWithCreds = locations.find(l => l.lightspeed_client_id && l.lightspeed_client_secret);
      
      if (!locWithCreds) {
        setLoadingShops(false);
        return;
      }

      const response = await base44.functions.invoke('lightspeedGetShops', { locationId: locWithCreds.id });
      if (response.data.success) {
        setLightspeedShops(response.data.shops);
      }
    } catch (error) {
      console.error('Error loading Lightspeed shops:', error);
    }
    setLoadingShops(false);
  };

  const loadLightspeedRegisters = async (shopID, locationId) => {
    if (!shopID) {
      setLightspeedRegisters([]);
      return;
    }
    
    setLoadingRegisters(true);
    try {
      const response = await base44.functions.invoke('lightspeedGetRegisters', { shopID, locationId });
      if (response.data.success) {
        setLightspeedRegisters(response.data.registers);
      }
    } catch (error) {
      console.error('Error loading Lightspeed registers:', error);
    }
    setLoadingRegisters(false);
  };

  const handleAdd = () => {
    setEditingLocation(null);
    setFormData({ name: '', shopID: '', registerID: '' });
    setLightspeedRegisters([]);
    setShowDialog(true);
  };

  const handleEdit = (location) => {
    setEditingLocation(location);
    setFormData({ 
      name: location.name, 
      shopID: location.shopID || '', 
      registerID: location.registerID || ''
    });
    if (location.shopID) {
      loadLightspeedRegisters(location.shopID, location.id);
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a location name');
      return;
    }

    setSaving(true);
    try {
      if (editingLocation) {
        await base44.entities.Location.update(editingLocation.id, formData);
      } else {
        await base44.entities.Location.create(formData);
      }
      await loadLocations();
      setShowDialog(false);
      setFormData({ name: '' });
      setEditingLocation(null);
    } catch (error) {
      console.error('Error saving location:', error);
      alert('Failed to save location');
    }
    setSaving(false);
  };

  const handleDeleteClick = (location) => {
    setLocationToDelete(location);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!locationToDelete) return;
    
    try {
      await base44.entities.Location.delete(locationToDelete.id);
      await loadLocations();
      setShowDeleteDialog(false);
      setLocationToDelete(null);
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('Failed to delete location');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("AdminDashboard"))}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <div className="flex justify-between items-center mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-4xl md:text-5xl font-light mb-2">
              Manage Locations
            </h1>
            <p className="text-muted-foreground font-light">
              Add and manage store locations
            </p>
          </motion.div>

          <Button
            onClick={handleAdd}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Location
          </Button>
        </div>

        {locations.length === 0 ? (
          <Card className="border-0 shadow-lg p-12 text-center rounded-2xl">
            <MapPin className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-light mb-2">No locations yet</h3>
            <p className="text-muted-foreground mb-6">Add your first location to get started</p>
            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {locations.map((location, index) => (
              <motion.div
                key={location.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-600/20 dark:bg-blue-900 rounded-xl flex items-center justify-center">
                          <MapPin className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div>
                          <h3 className="text-xl font-light">
                            {location.name}
                          </h3>
                          {location.shopID && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Shop ID: {location.shopID}
                            </p>
                          )}
                          {location.registerID && (
                            <p className="text-sm text-muted-foreground">
                              Register ID: {location.registerID}
                            </p>
                          )}
                          {location.lightspeed_client_id && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                              ✓ API Configured
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Link to={`${createPageUrl("AdminLocationApiSetup")}?locationId=${location.id}`} className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                        >
                          <Settings className="w-4 h-4" />
                          API Setup
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(location)}
                        className="flex-1 gap-2"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(location)}
                        className="flex-1 gap-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingLocation ? 'Edit Location' : 'Add New Location'}
              </DialogTitle>
              <DialogDescription>
                Enter the location name
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="locationName">Location Name *</Label>
                <Input
                  id="locationName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Freedom, Sharkys"
                />
              </div>
              <div>
                <Label htmlFor="shopID">Lightspeed Shop</Label>
                <Select
                  value={formData.shopID}
                  onValueChange={(value) => {
                    setFormData({ ...formData, shopID: value, registerID: '' });
                    loadLightspeedRegisters(value, editingLocation?.id);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingShops ? "Loading shops..." : "Select a shop"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {lightspeedShops.map((shop) => (
                      <SelectItem key={shop.shopID} value={shop.shopID}>
                        {shop.name} (ID: {shop.shopID})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="registerID">Lightspeed Register</Label>
                <Select
                  value={formData.registerID}
                  onValueChange={(value) => setFormData({ ...formData, registerID: value })}
                  disabled={!formData.shopID || loadingRegisters}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingRegisters ? "Loading registers..." : "Select a register"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {lightspeedRegisters.map((register) => (
                      <SelectItem key={register.registerID} value={register.registerID}>
                        {register.name} (ID: {register.registerID})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setShowDialog(false)}
                  variant="outline"
                  className="flex-1"
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : (editingLocation ? 'Update' : 'Add Location')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Location?</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{locationToDelete?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
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