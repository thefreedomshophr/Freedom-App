import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { filterGarmentsByLocation } from "../components/GarmentFilter";
import { filterGarmentsByPrintCompatibility } from "../components/PrintCompatibility";

export default function SizeSelection() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const color = urlParams.get('color');
  const style = urlParams.get('style');
  const flow = urlParams.get('flow');

  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStartOverDialog, setShowStartOverDialog] = useState(false);
  const [showPrintFitDialog, setShowPrintFitDialog] = useState(false);
  const [invalidPrints, setInvalidPrints] = useState([]);
  const [selectedSize, setSelectedSize] = useState(null);

  useEffect(() => {
    loadSizes();
  }, [color, style]);

  const loadSizes = async () => {
    try {
      // For style flow, only style is required
      if (flow === 'style' && !style) {
        setLoading(false);
        return;
      }
      
      // For other flows, both color and style are required
      if (flow !== 'style' && (!color || !style)) {
        setLoading(false);
        return;
      }

      const decodedStyle = decodeURIComponent(style);
      let garments = await base44.entities.Garment.list();

      // Filter by location availability
      garments = filterGarmentsByLocation(garments);

      // Filter by print compatibility (for print flow)
      if (flow === 'print') {
        garments = filterGarmentsByPrintCompatibility(garments);
      }
      
      // Filter by style
      garments = garments.filter(g => g.style?.toLowerCase() === decodedStyle.toLowerCase());
      
      // Filter by color if provided (not in initial style flow)
      if (color) {
        const decodedColor = decodeURIComponent(color);
        garments = garments.filter(g => g.color?.toLowerCase() === decodedColor.toLowerCase());
      }

      const sizeNames = [...new Set(garments.map(g => g.size))];

      // Determine garment category
      const styleLower = decodedStyle.toLowerCase();
      const isToddler = styleLower.includes('toddler');
      const isYouth = styleLower.includes('youth');
      const isTall = styleLower.includes('tall');

      // Define size orders
      const toddlerSizeOrder = ['2T', '3T', '4T'];
      const youthSizeOrder = ['YXS', 'YS', 'YM', 'YL', 'YXL'];
      const tallSizeOrder = ['LT', 'XLT', '2XT', '3XT'];
      const adultSizeOrder = ['S', 'M', 'L', 'XL', '2X', '3X', '4X', '5X', '6X'];

      const sizeOrder = isToddler ? toddlerSizeOrder : (isYouth ? youthSizeOrder : (isTall ? tallSizeOrder : adultSizeOrder));
      const orderedSizes = sizeNames.sort((a, b) => {
        const indexA = sizeOrder.indexOf(a);
        const indexB = sizeOrder.indexOf(b);
        return indexA - indexB;
      });

      setSizes(orderedSizes);
    } catch (error) {
      console.error('Error loading sizes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSizeSelect = async (size) => {
    const params = new URLSearchParams(window.location.search);
    params.set('size', size);
    
    // If flow is 'style', go to color selection next
    if (flow === 'style') {
      navigate(createPageUrl(`ColorSelection?${params.toString()}`));
      return;
    }
    
    // For print flow, validate that selected prints fit on the garment
    if (flow === 'print') {
      const storedPrints = localStorage.getItem('selectedPrints');
      if (storedPrints) {
        const selectedPrints = JSON.parse(storedPrints);
        
        // Get the specific garment
        const decodedColor = decodeURIComponent(color);
        const decodedStyle = decodeURIComponent(style);
        
        let garments = await base44.entities.Garment.list();
        garments = filterGarmentsByLocation(garments);
        
        const garment = garments.find(g => 
          g.color?.toLowerCase() === decodedColor.toLowerCase() &&
          g.style?.toLowerCase() === decodedStyle.toLowerCase() &&
          g.size?.toUpperCase() === size.toUpperCase()
        );
        
        if (garment && selectedPrints.length > 0) {
          // Check if any print doesn't fit
          const invalidPrints = selectedPrints.filter(printWithPlacement => {
            if (!printWithPlacement.width || !printWithPlacement.height) return false;
            
            const placement = printWithPlacement.placement;
            let maxWidth, maxHeight;
            
            // Determine max dimensions based on placement
            if (placement === 'Front Center' || placement === 'Front Left Chest' || placement === 'Front Left Crest') {
              maxWidth = garment.front_max_print_width;
              maxHeight = garment.front_max_print_height;
            } else if (placement === 'Back Center') {
              maxWidth = garment.back_max_print_width;
              maxHeight = garment.back_max_print_height;
            } else if (placement === 'Right Sleeve' || placement === 'Left Sleeve') {
              maxWidth = garment.rsleeve_max_print_width;
              maxHeight = garment.rsleeve_max_print_height;
            } else if (placement === 'standard') {
              maxWidth = garment.front_max_print_width;
              maxHeight = garment.front_max_print_height;
            } else {
              return false;
            }
            
            if (!maxWidth || !maxHeight) return false;
            
            return printWithPlacement.width > maxWidth || printWithPlacement.height > maxHeight;
          });
          
          if (invalidPrints.length > 0) {
            // Show error dialog and save the selected size
            setInvalidPrints(invalidPrints);
            setSelectedSize(size);
            setShowPrintFitDialog(true);
            return;
          }
        }
      }
      
      // For print flow, go back to PrintCatalog to keep adding prints
      const decodedStyle = style ? decodeURIComponent(style) : '';
      const isBottoms = decodedStyle.toLowerCase().includes('sweatpants');
      const garmentType = isBottoms ? 'bottoms' : 'tops';
      params.set('garment_type', garmentType);
      
      navigate(createPageUrl(`PrintCatalog?${params.toString()}`));
    } else {
      // For color/style flows, determine garment type and go to PrintCatalog
      const decodedStyle = style ? decodeURIComponent(style) : '';
      const isBottoms = decodedStyle.toLowerCase().includes('sweatpants');
      const garmentType = isBottoms ? 'bottoms' : 'tops';
      params.set('garment_type', garmentType);
      navigate(createPageUrl(`PrintCatalog?${params.toString()}`));
    }
  };

  const handleBack = () => {
    const params = new URLSearchParams(window.location.search);
    const styleGroup = params.get('styleGroup');
    
    if (flow === 'style' && style) {
      // Go back to style selection
      const navParams = new URLSearchParams();
      navParams.set('flow', 'style');
      if (styleGroup) navParams.set('styleGroup', styleGroup);
      navigate(createPageUrl(`StyleSelection?${navParams.toString()}`));
    } else if (flow === 'color' && color && style) {
      navigate(createPageUrl(`StyleSelection?flow=color&color=${encodeURIComponent(color)}`));
    } else if (flow === 'print' && color && style) {
      navigate(createPageUrl(`StyleSelection?flow=print&color=${encodeURIComponent(color)}`));
    } else {
      navigate(createPageUrl("Home"));
    }
  };

  const handleStartOver = () => {
    setShowStartOverDialog(true);
  };

  const confirmStartOver = () => {
    localStorage.removeItem('selectedPrints');
    localStorage.removeItem('editingBuildIndex');
    localStorage.removeItem('pendingBuild');
    setShowStartOverDialog(false);
    navigate(createPageUrl("Home"));
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-2xl text-muted-foreground">Loading sizes...</div>
      </div>
    );
  }

  if (!style || (flow !== 'style' && !color)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-muted-foreground mb-4">
            {flow === 'style' ? 'Please select a style first.' : 'Please select a color and style first.'}
          </p>
          <Button onClick={() => navigate(createPageUrl("Home"))}>
            Go Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
            <div className="text-center md:text-left">
              <h1 className="text-4xl md:text-5xl font-light text-foreground mb-2">
                Choose Your Size
              </h1>
              <p className="text-muted-foreground font-light">
                {decodeURIComponent(style)}{color ? ` in ${decodeURIComponent(color)}` : ''}
              </p>
            </div>
            
            <div className="flex gap-3 justify-center md:justify-start">
              <Button
                variant="outline"
                onClick={handleStartOver}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </Button>
              <Button
                variant="outline"
                onClick={handleBack}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </div>
          </div>
        </motion.div>

        {sizes.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-muted-foreground">No sizes available for this combination.</p>
          </div>
        ) : (
          <div className="flex justify-center flex-wrap gap-6">
            {sizes.map((size, index) => (
              <motion.button
                key={size}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSizeSelect(size)}
                className="w-32 h-32 rounded-2xl bg-card border-2 border-border hover:border-muted-foreground hover:bg-accent flex items-center justify-center text-4xl font-light text-foreground transition-all duration-300 shadow-lg hover:shadow-2xl"
              >
                {size}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showStartOverDialog} onOpenChange={setShowStartOverDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              Starting over will clear all your current selections and take you back to the home page.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={() => setShowStartOverDialog(false)}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmStartOver}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Start Over
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPrintFitDialog} onOpenChange={setShowPrintFitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prints Won't Fit</DialogTitle>
            <DialogDescription>
              The following prints are too large for this garment size:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {invalidPrints.map((print, index) => (
              <div key={index} className="bg-muted p-3 rounded-lg">
                <p className="text-foreground font-medium">{print.name}</p>
                <p className="text-sm text-muted-foreground">
                  Size: {print.width}" × {print.height}" on {print.placement}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Please select a larger garment or remove these prints.
          </p>
          <div className="flex flex-col gap-3 mt-4">
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowPrintFitDialog(false);
                  // Clear selected prints and navigate back to PrintCatalog with current garment selected
                  localStorage.removeItem('selectedPrints');
                  const params = new URLSearchParams(window.location.search);
                  // Add the size that was just selected
                  if (selectedSize) {
                    params.set('size', selectedSize);
                  }
                  const decodedStyle = style ? decodeURIComponent(style) : '';
                  const isBottoms = decodedStyle.toLowerCase().includes('sweatpants');
                  const garmentType = isBottoms ? 'bottoms' : 'tops';
                  params.set('garment_type', garmentType);
                  navigate(createPageUrl(`PrintCatalog?${params.toString()}`));
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Change Prints
              </Button>
              <Button
                onClick={() => {
                  setShowPrintFitDialog(false);
                  // Navigate back to GarmentChoiceSelection to select new garment
                  const params = new URLSearchParams();
                  params.set('flow', 'print');
                  const decodedStyle = style ? decodeURIComponent(style) : '';
                  const isBottoms = decodedStyle.toLowerCase().includes('sweatpants');
                  const garmentType = isBottoms ? 'bottoms' : 'tops';
                  params.set('garment_type', garmentType);
                  navigate(createPageUrl(`GarmentChoiceSelection?${params.toString()}`));
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                Change Garment
              </Button>
            </div>
            <Button
              onClick={() => {
                setShowPrintFitDialog(false);
                // Keep everything and navigate to PrintCatalog
                const params = new URLSearchParams(window.location.search);
                if (selectedSize) {
                  params.set('size', selectedSize);
                }
                const decodedStyle = style ? decodeURIComponent(style) : '';
                const isBottoms = decodedStyle.toLowerCase().includes('sweatpants');
                const garmentType = isBottoms ? 'bottoms' : 'tops';
                params.set('garment_type', garmentType);
                navigate(createPageUrl(`PrintCatalog?${params.toString()}`));
              }}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            >
              Override
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}