import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Play, Scan } from "lucide-react";

export default function AdminFunctionTest() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState("");
  const [payload, setPayload] = useState("{}");
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);

  // List of available functions (you can expand this)
  const functions = [
    "createPosCustomer",
    "syncPosCustomers",
    "lightspeedSearchCustomer",
    "lightspeedUpdateCustomer",
    "lightspeedSearchItem",
    "lightspeedGetItemDetails",
    "lightspeedCreateSale",
    "lightspeedUpdateSale",
    "lightspeedCheckInventory",
    "lightspeedCheckSaleStatus",
    "lightspeedGetToken",
    "starIOPrint",
    "getDefaultCustomer"
  ];

  useEffect(() => {
    checkAccess();
    loadSelectedLocation();
  }, []);

  const loadSelectedLocation = () => {
    const stored = localStorage.getItem('selectedLocation');
    if (stored) {
      try {
        setSelectedLocation(JSON.parse(stored));
      } catch (error) {
        setSelectedLocation(null);
      }
    }
  };

  const checkAccess = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        navigate(createPageUrl("Home"));
        return;
      }

      const user = await base44.auth.me();
      if (user.role !== 'admin') {
        navigate(createPageUrl("Home"));
        return;
      }
    } catch (error) {
      console.error('Error checking access:', error);
      navigate(createPageUrl("Home"));
    }
    setLoading(false);
  };

  const handleTest = async () => {
    if (!selectedFunction) {
      setError("Please select a function");
      return;
    }

    setTesting(true);
    setError(null);
    setResponse(null);

    try {
      const parsedPayload = JSON.parse(payload);
      const result = await base44.functions.invoke(selectedFunction, parsedPayload);
      setResponse(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleBarcodeScan = async () => {
    if (!barcodeInput.trim()) {
      setError("Please enter a barcode");
      return;
    }

    if (!selectedLocation) {
      setError("No location selected");
      return;
    }

    setShowBarcodeDialog(false);
    setSelectedFunction("lightspeedGetItemDetails");
    const newPayload = JSON.stringify({
      barcode: barcodeInput.trim(),
      locationId: selectedLocation.id
    }, null, 2);
    setPayload(newPayload);
    setBarcodeInput("");

    // Auto-run the test
    setTesting(true);
    setError(null);
    setResponse(null);

    try {
      const result = await base44.functions.invoke("lightspeedGetItemDetails", {
        barcode: barcodeInput.trim(),
        locationId: selectedLocation.id
      });
      setResponse(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
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
    <div className="min-h-[calc(100vh-4rem)] p-6">
      <div className="max-w-5xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("AdminDashboard"))}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Button>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-light">Function Test</h1>
          <Button
            onClick={() => setShowBarcodeDialog(true)}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Scan className="w-4 h-4" />
            Scan Barcode
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Function</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Function Name</Label>
              <Select value={selectedFunction} onValueChange={setSelectedFunction}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a function..." />
                </SelectTrigger>
                <SelectContent>
                  {functions.sort().map((fn) => (
                    <SelectItem key={fn} value={fn}>
                      {fn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Payload (JSON)</Label>
              <Textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                placeholder='{"param": "value"}'
                className="font-mono h-32"
              />
            </div>

            <Button
              onClick={handleTest}
              disabled={testing || !selectedFunction}
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Play className="w-4 h-4" />
              {testing ? "Testing..." : "Test Function"}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Card className="bg-red-500/10 border-red-500 mb-6">
            <CardHeader>
              <CardTitle className="text-red-500">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-red-500 text-sm overflow-auto">
                {error}
              </pre>
            </CardContent>
          </Card>
        )}

        {response && (
          <Card>
            <CardHeader>
              <CardTitle>Response</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm overflow-auto bg-muted p-4 rounded">
                {JSON.stringify(response, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Barcode Scanner Dialog */}
        <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Scan Barcode</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Input
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && barcodeInput.trim()) {
                    handleBarcodeScan();
                  }
                }}
                placeholder="Scan or enter barcode..."
                autoFocus
              />
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setBarcodeInput("");
                    setShowBarcodeDialog(false);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBarcodeScan}
                  disabled={!barcodeInput.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Search Item
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}