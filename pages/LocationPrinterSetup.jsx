import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Check, Loader, Printer } from "lucide-react";

export default function LocationPrinterSetup() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  const [credentialsForm, setCredentialsForm] = useState({
    apiKey: localStorage.getItem("stario_api_key") || "",
    deviceGroupPath: localStorage.getItem("stario_device_group_path") || "",
    region: localStorage.getItem("stario_region") || "us",
  });

  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const locationsList = await base44.entities.Location.list();
      setLocations(locationsList);
    } catch (error) {
      console.error("Error loading locations:", error);
    }
    setLoading(false);
  };

  const handleCredentialsChange = (field, value) => {
    setCredentialsForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveCredentialsLocally = () => {
    localStorage.setItem("stario_api_key", credentialsForm.apiKey);
    localStorage.setItem("stario_device_group_path", credentialsForm.deviceGroupPath);
    localStorage.setItem("stario_region", credentialsForm.region);
  };

  const fetchDevices = async () => {
    setLoadingDevices(true);
    setDeviceError("");
    setDevices([]);

    try {
      // Call backend function with user-provided credentials
      const response = await base44.functions.invoke("starIOGetDevices", {
        apiKey: credentialsForm.apiKey,
        deviceGroupPath: credentialsForm.deviceGroupPath,
        region: credentialsForm.region,
      });

      if (response.data.error) {
        setDeviceError(response.data.error);
        return;
      }

      setDevices(response.data.devices || []);
      saveCredentialsLocally();
    } catch (error) {
      setDeviceError(error.message || "Failed to fetch devices");
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleAssignDevice = async () => {
    if (!selectedLocationId || !selectedDevice) {
      return;
    }

    try {
      const device = devices.find((d) => d.accessIdentifier === selectedDevice);
      await base44.entities.Location.update(selectedLocationId, {
        stario_device_id: device.accessIdentifier,
        stario_device_name: device.name,
      });

      await loadLocations();
      setSelectedLocationId("");
      setSelectedDevice("");
    } catch (error) {
      console.error("Error assigning device:", error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Printer className="w-10 h-10 text-muted-foreground" />
            Printer Setup by Location
          </h1>
          <Button
            onClick={() => setShowDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Configure StarIO Credentials
          </Button>
        </div>

        <div className="grid gap-4">
          {locations.map((location) => (
            <Card key={location.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{location.name}</CardTitle>
                {location.stario_device_id && (
                  <div className="flex items-center gap-2 text-green-500">
                    <Check className="w-5 h-5" />
                    <span className="text-sm">{location.stario_device_name}</span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {location.stario_device_id ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Device ID</p>
                      <p className="font-mono text-sm">
                        {location.stario_device_id}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedLocationId(location.id);
                        setShowDialog(true);
                      }}
                    >
                      Change Device
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      setSelectedLocationId(location.id);
                      setShowDialog(true);
                    }}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    Select Printer
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Credentials & Device Selection Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure StarIO Printer Setup</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Credentials Form */}
            <div className="space-y-3">
              <h3 className="font-semibold">StarIO Credentials</h3>

              <div>
                <label className="text-sm text-muted-foreground block mb-1">API Key</label>
                <Input
                  type="password"
                  value={credentialsForm.apiKey}
                  onChange={(e) => handleCredentialsChange("apiKey", e.target.value)}
                  placeholder="Your StarIO API Key"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  Device Group Path
                </label>
                <Input
                  value={credentialsForm.deviceGroupPath}
                  onChange={(e) =>
                    handleCredentialsChange("deviceGroupPath", e.target.value)
                  }
                  placeholder="e.g., account/group-name"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-1">Region</label>
                <Select
                  value={credentialsForm.region}
                  onValueChange={(value) =>
                    handleCredentialsChange("region", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us">US</SelectItem>
                    <SelectItem value="eu">EU</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={fetchDevices}
                disabled={
                  loadingDevices ||
                  !credentialsForm.apiKey ||
                  !credentialsForm.deviceGroupPath
                }
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {loadingDevices ? (
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Fetch Available Devices
              </Button>

              {deviceError && (
                <div className="bg-red-500/10 border border-red-500 rounded p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-500 text-sm">{deviceError}</p>
                </div>
              )}
            </div>

            {/* Device Selection */}
            {devices.length > 0 && selectedLocationId && (
              <div className="space-y-3 border-t pt-4">
                <h3 className="font-semibold">Select Device</h3>
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a printer device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem
                        key={device.accessIdentifier}
                        value={device.accessIdentifier}
                      >
                        {device.online ? "🟢" : "🔴"} {device.accessIdentifier} - {device.name} ({device.model})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                setSelectedLocationId("");
                setSelectedDevice("");
              }}
            >
              Cancel
            </Button>
            {selectedLocationId && selectedDevice && (
              <Button
                onClick={handleAssignDevice}
                className="bg-green-600 hover:bg-green-700"
              >
                Assign Printer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}