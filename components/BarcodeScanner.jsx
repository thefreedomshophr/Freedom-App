import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { X, Camera } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function BarcodeScanner({ isOpen, onClose, onScan }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    if (isOpen && !scanning) {
      // Wait for dialog to render before starting scanner
      setTimeout(() => {
        startScanner();
      }, 100);
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    try {
      setError(null);
      
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("barcode-reader");
      }

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.0,
        disableFlip: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      };

      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          onScan(decodedText.substring(0, 12));
          stopScanner();
          onClose();
        },
        (errorMessage) => {
          // Ignore scan errors, they happen constantly
        }
      );

      setScanning(true);
    } catch (err) {
      console.error("Error starting scanner:", err);
      setError(`Camera error: ${err.message || err}`);
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && scanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      setScanning(false);
    }
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-800 border-gray-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-gray-100 flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Scan Barcode
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div 
            id="barcode-reader" 
            className="w-full rounded-lg overflow-hidden"
            style={{ minHeight: '300px' }}
          ></div>

          {error && (
            <div className="bg-red-900/20 border border-red-500 rounded p-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <p className="text-sm text-gray-400 text-center">
            Position the barcode within the frame to scan
          </p>

          <Button
            onClick={handleClose}
            variant="outline"
            className="w-full border-gray-700 text-gray-300 hover:bg-gray-700"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}