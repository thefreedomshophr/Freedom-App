import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AdminGarmentTest() {
  const navigate = useNavigate();
  const [garmentViews, setGarmentViews] = useState({
    front: null,
    back: null,
    lsleeve: null,
    rsleeve: null
  });
  const [prints, setPrints] = useState([]);
  const [selectedPrints, setSelectedPrints] = useState({
    front: null,
    back: null,
    lsleeve: null,
    rsleeve: null
  });
  const [showPrintSelector, setShowPrintSelector] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxDimensions, setMaxDimensions] = useState({
    front: { width: 12, height: 16 },
    back: { width: 12, height: 16 },
    lsleeve: { width: 3, height: 3 },
    rsleeve: { width: 3, height: 3 }
  });

  useEffect(() => {
    loadPrints();
  }, []);

  const loadPrints = async () => {
    try {
      const data = await base44.entities.Print.list();
      setPrints(data.filter(p => p.is_active !== false));
    } catch (error) {
      console.error('Error loading prints:', error);
    }
  };

  const handleFileUpload = async (view, file) => {
    if (!file) return;
    
    try {
      const response = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = response.file_url || response.data?.file_url;
      setGarmentViews(prev => ({
        ...prev,
        [view]: fileUrl
      }));
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file');
    }
  };

  const handlePrintSelect = (view, print) => {
    setSelectedPrints(prev => ({
      ...prev,
      [view]: print
    }));
    setShowPrintSelector(null);
  };

  const clearView = (view) => {
    setGarmentViews(prev => ({
      ...prev,
      [view]: null
    }));
    setSelectedPrints(prev => ({
      ...prev,
      [view]: null
    }));
  };

  const viewLabels = {
    front: 'Front',
    back: 'Back',
    lsleeve: 'Left Sleeve',
    rsleeve: 'Right Sleeve'
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate(createPageUrl("AdminDashboard"))}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-light">Garment Test Studio</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(viewLabels).map(([view, label]) => (
            <Card key={view}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{label}</CardTitle>
                  {garmentViews[view] && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => clearView(view)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload SVG */}
                <div>
                  <label className="text-muted-foreground text-sm mb-2 block">Upload SVG Garment</label>
                  <Input
                    type="file"
                    accept=".svg"
                    onChange={(e) => handleFileUpload(view, e.target.files[0])}
                  />
                </div>

                {/* Max Print Dimensions */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground text-xs mb-1 block">Max Width (in)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={maxDimensions[view].width}
                      onChange={(e) => setMaxDimensions(prev => ({
                        ...prev,
                        [view]: { ...prev[view], width: parseFloat(e.target.value) || 0 }
                      }))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground text-xs mb-1 block">Max Height (in)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={maxDimensions[view].height}
                      onChange={(e) => setMaxDimensions(prev => ({
                        ...prev,
                        [view]: { ...prev[view], height: parseFloat(e.target.value) || 0 }
                      }))}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Select Print */}
                {garmentViews[view] && (
                  <Button
                    onClick={() => setShowPrintSelector(view)}
                    variant="outline"
                    className="w-full"
                  >
                    {selectedPrints[view] ? `Change Print (${selectedPrints[view].name})` : 'Select Print'}
                  </Button>
                )}

                {/* Preview */}
                {garmentViews[view] && (
                  <div className="relative bg-muted rounded-lg p-4 min-h-[300px] flex items-center justify-center">
                    <GarmentPreview
                      svgUrl={garmentViews[view]}
                      print={selectedPrints[view]}
                      maxWidth={maxDimensions[view].width}
                      maxHeight={maxDimensions[view].height}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Print Selector Dialog */}
      <Dialog open={!!showPrintSelector} onOpenChange={() => { setShowPrintSelector(null); setSearchQuery(''); }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Print for {viewLabels[showPrintSelector]}</DialogTitle>
          </DialogHeader>
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Search prints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {prints.filter(print => 
              print.name.toLowerCase().includes(searchQuery.toLowerCase())
            ).map(print => (
              <div
                key={print.id}
                onClick={() => handlePrintSelect(showPrintSelector, print)}
                className="cursor-pointer group"
              >
                <div className="bg-muted rounded-lg p-3 hover:bg-muted/70 transition-colors">
                  <img
                    src={print.image_url}
                    alt={print.name}
                    className="w-full h-32 object-contain mb-2"
                  />
                  <p className="text-sm font-medium text-center">{print.name}</p>
                  <p className="text-muted-foreground text-xs text-center mt-1">
                    {print.width}" × {print.height}"
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GarmentPreview({ svgUrl, print, maxWidth, maxHeight }) {
  const [svgContent, setSvgContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [printOffset, setPrintOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = React.useRef(null);

  useEffect(() => {
    setPrintOffset({ x: 0, y: 0 });
  }, [print]);

  useEffect(() => {
    loadAndProcessSvg();
  }, [svgUrl, print, maxWidth, maxHeight, printOffset]);

  const loadAndProcessSvg = async () => {
    try {
      setLoading(true);
      const response = await fetch(svgUrl);
      let svg = await response.text();

      // Parse SVG
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');

      if (!svgElement) return;

      // Set viewBox if not present
      if (!svgElement.getAttribute('viewBox')) {
        const width = svgElement.getAttribute('width') || '500';
        const height = svgElement.getAttribute('height') || '500';
        svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }

      // If print is selected, add it
      if (print) {
        // Find print-area element or use center
        let printArea = svgElement.querySelector('#print-area, [id*="print"]');
        
        if (printArea) {
          // Hide the print area marker
          printArea.style.opacity = '0';
          printArea.style.visibility = 'hidden';
        }

        // Get SVG dimensions
        const viewBox = svgElement.getAttribute('viewBox').split(' ').map(Number);
        const svgWidth = viewBox[2];
        const svgHeight = viewBox[3];

        // Calculate pixels per inch based on print area if available
        const printAreaBBox = printArea?.getBBox?.() || null;
        let pixelsPerInch;
        if (printAreaBBox && printAreaBBox.width > 0 && maxWidth > 0) {
          pixelsPerInch = printAreaBBox.width / maxWidth;
        } else {
          // Fallback: assume center area for standard placement
          pixelsPerInch = (svgWidth * 0.6) / maxWidth;
        }

        // Use actual print dimensions, scale down if exceeds max
        let finalWidth = print.width;
        let finalHeight = print.height;

        if (finalWidth > maxWidth || finalHeight > maxHeight) {
          const printAspect = print.width / print.height;
          const maxAspect = maxWidth / maxHeight;

          if (printAspect > maxAspect) {
            finalWidth = maxWidth;
            finalHeight = maxWidth / printAspect;
          } else {
            finalHeight = maxHeight;
            finalWidth = maxHeight * printAspect;
          }
        }

        // Convert inches to SVG pixels
        const printPixelWidth = finalWidth * pixelsPerInch;
        const printPixelHeight = finalHeight * pixelsPerInch;

        // Position print (center in print area or SVG center)
        let x, y;
        if (printArea) {
          try {
            const bbox = printArea.getBBox();
            // Only use bbox if it has valid dimensions
            if (bbox && bbox.width > 0 && bbox.height > 0) {
              x = bbox.x + (bbox.width / 2) - (printPixelWidth / 2) + printOffset.x;
              y = bbox.y + (bbox.height / 2) - (printPixelHeight / 2) + printOffset.y;
            } else {
              // Fallback to SVG center
              x = (svgWidth / 2) - (printPixelWidth / 2) + printOffset.x;
              y = (svgHeight / 3) - (printPixelHeight / 2) + printOffset.y;
            }
          } catch (e) {
            // Fallback to SVG center
            x = (svgWidth / 2) - (printPixelWidth / 2) + printOffset.x;
            y = (svgHeight / 3) - (printPixelHeight / 2) + printOffset.y;
          }
        } else {
          x = (svgWidth / 2) - (printPixelWidth / 2) + printOffset.x;
          y = (svgHeight / 3) - (printPixelHeight / 2) + printOffset.y;
        }

        // Create image element
        const image = doc.createElementNS('http://www.w3.org/2000/svg', 'image');
        image.setAttribute('href', print.image_url);
        image.setAttribute('x', x);
        image.setAttribute('y', y);
        image.setAttribute('width', printPixelWidth);
        image.setAttribute('height', printPixelHeight);
        image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        image.setAttribute('id', 'draggable-print');
        image.style.cursor = 'move';

        svgElement.appendChild(image);
      }

      // Serialize back to string
      const serializer = new XMLSerializer();
      const modifiedSvg = serializer.serializeToString(svgElement);

      setSvgContent(modifiedSvg);
    } catch (error) {
      console.error('Error processing SVG:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMouseDown = (e) => {
    if (!print) return;
    const svg = containerRef.current?.querySelector('svg');
    const printImage = svg?.querySelector('#draggable-print');
    if (printImage && e.target === printImage) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setPrintOffset(prev => ({
      x: prev.x + dx,
      y: prev.y + dy
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full flex items-center justify-center"
      onMouseDown={handleMouseDown}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}