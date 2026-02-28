import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Palette, Shirt, Ruler, Image as ImageIcon, ArrowLeft, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import SvgImage from "../components/SvgImage";
import SvgImageWithPrint from "../components/SvgImageWithPrint";
import { filterGarmentsByLocation } from "../components/GarmentFilter";

export default function Preview() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);

  const [selectedGarment, setSelectedGarment] = useState(null);
  const [selectedPrints, setSelectedPrints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [styleConfig, setStyleConfig] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [showAddMoreDialog, setShowAddMoreDialog] = useState(false);
  const [showColorDialog, setShowColorDialog] = useState(false);
  const [availableColors, setAvailableColors] = useState([]);
  const [showSizeDialog, setShowSizeDialog] = useState(false);
  const [availableSizes, setAvailableSizes] = useState([]);
  const [showStyleDialog, setShowStyleDialog] = useState(false);
  const [availableStyles, setAvailableStyles] = useState([]);
  const [showStartOverDialog, setShowStartOverDialog] = useState(false);
  const [styleDialogStep, setStyleDialogStep] = useState(1); // 1=style, 2=color, 3=size
  const [tempSelection, setTempSelection] = useState({ style: null, color: null, size: null });
  const [showWaxProtectionDialog, setShowWaxProtectionDialog] = useState(false);
  const [waxProtectionAction, setWaxProtectionAction] = useState(null);
  const [showFirstTimeWaxDialog, setShowFirstTimeWaxDialog] = useState(false);
  const [showDiscountedOptions, setShowDiscountedOptions] = useState(false);
  const [customWaxPrice, setCustomWaxPrice] = useState('');
  const [showPreprintDialog, setShowPreprintDialog] = useState(false);
  const [matchedPreprint, setMatchedPreprint] = useState(null);
  const [preprintInventory, setPreprintInventory] = useState(null);
  const [checkingInventory, setCheckingInventory] = useState(false);

  // New states for print change validation
  const [showPrintChangeDialog, setShowPrintChangeDialog] = useState(false);
  const [pendingChange, setPendingChange] = useState(null);
  const [previousSelection, setPreviousSelection] = useState(null);

  const color = urlParams.get('color');
  const style = urlParams.get('style');
  const size = urlParams.get('size');
  const flow = urlParams.get('flow');

  useEffect(() => {
    loadSelections();
    
    const editIndex = localStorage.getItem('editingBuildIndex');
    if (editIndex !== null) {
      setIsEditing(true);
      setEditingIndex(parseInt(editIndex, 10));
    }
  }, [color, style, size]);

  const loadSelections = async () => {
    console.log('Loading selections:', { color, style, size });

    if (color && style && size) {
      const decodedColor = decodeURIComponent(color);
      const decodedStyle = decodeURIComponent(style);
      const decodedSize = decodeURIComponent(size);

      let allGarments = await base44.entities.Garment.list();
      
      // Filter by location availability
      allGarments = filterGarmentsByLocation(allGarments);
      
      const garments = allGarments.filter(g => 
        g.color?.toLowerCase() === decodedColor.toLowerCase() &&
        g.style?.toLowerCase() === decodedStyle.toLowerCase() &&
        g.size?.toUpperCase() === decodedSize.toUpperCase()
      );
      
      console.log('Found garments:', garments);
      if (garments.length > 0) {
        setSelectedGarment(garments[0]);
        console.log('Selected garment:', garments[0]);
        
        // Load style configuration for placement coordinates
        const styles = await base44.entities.Style.filter({ style_name: decodedStyle });
        if (styles.length > 0) {
          console.log('Loaded style config:', styles[0]);
          setStyleConfig(styles[0]);
        } else {
          setStyleConfig(null);
        }
      } else {
        setSelectedGarment(null);
        setStyleConfig(null);
        console.log('No garment found for selection.');
      }
    } else {
      setSelectedGarment(null);
      setStyleConfig(null);
      console.log('Incomplete garment selection parameters.');
    }

    const storedPrints = localStorage.getItem('selectedPrints');
    console.log('[Preview loadSelections] Raw localStorage data:', storedPrints);
    if (storedPrints) {
      try {
        const prints = JSON.parse(storedPrints);
        console.log('[Preview loadSelections] Parsed prints:', prints);
        console.log('[Preview loadSelections] Print details:', prints.map(p => ({ 
          name: p.name, 
          placement: p.placement, 
          print_size: p.print_size,
          isAssemblyLocked: p.isAssemblyLocked,
          system_id: p.system_id
        })));
        
        // Load all active preprints to find placement data
        const allPreprints = await base44.entities.Preprint.filter({ is_active: true });
        
        // Auto-assign placements for assembly locked prints using preprint data
        const printsWithPlacements = prints.map(print => {
          console.log('[Preview loadSelections] Processing print:', {
            name: print.name,
            existing_placement: print.placement,
            print_size: print.print_size,
            isAssemblyLocked: print.isAssemblyLocked,
            system_id: print.system_id
          });
          
          // ONLY auto-assign for assembly locked (preprinted) items
          if (print.isAssemblyLocked && print.system_id) {
            // Find the preprint that contains this print
            const matchingPreprint = allPreprints.find(preprint => 
              preprint.print1_system_id === print.system_id || 
              preprint.print2_system_id === print.system_id
            );
            
            if (matchingPreprint) {
              // Use the placement from the preprint entity
              const isPrint1 = matchingPreprint.print1_system_id === print.system_id;
              const preprintPlacement = isPrint1 
                ? matchingPreprint.print1_placement 
                : matchingPreprint.print2_placement;
              
              if (preprintPlacement) {
                console.log('[Preview loadSelections] Using preprint placement:', {
                  name: print.name,
                  system_id: print.system_id,
                  preprint_id: matchingPreprint.preprint_system_id,
                  assigned_placement: preprintPlacement
                });
                
                return {
                  ...print,
                  placement: preprintPlacement
                };
              }
            }
            
            // Fallback to print_size-based assignment if no preprint placement found
            const printSize = print.print_size || '';
            let placement = 'Front Center'; // default
            
            if (printSize === 'Adult' || printSize === 'Jr' || printSize === 'Kid' || printSize === 'Baby') {
              placement = 'Front Center';
            } else if (printSize === 'Sleeve') {
              placement = 'Right Sleeve';
            } else if (printSize === 'Crest') {
              placement = 'Front Left Chest';
            } else if (printSize.includes('Leg')) {
              placement = 'Right Leg';
            }
            
            console.log('[Preview loadSelections] Assembly locked - fallback placement:', {
              name: print.name,
              print_size: printSize,
              assigned_placement: placement
            });
            
            return {
              ...print,
              placement: placement
            };
          }
          
          // Not assembly locked - keep existing placement
          return print;
        });
        
        setSelectedPrints(printsWithPlacements);
      } catch (error) {
        console.error('Error parsing stored prints:', error);
        setSelectedPrints([]);
      }
    } else {
      setSelectedPrints([]);
    }

    setLoading(false);
  };

  const handleBack = () => {
    const params = new URLSearchParams(window.location.search);
    const flow = params.get('flow');
    const style = params.get('style');
    const color = params.get('color');

    if (flow === 'print' && style && color) {
      navigate(createPageUrl(`StyleSelection?flow=print&color=${encodeURIComponent(color)}`));
    } else {
      navigate(createPageUrl(`SizeSelection?${params.toString()}`));
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

  const editSelection = async (type) => {
    const params = new URLSearchParams(window.location.search);
    
    const decodedColor = color ? decodeURIComponent(color) : null;
    const decodedStyle = style ? decodeURIComponent(style) : null;
    const decodedSize = size ? decodeURIComponent(size) : null;
    
    const isCurrentlyBottoms = selectedGarment?.style?.toLowerCase().includes('sweatpants');

    switch(type) {
      case 'color':
        if (decodedStyle) {
          let allGarments = await base44.entities.Garment.list();
          
          // Filter by location availability
          allGarments = filterGarmentsByLocation(allGarments);
          
          let garments = allGarments.filter(g => 
            g.style?.toLowerCase() === decodedStyle.toLowerCase()
          );
          
          if (decodedSize) {
            garments = garments.filter(g => g.size?.toUpperCase() === decodedSize.toUpperCase());
          }
          
          if (isCurrentlyBottoms) {
            garments = garments.filter(g => g.style?.toLowerCase().includes('sweatpants'));
          } else {
            garments = garments.filter(g => !g.style?.toLowerCase().includes('sweatpants'));
          }
          
          const allColors = await base44.entities.Color.list();
          const availableColorNames = [...new Set(garments.map(g => g.color))];
          const colorObjects = allColors.filter(c => availableColorNames.includes(c.name));
          setAvailableColors(colorObjects);
          setShowColorDialog(true);
        }
        break;
      case 'style':
        let allGarments = await base44.entities.Garment.list();
        
        // Filter by location availability
        allGarments = filterGarmentsByLocation(allGarments);
        
        if (isCurrentlyBottoms) {
          allGarments = allGarments.filter(g => g.style?.toLowerCase().includes('sweatpants'));
        } else {
          allGarments = allGarments.filter(g => !g.style?.toLowerCase().includes('sweatpants'));
        }
        
        const styleMap = {};
        allGarments.forEach(garment => {
          if (garment.style && !styleMap[garment.style]) {
            styleMap[garment.style] = garment;
          }
        });
        const uniqueStyleGarments = Object.values(styleMap);
        setAvailableStyles(uniqueStyleGarments);
        setStyleDialogStep(1);
        setTempSelection({ style: null, color: null, size: null });
        setShowStyleDialog(true);
        break;
      case 'size':
        if (decodedStyle && decodedColor) {
          let allGarments = await base44.entities.Garment.list();
          
          // Filter by location availability
          allGarments = filterGarmentsByLocation(allGarments);
          
          let garments = allGarments.filter(g => 
            g.style?.toLowerCase() === decodedStyle.toLowerCase() &&
            g.color?.toLowerCase() === decodedColor.toLowerCase()
          );
          
          if (isCurrentlyBottoms) {
            garments = garments.filter(g => g.style?.toLowerCase().includes('sweatpants'));
          } else {
            garments = garments.filter(g => !g.style?.toLowerCase().includes('sweatpants'));
          }
          
          const sizeNames = [...new Set(garments.map(g => g.size))];
          const sizeOrder = ['S', 'M', 'L', 'XL', '2X', '3X'];
          const orderedSizes = sizeNames.sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b));
          setAvailableSizes(orderedSizes);
          setShowSizeDialog(true);
        }
        break;
      case 'print':
        navigate(createPageUrl(`PrintCatalog?${params.toString()}`));
        break;
      default:
        console.warn('Unknown edit selection type:', type);
    }
  };

  const handleStyleSelect = async (newStyle) => {
    // Step 1: Style selected, now show colors for this style
    setTempSelection({ ...tempSelection, style: newStyle });
    
    // Load colors for this style
    let allGarments = await base44.entities.Garment.list();
    allGarments = filterGarmentsByLocation(allGarments);
    
    const garmentsForStyle = allGarments.filter(g => 
      g.style?.toLowerCase() === newStyle.toLowerCase()
    );
    
    const allColors = await base44.entities.Color.list();
    const availableColorNames = [...new Set(garmentsForStyle.map(g => g.color))];
    const colorObjects = allColors.filter(c => availableColorNames.includes(c.name));
    setAvailableColors(colorObjects);
    
    setStyleDialogStep(2);
  };

  const handleStyleDialogColorSelect = async (newColor) => {
    // Step 2: Color selected, now show sizes
    setTempSelection({ ...tempSelection, color: newColor });
    
    // Load sizes for this style and color
    let allGarments = await base44.entities.Garment.list();
    allGarments = filterGarmentsByLocation(allGarments);
    
    const garmentsForStyleAndColor = allGarments.filter(g => 
      g.style?.toLowerCase() === tempSelection.style.toLowerCase() &&
      g.color?.toLowerCase() === newColor.toLowerCase()
    );
    
    const sizeNames = [...new Set(garmentsForStyleAndColor.map(g => g.size))];
    const sizeOrder = ['S', 'M', 'L', 'XL', '2X', '3X'];
    const orderedSizes = sizeNames.sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b));
    setAvailableSizes(orderedSizes);
    
    setStyleDialogStep(3);
  };

  const handleStyleDialogSizeSelect = async (newSize) => {
    // Step 3: Size selected, now check if prints fit
    const finalStyle = tempSelection.style;
    const finalColor = tempSelection.color;
    const finalSize = newSize;
    
    setPreviousSelection({ color, style, size });
    
    // Check if prints fit on this specific garment
    if (selectedPrints.length > 0) {
      const allGarments = await base44.entities.Garment.list();
      const garments = allGarments.filter(g => 
        g.style?.toLowerCase() === finalStyle.toLowerCase() &&
        g.color?.toLowerCase() === finalColor.toLowerCase() &&
        g.size?.toUpperCase() === finalSize.toUpperCase()
      );
      
      if (garments.length > 0) {
        const newGarment = garments[0];
        
        const printsFit = selectedPrints.every(print => {
          if (!print.width || !print.height) return true;
          
          const view = getViewForPlacement(print.placement, print);
          
          let maxWidth, maxHeight;
          if (view === 'front') {
            maxWidth = newGarment.front_max_print_width;
            maxHeight = newGarment.front_max_print_height;
          } else if (view === 'back') {
            maxWidth = newGarment.back_max_print_width;
            maxHeight = newGarment.back_max_print_height;
          } else if (view === 'right') {
            maxWidth = newGarment.rsleeve_max_print_width || newGarment.rleg_max_print_width;
            maxHeight = newGarment.rsleeve_max_print_height || newGarment.rleg_max_print_height;
          } else if (view === 'left') {
            maxWidth = newGarment.lsleeve_max_print_width || newGarment.lleg_max_print_width;
            maxHeight = newGarment.lsleeve_max_print_height || newGarment.lleg_max_print_height;
          }
          
          if (!maxWidth || !maxHeight) return true;
          
          return print.width <= maxWidth && print.height <= maxHeight;
        });
        
        if (!printsFit) {
          setPendingChange({ type: 'style', value: finalStyle, color: finalColor, size: finalSize });
          setShowStyleDialog(false);
          setStyleDialogStep(1);
          setTempSelection({ style: null, color: null, size: null });
          setShowPrintChangeDialog(true);
          return;
        }
      }
    }
    
    // Apply the complete change
    applyStyleChange(finalStyle, finalColor, finalSize);
  };

  const applyStyleChange = async (newStyle, newColor, newSize) => {
    const params = new URLSearchParams(window.location.search);
    params.set('style', newStyle);
    params.set('color', newColor);
    params.set('size', newSize);
    
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    
    setShowStyleDialog(false);
    setStyleDialogStep(1);
    setTempSelection({ style: null, color: null, size: null });
    setPreviousSelection(null);
    
    await loadSelections();
  };

  const handleColorSelect = async (newColor) => {
    setPreviousSelection({ color, style, size });
    
    const decodedStyle = style ? decodeURIComponent(style) : null;
    const decodedSize = size ? decodeURIComponent(size) : null;
    
    if (selectedPrints.length > 0 && decodedStyle && decodedSize) {
      const allGarments = await base44.entities.Garment.list();
      const garments = allGarments.filter(g => 
        g.color?.toLowerCase() === newColor.toLowerCase() &&
        g.style?.toLowerCase() === decodedStyle.toLowerCase() &&
        g.size?.toUpperCase() === decodedSize.toUpperCase()
      );
      
      if (garments.length > 0) {
        const newGarment = garments[0];
        
        const printsFit = selectedPrints.every(print => {
          if (!print.width || !print.height) return true;
          
          const view = getViewForPlacement(print.placement, print);
          
          let maxWidth, maxHeight;
          if (view === 'front') {
            maxWidth = newGarment.front_max_print_width;
            maxHeight = newGarment.front_max_print_height;
          } else if (view === 'back') {
            maxWidth = newGarment.back_max_print_width;
            maxHeight = newGarment.back_max_print_height;
          } else if (view === 'right') {
            maxWidth = newGarment.rsleeve_max_print_width || newGarment.rleg_max_print_width;
            maxHeight = newGarment.rsleeve_max_print_height || newGarment.rleg_max_print_height;
          } else if (view === 'left') {
            maxWidth = newGarment.lsleeve_max_print_width || newGarment.lleg_max_print_width;
            maxHeight = newGarment.lsleeve_max_print_height || newGarment.lleg_max_print_height;
          }
          
          if (!maxWidth || !maxHeight) return true;
          
          return print.width <= maxWidth && print.height <= maxHeight;
        });
        
        if (!printsFit) {
          setPendingChange({ type: 'color', value: newColor });
          setShowColorDialog(false);
          setShowPrintChangeDialog(true);
          return;
        }
      }
    }
    
    applyColorChange(newColor);
  };

  const applyColorChange = async (newColor) => {
    const params = new URLSearchParams(window.location.search);
    params.set('color', newColor);
    
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    
    const decodedStyle = style ? decodeURIComponent(style) : null;
    const decodedSize = size ? decodeURIComponent(size) : null;
    
    if (decodedStyle && decodedSize) {
      const allGarments = await base44.entities.Garment.list();
      const garments = allGarments.filter(g => 
        g.color?.toLowerCase() === newColor.toLowerCase() && // Use newColor here
        g.style?.toLowerCase() === decodedStyle.toLowerCase() &&
        g.size?.toUpperCase() === decodedSize.toUpperCase()
      );
      if (garments.length > 0) {
        setSelectedGarment(garments[0]);
      }
    } else {
      setSelectedGarment(null);
    }
    
    setShowColorDialog(false);
    setPreviousSelection(null);
  };

  const handleSizeSelect = async (newSize) => {
    setPreviousSelection({ color, style, size });
    
    const decodedStyle = style ? decodeURIComponent(style) : null;
    const decodedColor = color ? decodeURIComponent(color) : null;
    
    if (!decodedStyle || !decodedColor) {
      const params = new URLSearchParams(window.location.search);
      params.set('size', newSize);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      setShowSizeDialog(false);
      await loadSelections();
      return;
    }
    
    const allGarments = await base44.entities.Garment.list();
    const garments = allGarments.filter(g => 
      g.color?.toLowerCase() === decodedColor.toLowerCase() &&
      g.style?.toLowerCase() === decodedStyle.toLowerCase() &&
      g.size?.toUpperCase() === newSize.toUpperCase()
    );
    
    if (garments.length === 0) {
      setShowSizeDialog(false);
      return;
    }
    
    const newGarment = garments[0];
    
    if (selectedPrints.length > 0) {
      const printsFit = selectedPrints.every(print => {
        if (!print.width || !print.height) return true;
        
        const view = getViewForPlacement(print.placement, print);
        
        let maxWidth, maxHeight;
        if (view === 'front') {
          maxWidth = newGarment.front_max_print_width;
          maxHeight = newGarment.front_max_print_height;
        } else if (view === 'back') {
          maxWidth = newGarment.back_max_print_width;
          maxHeight = newGarment.back_max_print_height;
        } else if (view === 'right') {
          maxWidth = newGarment.rsleeve_max_print_width || newGarment.rleg_max_print_width;
          maxHeight = newGarment.rsleeve_max_print_height || newGarment.rleg_max_print_height;
        } else if (view === 'left') {
          maxWidth = newGarment.lsleeve_max_print_width || newGarment.lleg_max_print_width;
          maxHeight = newGarment.lsleeve_max_print_height || newGarment.lleg_max_print_height;
        }
        
        if (!maxWidth || !maxHeight) return true;
        
        return print.width <= maxWidth && print.height <= maxHeight;
      });
      
      if (!printsFit) {
        setPendingChange({ type: 'size', value: newSize });
        setShowSizeDialog(false);
        setShowPrintChangeDialog(true);
        return;
      }
    }
    
    applySize(newSize);
  };

  const applySize = async (newSize) => {
    const params = new URLSearchParams(window.location.search);
    params.set('size', newSize);
    
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    
    const decodedColor = color ? decodeURIComponent(color) : null;
    const decodedStyle = style ? decodeURIComponent(style) : null;
    
    const allGarments = await base44.entities.Garment.list();
    const garments = allGarments.filter(g => 
      g.color?.toLowerCase() === decodedColor.toLowerCase() &&
      g.style?.toLowerCase() === decodedStyle.toLowerCase() &&
      g.size?.toUpperCase() === newSize.toUpperCase()
    );
    
    if (garments.length > 0) {
      setSelectedGarment(garments[0]);
    }
    
    setShowSizeDialog(false);
    setPreviousSelection(null);
  };

  const handleChangePrints = async () => {
    localStorage.removeItem('selectedPrints');
    setSelectedPrints([]);
    
    // Apply the garment changes first
    if (pendingChange.type === 'style') {
      const params = new URLSearchParams(window.location.search);
      params.set('style', pendingChange.value);
      params.set('color', pendingChange.color);
      params.set('size', pendingChange.size);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      
      // Navigate to PrintCatalog with new params
      navigate(createPageUrl(`PrintCatalog?${params.toString()}`));
    } else if (pendingChange.type === 'color') {
      const params = new URLSearchParams(window.location.search);
      params.set('color', pendingChange.value);
      
      // Navigate to PrintCatalog with updated params
      navigate(createPageUrl(`PrintCatalog?${params.toString()}`));
    } else if (pendingChange.type === 'size') {
      const params = new URLSearchParams(window.location.search);
      params.set('size', pendingChange.value);
      
      // Navigate to PrintCatalog with updated params
      navigate(createPageUrl(`PrintCatalog?${params.toString()}`));
    }
    
    setShowPrintChangeDialog(false);
    setPendingChange(null);
  };

  const handleKeepOriginal = () => {
    if (previousSelection) {
      const params = new URLSearchParams(window.location.search);
      if (previousSelection.style) params.set('style', previousSelection.style);
      if (previousSelection.color) params.set('color', previousSelection.color);
      if (previousSelection.size) params.set('size', previousSelection.size);
      
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      loadSelections();
    }
    
    setShowPrintChangeDialog(false);
    setPendingChange(null);
    setPreviousSelection(null);
  };


  const getViewForPlacement = (placement, print = null) => {
    if (placement === 'Custom') return null;
    
    // FIRST: Check placement name directly (handles assembly locked items)
    const standardizedPlacement = placement.toLowerCase().replace(/ /g, '_');
    const frontPlacements = ['front', 'chest', 'full_front', 'front_center', 'front_left_crest', 'front_left_chest', 'front_right_chest'];
    const backPlacements = ['back', 'full_back', 'back_center', 'back_shoulder'];
    const rightSleeveOrLegPlacements = ['right_sleeve', 'right_leg'];
    const leftSleeveOrLegPlacements = ['left_sleeve', 'left_leg'];
    
    if (backPlacements.includes(standardizedPlacement)) return 'back';
    if (rightSleeveOrLegPlacements.includes(standardizedPlacement)) return 'right';
    if (leftSleeveOrLegPlacements.includes(standardizedPlacement)) return 'left';
    if (frontPlacements.includes(standardizedPlacement)) return 'front';
    if (standardizedPlacement === 'standard') return 'front';
    
    // SECOND: Try styleConfig lookup if available
    if (!styleConfig || !print?.print_size) {
      return 'front';
    }

    // Map print size to style config key
    const printSizeToKey = {
      'Adult': 'adult_placements',
      'Jr': 'jr_placements',
      'Kid': 'kid_placements',
      'Baby': 'baby_placements',
      'Sleeve': 'sleeve_placements',
      'Crest': 'crest_placements',
      'Adult Leg': 'leg_placements',
      'Jr Leg': 'leg_placements',
      'Kid Leg': 'leg_placements',
      'Leg': 'leg_placements'
    };

    const printSizeKey = printSizeToKey[print.print_size];
    if (!printSizeKey || !styleConfig[printSizeKey]) return 'front';

    // Find the placement config for this exact placement name
    const placementConfig = styleConfig[printSizeKey].find(p => p.name === placement);
    if (!placementConfig?.print_area) return 'front';

    // Map print_area to view - THIS IS THE ONLY SOURCE OF TRUTH
    const area = placementConfig.print_area;
    if (area === 'print-area-back' || area === 'back:print-area') return 'back';
    if (area === 'rsleeve-area' || area === 'right:sleeve-area') return 'right';
    if (area === 'lsleeve-area' || area === 'left:sleeve-area') return 'left';
    if (area === 'right:print-area' || area === 'rprint-area') return 'right';
    if (area === 'left:print-area' || area === 'lprint-area') return 'left';
    if (area === 'front:right' || area === 'front:rprint-area') return 'front';
    if (area === 'front:left' || area === 'front:lprint-area') return 'front';

    // print-area and print-area-front both map to front view
    return 'front';
  };

  const getPrintsForView = (viewType) => {
    const isSweatpants = selectedGarment?.style?.toLowerCase().includes('sweatpants');
    const isYouthSweatpants = selectedGarment?.style?.toLowerCase().includes('youth') && selectedGarment?.style?.toLowerCase().includes('sweatpants');
    const isToddler = selectedGarment?.style?.toLowerCase().includes('toddler');
    const isHoodie = selectedGarment?.style?.toLowerCase().includes('hoodie') || selectedGarment?.style?.toLowerCase().includes('zip');
    const isYouthNonHoodieNonSweatpants = selectedGarment?.style?.toLowerCase().includes('youth') && !isHoodie && !selectedGarment?.style?.toLowerCase().includes('sweatpants');

    console.log(`[getPrintsForView] viewType=${viewType}, isSweatpants=${isSweatpants}`);
    console.log(`[getPrintsForView] selectedPrints:`, selectedPrints.map(p => ({ name: p.name, placement: p.placement })));
    
    const filtered = selectedPrints.filter(p => {
      const placementLower = (p.placement || '').toLowerCase();
      console.log(`[getPrintsForView] Checking print ${p.name}, placement="${p.placement}", placementLower="${placementLower}"`);
      
      if (isSweatpants || isYouthSweatpants) {
        if (viewType === 'front') {
          // Front view for sweatpants shows both leg prints
          const matches = placementLower === 'right leg' || placementLower === 'left leg' || placementLower === 'right_leg' || placementLower === 'left_leg' || placementLower === 'standard';
          console.log(`[getPrintsForView] Sweatpants front check: ${matches}`);
          return matches;
        }
        console.log(`[getPrintsForView] Sweatpants non-front: false`);
        return false;
      } else if (isToddler || isYouthNonHoodieNonSweatpants) {
        if (viewType === 'front') {
          return placementLower.includes('front') || placementLower.includes('chest') || placementLower.includes('crest') || placementLower === 'standard';
        } else if (viewType === 'back') {
          return placementLower.includes('back');
        }
        return false;
      } else {
        // Use styleConfig-based view mapping
        const printView = getViewForPlacement(p.placement, p);
        const matches = printView === viewType;
        console.log(`[getPrintsForView Preview] "${p.name}" placement="${p.placement}" → view="${printView}" → matches "${viewType}"? ${matches}`);
        return matches;
      }
      return false;
    });
    
    console.log(`[getPrintsForView] Returning ${filtered.length} prints for view ${viewType}`);
    return filtered;
  };

  // Check if a view has any locked prints
  const viewHasLockedPrint = (viewType) => {
    return getPrintsForView(viewType).some(p => p.isAssemblyLocked);
  };

  const PreviewCard = ({ title, garmentImage, viewType, garment }) => {
    console.log(`Rendering ${title}:`, { garmentImage, garment, viewType });

    const prints = getPrintsForView(viewType);
    console.log(`[Preview ${title}] View type: ${viewType}`);
    console.log(`[Preview ${title}] Prints for view ${viewType}:`, prints);
    console.log(`[Preview ${title}] All selectedPrints:`, selectedPrints);
    console.log(`[Preview ${title}] prints.length = ${prints.length}`);
    const hasLockedPrint = prints.some(p => p.isAssemblyLocked);
    const isSweatpants = garment?.style?.toLowerCase().includes('sweatpants');
    
    const imageSize = isSweatpants ? { width: '280px', height: '280px' } : { width: '200px', height: '200px' };

    if (!garment || !color || !size) {
      return (
        <Card className="border-0 shadow-lg overflow-hidden rounded-2xl">
          <CardContent className="p-0">
            <div className="bg-muted h-80 relative flex items-center justify-center p-8 rounded-t-2xl">
              <div className="text-center">
                <div className="text-6xl text-muted-foreground mb-3">👕</div>
                <p className="text-sm text-muted-foreground">
                  {!color && !size && "Select color and size"}
                  {!color && size && "Select color"}
                  {color && !size && "Select size"}
                </p>
              </div>
            </div>
            <div className="p-4 text-center">
              <h3 className="text-lg font-light">{title}</h3>
            </div>
          </CardContent>
        </Card>
      );
    }

    let maxPrintWidth, maxPrintHeight;
    if (viewType === 'front') {
      // For sweatpants, front view shows both legs using rsleeve/lsleeve dimensions
      if (isSweatpants) {
        maxPrintWidth = garment?.rsleeve_max_print_width;
        maxPrintHeight = garment?.rsleeve_max_print_height;
        console.log(`[PreviewCard ${title}] Sweatpants - using rsleeve dimensions:`, { maxPrintWidth, maxPrintHeight, garment });
      } else {
        maxPrintWidth = garment?.front_max_print_width;
        maxPrintHeight = garment?.front_max_print_height;
      }
    } else if (viewType === 'back') {
      maxPrintWidth = garment?.back_max_print_width;
      maxPrintHeight = garment?.back_max_print_height;
    } else if (viewType === 'right' || viewType === 'left') {
      if (viewType === 'right') {
        maxPrintWidth = garment?.rsleeve_max_print_width;
        maxPrintHeight = garment?.rsleeve_max_print_height;
      } else {
        maxPrintWidth = garment?.lsleeve_max_print_width;
        maxPrintHeight = garment?.lsleeve_max_print_height;
      }
    }
    
    console.log(`[PreviewCard ${title}] Final dimensions to pass:`, { maxPrintWidth, maxPrintHeight, isSweatpants, viewType });

    return (
      <Card className="border-0 shadow-lg overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          <div className="bg-muted h-80 relative flex items-center justify-center p-8 rounded-t-2xl">
            {!garmentImage ? (
              <div className="text-6xl text-gray-400">👕</div>
            ) : prints.length > 0 ? (
              <div style={imageSize} className="rounded-xl overflow-hidden">
                <SvgImageWithPrint
                  garmentSrc={garmentImage}
                  prints={prints}
                  maxPrintWidth={maxPrintWidth}
                  maxPrintHeight={maxPrintHeight}
                  rMaxPrintWidth={garment?.rsleeve_max_print_width}
                  rMaxPrintHeight={garment?.rsleeve_max_print_height}
                  lMaxPrintWidth={garment?.lsleeve_max_print_width}
                  lMaxPrintHeight={garment?.lsleeve_max_print_height}
                  styleConfig={styleConfig}
                  className="w-full h-full rounded-xl"
                  fallback={<div className="text-6xl text-gray-400">👕</div>}
                />
              </div>
            ) : (
              <div style={imageSize} className="rounded-xl overflow-hidden">
                <SvgImage
                  src={garmentImage}
                  alt={title}
                  className="w-full h-full rounded-xl"
                  fallback={<div className="text-6xl text-gray-400">👕</div>}
                />
              </div>
            )}
          </div>
          <div className="p-4 text-center">
            <h3 className="text-lg font-light">{title}</h3>
            {prints.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mt-1">
                  {prints.map(p => p.name).join(', ')}
                </p>
                {hasLockedPrint && (
                  <p className="text-xs text-yellow-400 mt-1">🔒 Assembly Print Locked</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const handleAddToOrder = async () => {
    // Skip preprint check if we already have locked (preprinted) prints
    const hasLockedPrints = selectedPrints.some(p => p.isAssemblyLocked);
    if (hasLockedPrints) {
      // Already using preprint, skip the preprint dialog
      setShowAddMoreDialog(true);
      return;
    }
    
    // Check for preprint match before proceeding
    const preprintMatch = await checkForPreprintMatch();
    if (preprintMatch) {
      setMatchedPreprint(preprintMatch);
      setShowPreprintDialog(true);
    } else {
      setShowAddMoreDialog(true);
    }
  };

  const checkForPreprintMatch = async () => {
    try {
      // Get all active preprints only
      const allPreprints = await base44.entities.Preprint.filter({ is_active: true });
      
      // Get the current build components
      const blankSystemId = selectedGarment?.system_id;
      const printSystemIds = selectedPrints.map(p => p.system_id).filter(Boolean);
      
      console.log('=== Preprint Match Check ===');
      console.log('Garment system_id:', blankSystemId);
      console.log('Print system_ids:', printSystemIds);
      console.log('Total preprints:', allPreprints.length);
      
      if (!blankSystemId || printSystemIds.length === 0) {
        console.log('Missing blank or prints, skipping check');
        return null;
      }
      
      // Check if any preprint matches (must have ALL components of preprint, can have MORE)
      for (const preprint of allPreprints) {
        const hasBlank = blankSystemId === preprint.blank_system_id;
        const hasPrint1 = printSystemIds.includes(preprint.print1_system_id);
        const hasPrint2 = !preprint.print2_system_id || printSystemIds.includes(preprint.print2_system_id);
        
        console.log(`Checking preprint ${preprint.preprint_system_id}:`, {
          blank_match: hasBlank,
          print1_match: hasPrint1,
          print2_match: hasPrint2,
          preprint_blank: preprint.blank_system_id,
          preprint_print1: preprint.print1_system_id,
          preprint_print2: preprint.print2_system_id
        });
        
        if (hasBlank && hasPrint1 && hasPrint2) {
          console.log('✅ MATCH FOUND:', preprint.preprint_system_id);
          return preprint;
        }
      }
      
      console.log('No preprint match found');
      return null;
    } catch (error) {
      console.error('Error checking for preprint match:', error);
      return null;
    }
  };

  const handleCheckInventory = async () => {
    setCheckingInventory(true);
    console.log('🔍 [handleCheckInventory] Starting inventory check');
    try {
      const selectedLocationData = localStorage.getItem('selectedLocation');
      console.log('📍 [handleCheckInventory] Selected location:', selectedLocationData);
      if (!selectedLocationData) {
        alert('No location selected');
        setCheckingInventory(false);
        return;
      }

      const selectedLocation = JSON.parse(selectedLocationData);
      console.log('📍 [handleCheckInventory] Parsed location:', { id: selectedLocation.id, shopID: selectedLocation.shopID });

      // First, get the actual Lightspeed item details to get the correct itemID
      console.log('🔍 [handleCheckInventory] Getting item details for:', matchedPreprint.preprint_system_id);
      const itemDetailsResponse = await base44.functions.invoke('lightspeedGetItemDetails', {
        barcode: matchedPreprint.preprint_system_id,
        locationId: selectedLocation.id
      });

      if (!itemDetailsResponse.data.success || !itemDetailsResponse.data.item) {
        console.error('❌ [handleCheckInventory] Failed to get item details');
        alert('Failed to load preprint details from POS');
        setCheckingInventory(false);
        return;
      }

      const item = itemDetailsResponse.data.item;
      console.log('✅ [handleCheckInventory] Got item details - itemID:', item.itemID);

      console.log('🚀 [handleCheckInventory] Calling lightspeedCheckInventory...');
      const response = await base44.functions.invoke('lightspeedCheckInventory', {
        items: [{
          name: `Preprint ${matchedPreprint.preprint_system_id}`,
          system_id: matchedPreprint.preprint_system_id,
          itemID: item.itemID,
          quantity: 1,
          type: 'preprint'
        }],
        shopID: selectedLocation.shopID,
        locationId: selectedLocation.id
      });

      console.log('✅ [handleCheckInventory] Response received:', response.data);

      if (response.data.success) {
        // Get the actual inventory from the response
        const inventory = response.data.allItemsInventory?.[0];
        if (inventory) {
          setPreprintInventory({ available: inventory.available, needed: 1 });
        } else {
          setPreprintInventory({ available: 0, needed: 1 });
        }
      } else {
        console.error('❌ [handleCheckInventory] API returned error:', response.data.error);
        alert('Inventory check failed: ' + response.data.error);
      }
    } catch (error) {
      console.error('❌ [handleCheckInventory] Error checking inventory:', error);
      alert('Failed to check inventory: ' + error.message);
    } finally {
      setCheckingInventory(false);
    }
  };

  const handleUsePreprint = async () => {
    // Get the preprint details from Lightspeed
    const selectedLocationData = localStorage.getItem('selectedLocation');
    if (!selectedLocationData) {
      alert('No location selected');
      return;
    }
    
    const selectedLocation = JSON.parse(selectedLocationData);
    
    try {
      const response = await base44.functions.invoke('lightspeedGetItemDetails', {
        barcode: matchedPreprint.preprint_system_id,
        locationId: selectedLocation.id
      });
      
      if (!response.data.success || !response.data.item) {
        alert('Failed to load preprint details');
        return;
      }
      
      const item = response.data.item;
      
      // Get additional prints (prints NOT in the preprint)
      const preprintPrintIds = [matchedPreprint.print1_system_id, matchedPreprint.print2_system_id].filter(Boolean);
      const additionalPrints = selectedPrints.filter(p => !preprintPrintIds.includes(p.system_id));
      
      // Create scanned item similar to barcode scan
      const scannedItem = {
        systemSku: item.systemSku,
        itemID: item.itemID,
        description: item.description,
        price: parseFloat(item.Prices?.ItemPrice?.[0]?.amount || item.Prices?.ItemPrice?.amount || 0),
        itemType: item.itemType,
        isScannedItem: true,
        isAssembly: true,
        assemblyComponents: item.ItemComponents,
        prints: additionalPrints
      };
      
      // Add to order
      const existingOrder = localStorage.getItem('orderBuilds');
      const orderBuilds = existingOrder ? JSON.parse(existingOrder) : [];
      orderBuilds.push(scannedItem);
      localStorage.setItem('orderBuilds', JSON.stringify(orderBuilds));
      
      // Clear selections
      localStorage.removeItem('selectedPrints');
      localStorage.removeItem('pendingBuild');
      
      setShowPreprintDialog(false);
      setMatchedPreprint(null);
      setPreprintInventory(null);
      
      console.log('Setting itemAddedToCart flag and navigating to Home');
      localStorage.setItem('itemAddedToCart', 'true');
      console.log('Flag set:', localStorage.getItem('itemAddedToCart'));
      navigate(createPageUrl("Home"));
    } catch (error) {
      console.error('Error using preprint:', error);
      alert('Failed to use preprint');
    }
  };

  const handleProduceAnyway = async () => {
    // Log to PreprintLog
    try {
      const selectedLocationData = localStorage.getItem('selectedLocation');
      const employeeCode = localStorage.getItem('employeeCode');
      
      if (selectedLocationData) {
        const selectedLocation = JSON.parse(selectedLocationData);
        
        // Get employee name from code
        const employees = await base44.entities.EmployeeCode.filter({ code: employeeCode });
        const employeeName = employees.length > 0 ? employees[0].employee_name : employeeCode;
        
        await base44.entities.PreprintLog.create({
          preprint_system_id: matchedPreprint.preprint_system_id,
          blank_system_id: matchedPreprint.blank_system_id,
          print1_system_id: matchedPreprint.print1_system_id,
          print2_system_id: matchedPreprint.print2_system_id,
          location_name: selectedLocation.name,
          employee_name: employeeName,
          reason: 'User chose to produce anyway'
        });
      }
    } catch (error) {
      console.error('Error logging preprint bypass:', error);
    }
    
    // Continue with normal flow
    setShowPreprintDialog(false);
    setMatchedPreprint(null);
    setPreprintInventory(null);
    setShowAddMoreDialog(true);
  };

  const getRecommendedWaxPrice = () => {
    const nonPatchPrints = selectedPrints.filter(p => !p.tags?.includes('Patch'));
    return nonPatchPrints.length >= 2 ? 15 : 10;
  };

  const handleWaxProtectionSelection = (systemId, price) => {
    if (systemId === null && price === 0) {
      // User clicked "No" - ask if they've had wax before
      setShowWaxProtectionDialog(false);
      setShowDiscountedOptions(false);
      setShowFirstTimeWaxDialog(true);
      return;
    }

    const currentBuild = {
      color,
      style,
      size,
      garment: selectedGarment,
      prints: selectedPrints,
      wax_protection: systemId ? { system_id: systemId, price: price, name: `Wax Protection - $${price}`, itemID: systemId.split('210000001')[1] || systemId } : null
    };

    setShowWaxProtectionDialog(false);
    setShowFirstTimeWaxDialog(false);
    setShowDiscountedOptions(false);
    
    if (waxProtectionAction === 'addToOrder') {
      const existingOrder = localStorage.getItem('orderBuilds');
      const orderBuilds = existingOrder ? JSON.parse(existingOrder) : [];
      
      if (isEditing && editingIndex !== null) {
        const existingBuild = orderBuilds[editingIndex];
        
        // If editing an assembly item, preserve it and just add new prints
        if (existingBuild?.isScannedItem && existingBuild?.isAssembly) {
          const additionalPrints = selectedPrints.filter(p => !p.isAssemblyLocked);
          orderBuilds[editingIndex] = {
            ...existingBuild,
            prints: additionalPrints,
            wax_protection: systemId ? { system_id: systemId, price: price } : null
          };
        } else {
          orderBuilds[editingIndex] = currentBuild;
        }
        localStorage.removeItem('editingBuildIndex');
      } else {
        orderBuilds.push(currentBuild);
      }
      
      localStorage.setItem('orderBuilds', JSON.stringify(orderBuilds));
      
      localStorage.removeItem('selectedPrints');
      localStorage.removeItem('pendingBuild');
      localStorage.setItem('itemAddedToCart', 'true');
      
      navigate(createPageUrl("Home"));
    } else if (waxProtectionAction === 'placeOrder') {
      const existingOrder = localStorage.getItem('orderBuilds');
      const orderBuilds = existingOrder ? JSON.parse(existingOrder) : [];
      
      if (isEditing && editingIndex !== null) {
        const existingBuild = orderBuilds[editingIndex];
        
        // If editing an assembly item, preserve it and just add new prints
        if (existingBuild?.isScannedItem && existingBuild?.isAssembly) {
          const additionalPrints = selectedPrints.filter(p => !p.isAssemblyLocked);
          orderBuilds[editingIndex] = {
            ...existingBuild,
            prints: additionalPrints,
            wax_protection: systemId ? { system_id: systemId, price: price } : null
          };
        } else {
          orderBuilds[editingIndex] = currentBuild;
        }
        localStorage.removeItem('editingBuildIndex');
      } else {
        orderBuilds.push(currentBuild);
      }
      
      localStorage.setItem('orderBuilds', JSON.stringify(orderBuilds));
      
      localStorage.removeItem('selectedPrints');
      localStorage.removeItem('editingBuildIndex');
      localStorage.removeItem('pendingBuild');
      
      navigate(createPageUrl("OrderSummary"));
    }
  };

  const handleAddMorePrintsYes = () => {
    setShowAddMoreDialog(false);
    const params = new URLSearchParams(window.location.search);
    navigate(createPageUrl(`PrintCatalog?${params.toString()}`));
  };

  const handleAddMorePrintsNo = () => {
    setShowAddMoreDialog(false);
    
    // Count only non-patch prints
    const nonPatchPrints = selectedPrints.filter(p => !p.tags?.includes('Patch'));
    
    if (nonPatchPrints.length === 0) {
      // Only patches, no wax protection needed - proceed directly
      const currentBuild = {
        color,
        style,
        size,
        garment: selectedGarment,
        prints: selectedPrints,
        wax_protection: null
      };
      
      const existingOrder = localStorage.getItem('orderBuilds');
      const orderBuilds = existingOrder ? JSON.parse(existingOrder) : [];
      
      if (isEditing && editingIndex !== null) {
        const existingBuild = orderBuilds[editingIndex];
        
        if (existingBuild?.isScannedItem && existingBuild?.isAssembly) {
          const additionalPrints = selectedPrints.filter(p => !p.isAssemblyLocked);
          orderBuilds[editingIndex] = {
            ...existingBuild,
            prints: additionalPrints,
            wax_protection: null
          };
        } else {
          orderBuilds[editingIndex] = currentBuild;
        }
        localStorage.removeItem('editingBuildIndex');
      } else {
        orderBuilds.push(currentBuild);
      }
      
      localStorage.setItem('orderBuilds', JSON.stringify(orderBuilds));
      localStorage.removeItem('selectedPrints');
      localStorage.removeItem('pendingBuild');
      localStorage.setItem('itemAddedToCart', 'true');
      navigate(createPageUrl("Home"));
      return;
    }
    
    setWaxProtectionAction('addToOrder');
    setShowWaxProtectionDialog(true);
  };


  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-light mb-2">
                {isEditing ? 'Edit Your Design' : 'Approve and Finalize'}
              </h1>
              <p className="text-muted-foreground font-light">
                Review and customize your selections
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <Button
                variant="outline"
                onClick={handleStartOver}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </Button>
              {selectedGarment && selectedPrints.length > 0 && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Price</p>
                  <p className="text-2xl font-light">
                    ${(selectedGarment.cost + selectedPrints.reduce((sum, p) => sum + (p.cost || 0), 0)).toFixed(2)}
                  </p>
                </div>
              )}
              <Button
                onClick={handleAddToOrder}
                disabled={!color || !style || !size || selectedPrints.length === 0}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEditing ? 'Update Cart' : 'Add To Cart'}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Main Layout with Info Cards on Left and Previews on Right */}
        <div className="grid md:grid-cols-[300px_1fr] gap-6 mb-12">
          {/* Left Column - Info Cards */}
          <div className="space-y-4">
            <Card
              className="cursor-pointer hover:shadow-xl transition-all duration-300 border-0 rounded-2xl"
              onClick={() => editSelection('color')}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 bg-pink-600 rounded-xl flex items-center justify-center">
                    <Palette className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-light">Garment Color</p>
                    <p className="text-lg font-light capitalize">
                      {color ? decodeURIComponent(color) : 'Not selected'}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full rounded-full">
                  Change Color
                </Button>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-xl transition-all duration-300 border-0 rounded-2xl"
              onClick={() => editSelection('style')}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Shirt className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-light">Garment Style</p>
                    <p className="text-lg font-light capitalize">
                      {style || 'Not selected'}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full rounded-full">
                  Change Style
                </Button>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-xl transition-all duration-300 border-0 rounded-2xl"
              onClick={() => editSelection('size')}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                    <Ruler className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-light">Garment Size</p>
                    <p className="text-lg font-light uppercase">
                      {size || 'Not selected'}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full rounded-full">
                  Change Size
                </Button>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-xl transition-all duration-300 border-0 rounded-2xl"
              onClick={() => editSelection('print')}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-light">Print Designs</p>
                    <p className="text-lg font-light">
                      {selectedPrints.length} selected
                    </p>
                    {selectedPrints.some(p => p.isAssemblyLocked) && (
                      <p className="text-xs text-yellow-500 mt-1">🔒 {selectedPrints.filter(p => p.isAssemblyLocked).length} locked</p>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full rounded-full">
                  {selectedPrints.some(p => p.isAssemblyLocked) ? 'Add More Prints' : 'Change Prints'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Preview Views in Grid */}
          <div className="grid grid-cols-2 gap-6">
            <PreviewCard
              title="Front View"
              garmentImage={selectedGarment?.front_image_url}
              viewType="front"
              garment={selectedGarment}
            />

            {!selectedGarment?.style?.toLowerCase().includes('sweatpants') && (
              <PreviewCard
                title="Back View"
                garmentImage={selectedGarment?.back_image_url}
                viewType="back"
                garment={selectedGarment}
              />
            )}

            {!selectedGarment?.style?.toLowerCase().includes('sweatpants') && !selectedGarment?.style?.toLowerCase().includes('toddler') && !(selectedGarment?.style?.toLowerCase().includes('youth') && !(selectedGarment?.style?.toLowerCase().includes('hoodie') || selectedGarment?.style?.toLowerCase().includes('zip'))) && selectedGarment?.rsleeve_image_url && (
              <PreviewCard
                title="Right Sleeve"
                garmentImage={selectedGarment?.rsleeve_image_url || selectedGarment?.rleg_image_url}
                viewType="right"
                garment={selectedGarment}
              />
            )}

            {!selectedGarment?.style?.toLowerCase().includes('sweatpants') && !selectedGarment?.style?.toLowerCase().includes('toddler') && !(selectedGarment?.style?.toLowerCase().includes('youth') && !(selectedGarment?.style?.toLowerCase().includes('hoodie') || selectedGarment?.style?.toLowerCase().includes('zip'))) && selectedGarment?.lsleeve_image_url && (
              <PreviewCard
                title="Left Sleeve"
                garmentImage={selectedGarment?.lsleeve_image_url || selectedGarment?.lleg_image_url}
                viewType="left"
                garment={selectedGarment}
              />
            )}
          </div>
        </div>


      </div>

      <Dialog open={showStyleDialog} onOpenChange={(open) => {
        setShowStyleDialog(open);
        if (!open) {
          setStyleDialogStep(1);
          setTempSelection({ style: null, color: null, size: null });
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {styleDialogStep === 1 && 'Choose Style'}
              {styleDialogStep === 2 && `Choose Color for ${tempSelection.style}`}
              {styleDialogStep === 3 && `Choose Size for ${tempSelection.style} - ${tempSelection.color}`}
            </DialogTitle>
          </DialogHeader>
          
          {styleDialogStep === 1 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
              {availableStyles.map((styleGarment) => (
                <motion.div
                  key={styleGarment.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`cursor-pointer ${style === styleGarment.style ? 'ring-4 ring-ring' : ''} rounded-xl overflow-hidden bg-muted`}
                  onClick={() => handleStyleSelect(styleGarment.style)}
                >
                  <div className="h-40 bg-card flex items-center justify-center p-4">
                    <SvgImage
                      src={styleGarment.front_image_url}
                      alt={styleGarment.style}
                      className="w-full h-full"
                      fallback={<div className="text-4xl text-gray-400">👕</div>}
                    />
                  </div>
                  <p className="text-sm text-center p-3">
                    {styleGarment.style}
                  </p>
                </motion.div>
              ))}
            </div>
          )}

          {styleDialogStep === 2 && (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-4 p-4">
              {availableColors.map((colorOption) => (
                <motion.div
                  key={colorOption.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`cursor-pointer ${color === colorOption.name ? 'ring-4 ring-ring' : ''} rounded-xl overflow-hidden`}
                  onClick={() => handleStyleDialogColorSelect(colorOption.name)}
                >
                  {colorOption.image_url ? (
                    <img 
                      src={colorOption.image_url} 
                      alt={colorOption.name}
                      className="aspect-square rounded-xl object-cover w-full h-full scale-105"
                    />
                  ) : (
                    <div className="aspect-square rounded-xl bg-muted flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">No image</span>
                    </div>
                  )}
                  <p className="text-xs text-center mt-2 capitalize">
                    {colorOption.name}
                  </p>
                </motion.div>
              ))}
            </div>
          )}

          {styleDialogStep === 3 && (
            <div className="flex justify-center flex-wrap gap-4 p-4">
              {availableSizes.map((sizeOption) => (
                <motion.button
                  key={sizeOption}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleStyleDialogSizeSelect(sizeOption)}
                  className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center text-2xl font-light transition-all duration-300 ${
                    size === sizeOption 
                      ? 'bg-primary text-primary-foreground border-primary' 
                      : 'bg-card border-border hover:border-ring'
                  }`}
                >
                  {sizeOption}
                </motion.button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showColorDialog} onOpenChange={setShowColorDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose Color</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-4 p-4">
            {availableColors.map((colorOption) => (
              <motion.div
                key={colorOption.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`cursor-pointer ${color === colorOption.name ? 'ring-4 ring-ring' : ''} rounded-xl overflow-hidden`}
                onClick={() => handleColorSelect(colorOption.name)}
              >
                {colorOption.image_url ? (
                  <img 
                    src={colorOption.image_url} 
                    alt={colorOption.name}
                    className="aspect-square rounded-xl object-cover w-full h-full scale-105"
                  />
                ) : (
                  <div className="aspect-square rounded-xl bg-muted flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">No image</span>
                  </div>
                )}
                <p className="text-xs text-center mt-2 capitalize">
                  {colorOption.name}
                </p>
              </motion.div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSizeDialog} onOpenChange={setShowSizeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Size</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center flex-wrap gap-4 p-4">
            {availableSizes.map((sizeOption) => (
              <motion.button
                key={sizeOption}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSizeSelect(sizeOption)}
                className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center text-2xl font-light transition-all duration-300 ${
                  size === sizeOption 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-card border-border hover:border-ring'
                }`}
              >
                {sizeOption}
              </motion.button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddMoreDialog} onOpenChange={setShowAddMoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add More Prints?</DialogTitle>
            <DialogDescription>
              Do you want to add any more prints to this design?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={handleAddMorePrintsYes}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Yes
            </Button>
            <Button
              onClick={handleAddMorePrintsNo}
              variant="secondary"
              className="flex-1"
            >
              No
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      <Dialog open={showPrintChangeDialog} onOpenChange={setShowPrintChangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prints Don't Fit</DialogTitle>
            <DialogDescription>
              Some of your selected prints are too large for this {pendingChange?.type}. Would you like to change your prints or keep your original {pendingChange?.type}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={handleKeepOriginal}
              variant="outline"
              className="flex-1"
            >
              Keep Original
            </Button>
            <Button
              onClick={handleChangePrints}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              Change Prints
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showWaxProtectionDialog} onOpenChange={(open) => {
        setShowWaxProtectionDialog(open);
        if (!open) {
          setShowDiscountedOptions(false);
          setCustomWaxPrice('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {showDiscountedOptions ? 'Custom Wax Price' : 'Do you want the wax protection?'}
            </DialogTitle>
            {showDiscountedOptions && (
              <DialogDescription>
                Enter the final wax protection price. Original price: ${getRecommendedWaxPrice()}
              </DialogDescription>
            )}
          </DialogHeader>
          {showDiscountedOptions ? (
            <div className="space-y-4 mt-6">
              <div className="flex items-center gap-2">
                <span className="text-foreground text-lg">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customWaxPrice}
                  onChange={(e) => setCustomWaxPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customWaxPrice.trim()) {
                      const customPrice = parseFloat(customWaxPrice);
                      if (isNaN(customPrice) || customPrice < 0) {
                        alert('Please enter a valid price');
                        return;
                      }
                      const recommendedPrice = getRecommendedWaxPrice();
                      const systemId = recommendedPrice === 10 ? '210000009650' : '210000010665';
                      const itemID = recommendedPrice === 10 ? '9644' : '10659';
                      const discountAmount = recommendedPrice - customPrice;
                      
                      const currentBuild = {
                        color,
                        style,
                        size,
                        garment: selectedGarment,
                        prints: selectedPrints,
                        wax_protection: {
                          system_id: systemId,
                          itemID: itemID,
                          name: `Wax Protection - $${recommendedPrice}`,
                          price: recommendedPrice,
                          discountAmount: discountAmount > 0 ? discountAmount : 0,
                          finalPrice: customPrice
                        }
                      };
                      
                      if (waxProtectionAction === 'addToOrder') {
                        const existingOrder = localStorage.getItem('orderBuilds');
                        const orderBuilds = existingOrder ? JSON.parse(existingOrder) : [];
                        
                        if (isEditing && editingIndex !== null) {
                          const existingBuild = orderBuilds[editingIndex];
                          if (existingBuild?.isScannedItem && existingBuild?.isAssembly) {
                            const additionalPrints = selectedPrints.filter(p => !p.isAssemblyLocked);
                            orderBuilds[editingIndex] = {
                              ...existingBuild,
                              prints: additionalPrints,
                              wax_protection: currentBuild.wax_protection
                            };
                          } else {
                            orderBuilds[editingIndex] = currentBuild;
                          }
                          localStorage.removeItem('editingBuildIndex');
                        } else {
                          orderBuilds.push(currentBuild);
                        }
                        
                        localStorage.setItem('orderBuilds', JSON.stringify(orderBuilds));
                        localStorage.removeItem('selectedPrints');
                        localStorage.removeItem('pendingBuild');
                        localStorage.setItem('itemAddedToCart', 'true');
                        navigate(createPageUrl("Home"));
                      } else if (waxProtectionAction === 'placeOrder') {
                        const existingOrder = localStorage.getItem('orderBuilds');
                        const orderBuilds = existingOrder ? JSON.parse(existingOrder) : [];
                        
                        if (isEditing && editingIndex !== null) {
                          const existingBuild = orderBuilds[editingIndex];
                          if (existingBuild?.isScannedItem && existingBuild?.isAssembly) {
                            const additionalPrints = selectedPrints.filter(p => !p.isAssemblyLocked);
                            orderBuilds[editingIndex] = {
                              ...existingBuild,
                              prints: additionalPrints,
                              wax_protection: currentBuild.wax_protection
                            };
                          } else {
                            orderBuilds[editingIndex] = currentBuild;
                          }
                          localStorage.removeItem('editingBuildIndex');
                        } else {
                          orderBuilds.push(currentBuild);
                        }
                        
                        localStorage.setItem('orderBuilds', JSON.stringify(orderBuilds));
                        localStorage.removeItem('selectedPrints');
                        localStorage.removeItem('editingBuildIndex');
                        localStorage.removeItem('pendingBuild');
                        navigate(createPageUrl("OrderSummary"));
                      }
                      
                      setShowWaxProtectionDialog(false);
                      setShowDiscountedOptions(false);
                      setCustomWaxPrice('');
                    }
                  }}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This will apply ${getRecommendedWaxPrice()} wax protection with a discount to reach your entered price
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowDiscountedOptions(false);
                    setCustomWaxPrice('');
                    setShowWaxProtectionDialog(false);
                    setShowFirstTimeWaxDialog(false);
                    
                    const currentBuild = {
                      color,
                      style,
                      size,
                      garment: selectedGarment,
                      prints: selectedPrints,
                      wax_protection: null
                    };

                    if (waxProtectionAction === 'addToOrder') {
                      const existingOrder = localStorage.getItem('orderBuilds');
                      const orderBuilds = existingOrder ? JSON.parse(existingOrder) : [];

                      if (isEditing && editingIndex !== null) {
                        const existingBuild = orderBuilds[editingIndex];
                        
                        if (existingBuild?.isScannedItem && existingBuild?.isAssembly) {
                          const additionalPrints = selectedPrints.filter(p => !p.isAssemblyLocked);
                          orderBuilds[editingIndex] = {
                            ...existingBuild,
                            prints: additionalPrints,
                            wax_protection: null
                          };
                        } else {
                          orderBuilds[editingIndex] = currentBuild;
                        }
                        localStorage.removeItem('editingBuildIndex');
                      } else {
                        orderBuilds.push(currentBuild);
                      }

                      localStorage.setItem('orderBuilds', JSON.stringify(orderBuilds));
                      localStorage.removeItem('selectedPrints');
                      localStorage.removeItem('pendingBuild');
                      localStorage.setItem('itemAddedToCart', 'true');
                      navigate(createPageUrl("Home"));
                          } else if (waxProtectionAction === 'placeOrder') {
                      const existingOrder = localStorage.getItem('orderBuilds');
                      const orderBuilds = existingOrder ? JSON.parse(existingOrder) : [];

                      if (isEditing && editingIndex !== null) {
                        const existingBuild = orderBuilds[editingIndex];
                        
                        if (existingBuild?.isScannedItem && existingBuild?.isAssembly) {
                          const additionalPrints = selectedPrints.filter(p => !p.isAssemblyLocked);
                          orderBuilds[editingIndex] = {
                            ...existingBuild,
                            prints: additionalPrints,
                            wax_protection: null
                          };
                        } else {
                          orderBuilds[editingIndex] = currentBuild;
                        }
                        localStorage.removeItem('editingBuildIndex');
                      } else {
                        orderBuilds.push(currentBuild);
                      }

                      localStorage.setItem('orderBuilds', JSON.stringify(orderBuilds));
                      localStorage.removeItem('selectedPrints');
                      localStorage.removeItem('editingBuildIndex');
                      localStorage.removeItem('pendingBuild');
                      navigate(createPageUrl("OrderSummary"));
                    }
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  No
                </Button>
                <Button
                  onClick={() => {
                    const customPrice = parseFloat(customWaxPrice);
                    if (isNaN(customPrice) || customPrice < 0) {
                      alert('Please enter a valid price');
                      return;
                    }
                    const recommendedPrice = getRecommendedWaxPrice();
                    const systemId = recommendedPrice === 10 ? '210000009650' : '210000010665';
                    const itemID = recommendedPrice === 10 ? '9644' : '10659';
                    const discountAmount = recommendedPrice - customPrice;
                    
                    const currentBuild = {
                      color,
                      style,
                      size,
                      garment: selectedGarment,
                      prints: selectedPrints,
                      wax_protection: {
                        system_id: systemId,
                        itemID: itemID,
                        name: `Wax Protection - $${recommendedPrice}`,
                        price: recommendedPrice,
                        discountAmount: discountAmount > 0 ? discountAmount : 0,
                        finalPrice: customPrice
                      }
                    };
                    
                    if (waxProtectionAction === 'addToOrder') {
                      const existingOrder = localStorage.getItem('orderBuilds');
                      const orderBuilds = existingOrder ? JSON.parse(existingOrder) : [];
                      
                      if (isEditing && editingIndex !== null) {
                        const existingBuild = orderBuilds[editingIndex];
                        if (existingBuild?.isScannedItem && existingBuild?.isAssembly) {
                          const additionalPrints = selectedPrints.filter(p => !p.isAssemblyLocked);
                          orderBuilds[editingIndex] = {
                            ...existingBuild,
                            prints: additionalPrints,
                            wax_protection: currentBuild.wax_protection
                          };
                        } else {
                          orderBuilds[editingIndex] = currentBuild;
                        }
                        localStorage.removeItem('editingBuildIndex');
                      } else {
                        orderBuilds.push(currentBuild);
                      }
                      
                      localStorage.setItem('orderBuilds', JSON.stringify(orderBuilds));
                      localStorage.removeItem('selectedPrints');
                      localStorage.removeItem('pendingBuild');
                      localStorage.setItem('itemAddedToCart', 'true');
                      navigate(createPageUrl("Home"));
                    } else if (waxProtectionAction === 'placeOrder') {
                      const existingOrder = localStorage.getItem('orderBuilds');
                      const orderBuilds = existingOrder ? JSON.parse(existingOrder) : [];
                      
                      if (isEditing && editingIndex !== null) {
                        const existingBuild = orderBuilds[editingIndex];
                        if (existingBuild?.isScannedItem && existingBuild?.isAssembly) {
                          const additionalPrints = selectedPrints.filter(p => !p.isAssemblyLocked);
                          orderBuilds[editingIndex] = {
                            ...existingBuild,
                            prints: additionalPrints,
                            wax_protection: currentBuild.wax_protection
                          };
                        } else {
                          orderBuilds[editingIndex] = currentBuild;
                        }
                        localStorage.removeItem('editingBuildIndex');
                      } else {
                        orderBuilds.push(currentBuild);
                      }
                      
                      localStorage.setItem('orderBuilds', JSON.stringify(orderBuilds));
                      localStorage.removeItem('selectedPrints');
                      localStorage.removeItem('editingBuildIndex');
                      localStorage.removeItem('pendingBuild');
                      navigate(createPageUrl("OrderSummary"));
                    }
                    
                    setShowWaxProtectionDialog(false);
                    setShowDiscountedOptions(false);
                    setCustomWaxPrice('');
                  }}
                  disabled={!customWaxPrice.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Apply
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 mt-6">
              <Button
                onClick={() => {
                  const nonPatchCount = selectedPrints.filter(p => !p.tags?.includes('Patch')).length;
                  if (nonPatchCount === 1) {
                    handleWaxProtectionSelection('210000009650', 10);
                  } else {
                    handleWaxProtectionSelection('210000010665', 15);
                  }
                }}
                className="h-20 text-lg bg-green-600 hover:bg-green-700 text-white"
              >
                Yes<br/>${selectedPrints.filter(p => !p.tags?.includes('Patch')).length === 1 ? '10' : '15'}
              </Button>
              <Button
                onClick={() => handleWaxProtectionSelection(null, 0)}
                variant="secondary"
                className="h-20 text-lg"
              >
                No
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPreprintDialog} onOpenChange={setShowPreprintDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Preprint Available!</DialogTitle>
            <DialogDescription>
              This design matches preprint {matchedPreprint?.preprint_system_id}
            </DialogDescription>
          </DialogHeader>
          
          {!preprintInventory ? (
            <div className="mt-6">
              <Button
                onClick={handleCheckInventory}
                disabled={checkingInventory}
                className="w-full h-16 text-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                {checkingInventory ? 'Checking...' : 'Check Inventory'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 mt-6">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-foreground">
                  <span className="font-bold">Available:</span> {preprintInventory.available}
                </p>
                <p className="text-foreground">
                  <span className="font-bold">Needed:</span> {preprintInventory.needed}
                </p>
              </div>
              
              {preprintInventory.available >= preprintInventory.needed ? (
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={handleUsePreprint}
                    className="h-16 text-lg bg-green-600 hover:bg-green-700 text-white"
                  >
                    Use Preprint
                  </Button>
                  <Button
                    onClick={handleProduceAnyway}
                    className="h-16 text-lg bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    Produce Anyway
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleProduceAnyway}
                  className="w-full h-16 text-lg bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  Produce (No Inventory)
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showFirstTimeWaxDialog} onOpenChange={setShowFirstTimeWaxDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Have you ever had the wax protection?</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <Button
              onClick={() => {
                setShowFirstTimeWaxDialog(false);
                const currentBuild = {
                  color,
                  style,
                  size,
                  garment: selectedGarment,
                  prints: selectedPrints,
                  wax_protection: null
                };

                if (waxProtectionAction === 'addToOrder') {
                  const existingOrder = localStorage.getItem('orderBuilds');
                  const orderBuilds = existingOrder ? JSON.parse(existingOrder) : [];

                  if (isEditing && editingIndex !== null) {
                    const existingBuild = orderBuilds[editingIndex];
                    
                    if (existingBuild?.isScannedItem && existingBuild?.isAssembly) {
                      const additionalPrints = selectedPrints.filter(p => !p.isAssemblyLocked);
                      orderBuilds[editingIndex] = {
                        ...existingBuild,
                        prints: additionalPrints,
                        wax_protection: null
                      };
                    } else {
                      orderBuilds[editingIndex] = currentBuild;
                    }
                    localStorage.removeItem('editingBuildIndex');
                  } else {
                    orderBuilds.push(currentBuild);
                  }

                  localStorage.setItem('orderBuilds', JSON.stringify(orderBuilds));
                  localStorage.removeItem('selectedPrints');
                  localStorage.removeItem('pendingBuild');
                  localStorage.setItem('itemAddedToCart', 'true');
                  navigate(createPageUrl("Home"));
                } else if (waxProtectionAction === 'placeOrder') {
                  const existingOrder = localStorage.getItem('orderBuilds');
                  const orderBuilds = existingOrder ? JSON.parse(existingOrder) : [];

                  if (isEditing && editingIndex !== null) {
                    const existingBuild = orderBuilds[editingIndex];
                    
                    if (existingBuild?.isScannedItem && existingBuild?.isAssembly) {
                      const additionalPrints = selectedPrints.filter(p => !p.isAssemblyLocked);
                      orderBuilds[editingIndex] = {
                        ...existingBuild,
                        prints: additionalPrints,
                        wax_protection: null
                      };
                    } else {
                      orderBuilds[editingIndex] = currentBuild;
                    }
                    localStorage.removeItem('editingBuildIndex');
                  } else {
                    orderBuilds.push(currentBuild);
                  }

                  localStorage.setItem('orderBuilds', JSON.stringify(orderBuilds));
                  localStorage.removeItem('selectedPrints');
                  localStorage.removeItem('editingBuildIndex');
                  localStorage.removeItem('pendingBuild');
                  navigate(createPageUrl("OrderSummary"));
                }
              }}
              variant="secondary"
              className="h-20 text-lg"
            >
              Yes
            </Button>
            <Button
              onClick={() => {
                setShowFirstTimeWaxDialog(false);
                setShowDiscountedOptions(true);
                setShowWaxProtectionDialog(true);
              }}
              variant="secondary"
              className="h-20 text-lg"
            >
              No
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}