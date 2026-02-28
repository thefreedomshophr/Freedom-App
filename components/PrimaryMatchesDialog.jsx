import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X, Check } from "lucide-react";
import SvgImageWithPrint from "./SvgImageWithPrint";

export default function PrimaryMatchesDialog({ 
  open, 
  onClose, 
  selectedPrint, 
  selectedGarment,
  onConfirm,
  currentView,
  styleConfig 
}) {
  const [matchedPrints, setMatchedPrints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [replacementDialog, setReplacementDialog] = useState(null);
  const [showingSecondary, setShowingSecondary] = useState(false);
  const [customNotesDialog, setCustomNotesDialog] = useState(null);
  const [customNotes, setCustomNotes] = useState('');
  const [showSimilarDialog, setShowSimilarDialog] = useState(false);
  const [printDoesntFitDialog, setPrintDoesntFitDialog] = useState(null);
  const [placementDisplayNames, setPlacementDisplayNames] = useState({});

  useEffect(() => {
    const loadPlacementDisplayNames = async () => {
      try {
        const placements = await base44.entities.Placement.list();
        const nameMap = {};
        placements.forEach(p => {
          nameMap[p.name] = p.display_name;
        });
        setPlacementDisplayNames(nameMap);
      } catch (error) {
        console.error('Error loading placement display names:', error);
      }
    };
    
    loadPlacementDisplayNames();
  }, []);

  useEffect(() => {
    if (open && selectedPrint) {
      loadExistingSelections();
    } else if (!open) {
      // Reset selections when dialog closes
      setSelections([]);
    }
  }, [open, selectedPrint]);

  const loadExistingSelections = async () => {
    // Load existing prints from localStorage to prevent conflicts
    const storedPrints = localStorage.getItem('selectedPrints');
    let existingPrintObjects = [];
    if (storedPrints) {
      try {
        const existingPrints = JSON.parse(storedPrints);
        existingPrintObjects = existingPrints.filter(print => print.placement);
        
        // Load all preprints to find placement data
        const allPreprints = await base44.entities.Preprint.list();
        
        // Apply placements for assembly locked prints using preprint data
        const existingSelections = existingPrintObjects.map(print => {
          let placement = print.placement;
          
          // ONLY load placement from preprint entity for assembly locked items
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
                console.log('[PrimaryMatchesDialog] Using preprint placement:', {
                  name: print.name,
                  system_id: print.system_id,
                  preprint_id: matchingPreprint.preprint_system_id,
                  assigned_placement: preprintPlacement
                });
                
                placement = preprintPlacement;
              }
            }
          }
          
          return { 
            printId: print.id, 
            placement: placement,
            isAssemblyLocked: print.isAssemblyLocked || false
          };
        });
        
        setSelections(existingSelections);
        
        // Now load primary/secondary matches
        await loadMatchesAfterExisting(existingPrintObjects);
      } catch (error) {
        console.error('Error loading existing prints:', error);
        setSelections([]);
        await loadMatchesAfterExisting([]);
      }
    } else {
      setSelections([]);
      await loadMatchesAfterExisting([]);
    }
  };

  const loadMatchesAfterExisting = async (existingPrintObjects) => {
    // Always show the selected print + any primary/secondary matches
    const hasPrimaryMatches = selectedPrint.primary_matches && selectedPrint.primary_matches.trim();
    const hasSecondaryMatches = selectedPrint.secondary_matches && selectedPrint.secondary_matches.trim();
    
    // If no matches at all, just show the selected print
    if (!hasPrimaryMatches && !hasSecondaryMatches) {
      // Show only the selected print
      setMatchedPrints([selectedPrint, ...existingPrintObjects.filter(p => p.id !== selectedPrint.id)]);
      setShowingSecondary(false);
      setLoading(false);
      return;
    }
    
    // If no primary matches but has secondary matches, load secondary directly
    if (!hasPrimaryMatches && hasSecondaryMatches) {
      await loadSecondaryMatches(existingPrintObjects);
    } else {
      await loadPrimaryMatches(existingPrintObjects);
    }
  };

  const loadPrimaryMatches = async (existingPrintObjects = []) => {
    setLoading(true);
    try {
      const primaryMatchIds = selectedPrint.primary_matches?.split(',').map(id => id.trim()).filter(Boolean) || [];
      
      // Get all prints and filter for primary matches
      const allPrints = await base44.entities.Print.filter({ is_active: true });
      let matches = allPrints.filter(p => primaryMatchIds.includes(p.system_id));
      
      // Filter out leg prints for top garments
      const isSweatpants = selectedGarment?.style?.toLowerCase().includes('sweatpants');
      if (!isSweatpants) {
        matches = matches.filter(p => {
          const isLegPrint = p.print_size?.includes('Leg') || p.garment_type === 'bottoms';
          return !isLegPrint;
        });
      }
      
      // Filter out sleeve prints for T-Shirt garments
      const isTShirt = selectedGarment?.style?.toLowerCase().includes('t-shirt') || 
                       selectedGarment?.style?.toLowerCase().includes('tshirt') ||
                       selectedGarment?.style?.toLowerCase().includes('t shirt');
      if (isTShirt) {
        matches = matches.filter(p => {
          const isSleevePrint = p.print_size === 'Sleeve';
          return !isSleevePrint;
        });
      }
      
      // Combine: selected print + locked/selected prints from localStorage + primary matches (avoiding duplicates)
      const allPrintsToShow = [selectedPrint];
      const addedIds = new Set([selectedPrint.id]);
      
      // Add existing prints from localStorage FIRST (these include locked assembly prints)
      for (const print of existingPrintObjects) {
        if (!addedIds.has(print.id)) {
          allPrintsToShow.push(print);
          addedIds.add(print.id);
        }
      }
      
      for (const print of matches) {
        if (!addedIds.has(print.id)) {
          allPrintsToShow.push(print);
          addedIds.add(print.id);
        }
      }
      
      setMatchedPrints(allPrintsToShow);
      
      setShowingSecondary(false);
    } catch (error) {
      console.error('Error loading primary matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSecondaryMatches = async (existingPrintObjects = []) => {
    setLoading(true);
    try {
      const secondaryMatchIds = selectedPrint.secondary_matches?.split(',').map(id => id.trim()).filter(Boolean) || [];
      
      // Get all prints and filter for secondary matches
      const allPrints = await base44.entities.Print.filter({ is_active: true });
      let matches = allPrints.filter(p => secondaryMatchIds.includes(p.system_id));
      
      // Filter out leg prints for top garments
      const isSweatpants = selectedGarment?.style?.toLowerCase().includes('sweatpants');
      if (!isSweatpants) {
        matches = matches.filter(p => {
          const isLegPrint = p.print_size?.includes('Leg') || p.garment_type === 'bottoms';
          return !isLegPrint;
        });
      }
      
      // Filter out sleeve prints for T-Shirt garments
      const isTShirt = selectedGarment?.style?.toLowerCase().includes('t-shirt') || 
                       selectedGarment?.style?.toLowerCase().includes('tshirt') ||
                       selectedGarment?.style?.toLowerCase().includes('t shirt');
      if (isTShirt) {
        matches = matches.filter(p => {
          const isSleevePrint = p.print_size === 'Sleeve';
          return !isSleevePrint;
        });
      }
      
      // Get ALL currently selected print IDs from selections state
      const currentlySelectedPrintIds = selections.map(s => s.printId);
      
      // Find all those prints in allPrints (to get full print objects)
      const currentlySelectedPrintObjects = allPrints.filter(p => currentlySelectedPrintIds.includes(p.id));
      
      // Combine: selected print + currently selected prints + existing prints from localStorage + secondary matches (avoiding duplicates)
      const allPrintsToShow = [selectedPrint];
      const addedIds = new Set([selectedPrint.id]);
      
      // Add currently selected prints FIRST (these are prints user just selected)
      for (const print of currentlySelectedPrintObjects) {
        if (!addedIds.has(print.id)) {
          allPrintsToShow.push(print);
          addedIds.add(print.id);
        }
      }
      
      // Add existing prints from localStorage (these include locked assembly prints)
      for (const print of existingPrintObjects) {
        if (!addedIds.has(print.id)) {
          allPrintsToShow.push(print);
          addedIds.add(print.id);
        }
      }
      
      // Add secondary matches
      for (const print of matches) {
        if (!addedIds.has(print.id)) {
          allPrintsToShow.push(print);
          addedIds.add(print.id);
        }
      }
      
      setMatchedPrints(allPrintsToShow);
      
      setShowingSecondary(true);
    } catch (error) {
      console.error('Error loading secondary matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailablePlacementsForPrint = (print) => {
    if (!print || !selectedGarment || !styleConfig) return [];
    
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
      'Leg': 'leg_placements',
      'Oversize': 'oversize_placements',
      'Patch': 'patch_placements'
    };
    
    const printSizeKey = printSizeToKey[print.print_size];
    if (!printSizeKey || !styleConfig[printSizeKey]) return [];
    
    // Get placements from style config only - never fallback to print data
    let placements = styleConfig[printSizeKey].map(p => p.name);
    
    // Filter out placements that are already occupied by ANY print (including locked ones)
    placements = placements.filter(placement => {
      // Check if any OTHER print is already using this exact placement or print area
      const isOccupied = selections.some(s => {
        if (s.printId === print.id) return false; // Allow same print to have multiple placements
        
        // Direct placement name match - ALWAYS block if exact match
        if (s.placement === placement) {
          console.log('[Filter] Blocking placement - exact match:', { 
            placement, 
            existingPrint: s.printId,
            isLocked: s.isAssemblyLocked 
          });
          return true;
        }
        
        // Check print area conflicts only if we can find the print
        const existingPrint = matchedPrints.find(p => p.id === s.printId);
        if (existingPrint) {
          const conflicts = placementsConflict(s.placement, placement, existingPrint, print);
          if (conflicts) {
            console.log('[Filter] Blocking placement - area conflict:', { 
              placement, 
              existingPlacement: s.placement,
              isLocked: s.isAssemblyLocked 
            });
          }
          return conflicts;
        }
        
        // If we can't find the print but have the same placement name, still block it
        return false;
      });
      return !isOccupied;
    });
    
    // Always add Custom placement for special instructions
    if (!placements.includes('Custom')) {
      return [...placements, 'Custom'];
    }
    
    return placements;
  };

  const checkPrintFits = (print, placement) => {
    if (!print.width || !print.height || !selectedGarment) return true;
    
    const placementLower = placement.toLowerCase();
    let maxWidth, maxHeight;
    
    // Determine which garment view dimensions to use
    if (placementLower.includes('front') || placementLower.includes('chest') || placementLower.includes('crest')) {
      maxWidth = selectedGarment.front_max_print_width;
      maxHeight = selectedGarment.front_max_print_height;
    } else if (placementLower.includes('back')) {
      maxWidth = selectedGarment.back_max_print_width;
      maxHeight = selectedGarment.back_max_print_height;
    } else if (placementLower.includes('right') && placementLower.includes('sleeve')) {
      maxWidth = selectedGarment.rsleeve_max_print_width;
      maxHeight = selectedGarment.rsleeve_max_print_height;
    } else if (placementLower.includes('left') && placementLower.includes('sleeve')) {
      maxWidth = selectedGarment.lsleeve_max_print_width;
      maxHeight = selectedGarment.lsleeve_max_print_height;
    } else if (placementLower.includes('right') && placementLower.includes('leg')) {
      maxWidth = selectedGarment.rsleeve_max_print_width;
      maxHeight = selectedGarment.rsleeve_max_print_height;
    } else if (placementLower.includes('left') && placementLower.includes('leg')) {
      maxWidth = selectedGarment.lsleeve_max_print_width;
      maxHeight = selectedGarment.lsleeve_max_print_height;
    }
    
    if (!maxWidth || !maxHeight) return true;
    
    return print.width <= maxWidth && print.height <= maxHeight;
  };

  const handlePlacementChange = (printId, placement) => {
    // Check if this exact print+placement combination already exists
    const alreadyExists = selections.some(s => s.printId === printId && s.placement === placement);
    if (alreadyExists) {
      return; // Do nothing if already selected
    }
    
    // If Custom placement, show notes dialog
    if (placement === 'Custom') {
      const print = matchedPrints.find(p => p.id === printId);
      setCustomNotesDialog({ printId, print });
      setCustomNotes('');
      return;
    }
    
    // Check if print fits in this placement
    const print = matchedPrints.find(p => p.id === printId);
    if (print && !checkPrintFits(print, placement)) {
      setPrintDoesntFitDialog({ printId, placement, print });
      return;
    }
    
    // Check if this placement conflicts with any existing placement from ANY print (including locked)
    const conflictingEntry = selections.find(s => {
      if (s.printId === printId) return false;
      const existingPrint = matchedPrints.find(p => p.id === s.printId);
      return s.placement === placement || placementsConflict(s.placement, placement, existingPrint, print);
    });
    
    if (conflictingEntry) {
      // If the conflicting print is locked, don't allow placement at all
      if (conflictingEntry.isAssemblyLocked) {
        alert('Cannot place print here - this area is locked by a preprinted item.');
        return;
      }
      
      // Otherwise, offer to replace
      const existingPrint = matchedPrints.find(p => p.id === conflictingEntry.printId);
      const currentPrint = matchedPrints.find(p => p.id === printId);
      
      setReplacementDialog({
        existingPrint,
        existingPrintId: conflictingEntry.printId,
        existingPlacement: conflictingEntry.placement,
        newPrint: currentPrint,
        newPrintId: printId,
        placement
      });
    } else {
      setSelections(prev => [...prev, { printId, placement }]);
    }
  };

  const handleRemoveSelection = (printId, placement) => {
    // Don't allow removing locked prints
    const selectionToRemove = selections.find(s => s.printId === printId && s.placement === placement);
    if (selectionToRemove?.isAssemblyLocked) {
      return; // Silently ignore attempts to remove locked prints
    }
    setSelections(prev => prev.filter(s => !(s.printId === printId && s.placement === placement)));
  };

  const handleConfirmCustomNotes = () => {
    if (!customNotes.trim() || !customNotesDialog) return;
    
    setSelections(prev => [...prev, { 
      printId: customNotesDialog.printId, 
      placement: 'Custom',
      notes: customNotes.trim()
    }]);
    
    setCustomNotesDialog(null);
    setCustomNotes('');
  };

  const handleContinue = () => {
    if (!showingSecondary) {
      setShowSimilarDialog(true);
    } else {
      setShowPreview(true);
    }
  };

  const handleLoadSecondaryMatches = () => {
    // Get current selected prints from selections state
    const currentlySelectedPrints = selections.map(({ printId }) => {
      return matchedPrints.find(p => p.id === printId);
    }).filter(Boolean);
    
    loadSecondaryMatches(currentlySelectedPrints);
  };

  const handleConfirmSelections = () => {
    // Build the final array of prints with placements
    const selectedPrintsWithPlacements = selections.map(({ printId, placement, notes, isAssemblyLocked }) => {
      const print = matchedPrints.find(p => p.id === printId);
      return {
        ...print,
        placement: placement,
        notes: notes,
        isAssemblyLocked: isAssemblyLocked || false
      };
    });
    
    onConfirm(selectedPrintsWithPlacements);
    setShowPreview(false);
    setSelections([]);
  };

  const handleBackToSelection = () => {
    setShowPreview(false);
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
      'Leg': 'leg_placements',
      'Oversize': 'oversize_placements',
      'Patch': 'patch_placements'
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

  const placementsConflict = (placement1, placement2, print1, print2) => {
    if (!styleConfig || !print1?.print_size || !print2?.print_size) return false;
    
    // Get the print areas for both placements using style config
    const getPlacementArea = (placement, printSize) => {
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
        'Leg': 'leg_placements',
        'Oversize': 'oversize_placements',
        'Patch': 'patch_placements'
      };
      
      const printSizeKey = printSizeToKey[printSize];
      if (!printSizeKey || !styleConfig[printSizeKey]) return null;
      
      const config = styleConfig[printSizeKey].find(p => p.name === placement);
      return config?.print_area;
    };
    
    const area1 = getPlacementArea(placement1, print1.print_size);
    const area2 = getPlacementArea(placement2, print2.print_size);
    
    // Conflict if both placements map to the same print area
    return area1 && area2 && area1 === area2;
  };

  const getPrintsForView = (viewType) => {
    const isSweatpants = selectedGarment?.style?.toLowerCase().includes('sweatpants');
    
    return selections
      .filter(s => {
        const print = matchedPrints.find(p => p.id === s.printId);
        const placementLower = (s.placement || '').toLowerCase().replace(/ /g, '_');
        
        // For sweatpants, only show prints on front view if they're leg placements
        if (isSweatpants) {
          if (viewType === 'front') {
            return placementLower === 'right_leg' || placementLower === 'left_leg' || placementLower === 'standard';
          }
          return false;
        }
        
        // For other garments, use the style config mapping
        return getViewForPlacement(s.placement, print) === viewType;
      })
      .map(({ printId, placement }) => {
        const print = matchedPrints.find(p => p.id === printId);
        return { ...print, placement };
      });
  };

  const placementLabels = {
    'Front Center': 'Front Center',
    'Front Left Crest': 'Front Left Crest',
    'Front Left Chest': 'Front Left Chest',
    'Front Right Chest': 'Front Right Chest',
    'Back Center': 'Back Center',
    'Back Shoulder': 'Back Shoulder',
    'Right Sleeve': 'Right Sleeve',
    'Left Sleeve': 'Left Sleeve',
    'Right Leg': 'Right Leg',
    'Left Leg': 'Left Leg',
    'standard': 'Standard',
    'Custom': 'Custom (Special Instructions)',
  };

  if (!open) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {showPreview ? 'Preview Print Selections' : 'More Prints From The Set'}
          </DialogTitle>
          <DialogDescription>
            {showPreview 
              ? 'Review your print placements before confirming'
              : 'Select placements for each print in this set'
            }
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto"></div>
            <p className="text-muted-foreground mt-4">Loading prints...</p>
          </div>
        ) : showPreview ? (
          // Preview Mode
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {selectedGarment?.front_image_url && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-2">{selectedGarment.style?.toLowerCase().includes('sweatpants') ? 'Sweatpants' : 'Front View'}</h3>
                    <div className="bg-muted rounded-lg h-64 flex items-center justify-center">
                      <SvgImageWithPrint
                        garmentSrc={selectedGarment.front_image_url}
                        prints={getPrintsForView('front')}
                        maxPrintWidth={selectedGarment.style?.toLowerCase().includes('sweatpants') ? selectedGarment.rsleeve_max_print_width : selectedGarment.front_max_print_width}
                        maxPrintHeight={selectedGarment.style?.toLowerCase().includes('sweatpants') ? selectedGarment.rsleeve_max_print_height : selectedGarment.front_max_print_height}
                        rMaxPrintWidth={selectedGarment.rsleeve_max_print_width}
                        rMaxPrintHeight={selectedGarment.rsleeve_max_print_height}
                        lMaxPrintWidth={selectedGarment.lsleeve_max_print_width}
                        lMaxPrintHeight={selectedGarment.lsleeve_max_print_height}
                        styleConfig={styleConfig}
                        className="max-w-full max-h-full"
                        fallback={<div className="text-2xl">{selectedGarment.style?.toLowerCase().includes('sweatpants') ? '👖' : '👕'}</div>}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {!selectedGarment?.style?.toLowerCase().includes('sweatpants') && selectedGarment?.back_image_url && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-2">Back View</h3>
                    <div className="bg-muted rounded-lg h-64 flex items-center justify-center">
                      <SvgImageWithPrint
                        garmentSrc={selectedGarment.back_image_url}
                        prints={getPrintsForView('back')}
                        maxPrintWidth={selectedGarment.back_max_print_width}
                        maxPrintHeight={selectedGarment.back_max_print_height}
                        styleConfig={styleConfig}
                        className="max-w-full max-h-full"
                        fallback={<div className="text-2xl">👕</div>}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {!selectedGarment?.style?.toLowerCase().includes('sweatpants') && selectedGarment?.rsleeve_image_url && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-2">Right Sleeve</h3>
                    <div className="bg-muted rounded-lg h-64 flex items-center justify-center">
                      <SvgImageWithPrint
                        garmentSrc={selectedGarment.rsleeve_image_url}
                        prints={getPrintsForView('right')}
                        maxPrintWidth={selectedGarment.rsleeve_max_print_width}
                        maxPrintHeight={selectedGarment.rsleeve_max_print_height}
                        styleConfig={styleConfig}
                        className="max-w-full max-h-full"
                        fallback={<div className="text-2xl">👕</div>}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {!selectedGarment?.style?.toLowerCase().includes('sweatpants') && selectedGarment?.lsleeve_image_url && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-2">Left Sleeve</h3>
                    <div className="bg-muted rounded-lg h-64 flex items-center justify-center">
                      <SvgImageWithPrint
                        garmentSrc={selectedGarment.lsleeve_image_url}
                        prints={getPrintsForView('left')}
                        maxPrintWidth={selectedGarment.lsleeve_max_print_width}
                        maxPrintHeight={selectedGarment.lsleeve_max_print_height}
                        styleConfig={styleConfig}
                        className="max-w-full max-h-full"
                        fallback={<div className="text-2xl">👕</div>}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleBackToSelection}
                variant="outline"
                className="flex-1"
              >
                Back to Selection
              </Button>
              <Button
                onClick={handleConfirmSelections}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                <Check className="w-5 h-5" />
                Confirm & Continue
              </Button>
            </div>
          </div>
        ) : (
          // Selection Mode
          <div className="space-y-4">
            {matchedPrints.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No primary matches found for this print.
              </div>
            ) : (
              <>
                {/* Live Preview */}
                {selections.length > 0 && (
                  <div className="bg-muted border border-border rounded-lg p-3">
                    <h3 className="text-sm mb-2">Preview ({selections.length} selected)</h3>
                    <div className="flex gap-2 overflow-x-auto">
                      {selectedGarment?.front_image_url && getPrintsForView('front').length > 0 && (
                        <div className="flex-shrink-0">
                          <div className="w-24 h-24 bg-card rounded-lg flex items-center justify-center overflow-hidden">
                            <SvgImageWithPrint
                              garmentSrc={selectedGarment.front_image_url}
                              prints={getPrintsForView('front')}
                              maxPrintWidth={selectedGarment.style?.toLowerCase().includes('sweatpants') ? selectedGarment.rsleeve_max_print_width : selectedGarment.front_max_print_width}
                              maxPrintHeight={selectedGarment.style?.toLowerCase().includes('sweatpants') ? selectedGarment.rsleeve_max_print_height : selectedGarment.front_max_print_height}
                              rMaxPrintWidth={selectedGarment.rsleeve_max_print_width}
                              rMaxPrintHeight={selectedGarment.rsleeve_max_print_height}
                              lMaxPrintWidth={selectedGarment.lsleeve_max_print_width}
                              lMaxPrintHeight={selectedGarment.lsleeve_max_print_height}
                              styleConfig={styleConfig}
                              className="w-full h-full"
                              fallback={<div className="text-lg">{selectedGarment.style?.toLowerCase().includes('sweatpants') ? '👖' : '👕'}</div>}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground text-center mt-1">{selectedGarment.style?.toLowerCase().includes('sweatpants') ? 'Sweatpants' : 'Front'}</p>
                        </div>
                      )}
                      {!selectedGarment?.style?.toLowerCase().includes('sweatpants') && selectedGarment?.back_image_url && getPrintsForView('back').length > 0 && (
                        <div className="flex-shrink-0">
                          <div className="w-24 h-24 bg-card rounded-lg flex items-center justify-center overflow-hidden">
                            <SvgImageWithPrint
                              garmentSrc={selectedGarment.back_image_url}
                              prints={getPrintsForView('back')}
                              maxPrintWidth={selectedGarment.back_max_print_width}
                              maxPrintHeight={selectedGarment.back_max_print_height}
                              styleConfig={styleConfig}
                              className="w-full h-full"
                              fallback={<div className="text-lg">👕</div>}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground text-center mt-1">Back</p>
                        </div>
                      )}
                      {!selectedGarment?.style?.toLowerCase().includes('sweatpants') && selectedGarment?.rsleeve_image_url && getPrintsForView('right').length > 0 && (
                        <div className="flex-shrink-0">
                          <div className="w-24 h-24 bg-card rounded-lg flex items-center justify-center overflow-hidden">
                            <SvgImageWithPrint
                              garmentSrc={selectedGarment.rsleeve_image_url}
                              prints={getPrintsForView('right')}
                              maxPrintWidth={selectedGarment.rsleeve_max_print_width}
                              maxPrintHeight={selectedGarment.rsleeve_max_print_height}
                              styleConfig={styleConfig}
                              className="w-full h-full"
                              fallback={<div className="text-lg">👕</div>}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground text-center mt-1">Right</p>
                        </div>
                      )}
                      {!selectedGarment?.style?.toLowerCase().includes('sweatpants') && selectedGarment?.lsleeve_image_url && getPrintsForView('left').length > 0 && (
                        <div className="flex-shrink-0">
                          <div className="w-24 h-24 bg-card rounded-lg flex items-center justify-center overflow-hidden">
                            <SvgImageWithPrint
                              garmentSrc={selectedGarment.lsleeve_image_url}
                              prints={getPrintsForView('left')}
                              maxPrintWidth={selectedGarment.lsleeve_max_print_width}
                              maxPrintHeight={selectedGarment.lsleeve_max_print_height}
                              styleConfig={styleConfig}
                              className="w-full h-full"
                              fallback={<div className="text-lg">👕</div>}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground text-center mt-1">Left</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Clicked Print - Large at Top */}
                {matchedPrints.length > 0 && selectedPrint && (
                  <div className="mb-6">
                    <h3 className="text-sm mb-3">Selected Print</h3>
                    {(() => {
                      const print = selectedPrint;
                      const placements = getAvailablePlacementsForPrint(print);
                      const printSelections = selections.filter(s => s.printId === print.id);
                      const isSelected = printSelections.length > 0;
                      
                      return (
                        <Card className={`border-2 ${isSelected ? 'border-green-600' : 'border-border'} max-w-xs mx-auto`}>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="relative w-full aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                                {print.image_url ? (
                                  <img src={print.image_url} alt={print.name} className="w-full h-full object-contain p-3" />
                                ) : (
                                  <div className="text-4xl">🎨</div>
                                )}
                              </div>
                              
                              <div>
                                <div className="flex items-center justify-between">
                                  <h3 className="text-base font-medium">{print.name}</h3>
                                  {(print.print_size === 'Crest' || print.print_size === 'Sleeve') && (
                                    <span className="text-sm text-muted-foreground ml-2 flex-shrink-0">
                                      {print.print_size}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">${print.cost?.toFixed(2)}</p>
                              </div>
                              
                              {printSelections.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                  {printSelections.map((sel, idx) => (
                                    <Badge 
                                      key={idx} 
                                      variant="outline" 
                                      className="text-xs capitalize rounded-full py-1 px-2 gap-1"
                                      title={sel.notes || ''}
                                    >
                                      {sel.isAssemblyLocked && '🔒 '}
                                         {placementDisplayNames[sel.placement] || placementLabels[sel.placement] || sel.placement}
                                         {sel.notes && ' 📝'}
                                         {!sel.isAssemblyLocked && (
                                           <button
                                             onClick={() => handleRemoveSelection(print.id, sel.placement)}
                                             className="hover:text-red-400 transition-colors"
                                           >
                                             <X className="w-3 h-3" />
                                           </button>
                                         )}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              
                              <Select 
                                value="" 
                                onValueChange={(value) => handlePlacementChange(print.id, value)}
                              >
                                <SelectTrigger className="h-10 text-sm touch-manipulation">
                                  <SelectValue placeholder="Add placement..." />
                                </SelectTrigger>
                                <SelectContent 
                                  position="popper"
                                  sideOffset={5}
                                >
                                  {placements.map((placement) => (
                                   <SelectItem 
                                     key={placement} 
                                     value={placement} 
                                     className="text-sm touch-manipulation min-h-[44px]"
                                   >
                                     {placementDisplayNames[placement] || placementLabels[placement] || placement}
                                   </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}
                  </div>
                )}

                {/* Matching Prints - Smaller Below */}
                {matchedPrints.length > 1 && (
                  <div>
                    <h3 className="text-sm mb-3">More Prints From The Set</h3>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                      {matchedPrints.slice(1).map((print) => {
                        const placements = getAvailablePlacementsForPrint(print);
                        const printSelections = selections.filter(s => s.printId === print.id);
                        const isSelected = printSelections.length > 0;
                        
                        return (
                          <Card key={print.id} className={`border-2 ${isSelected ? 'border-green-600' : 'border-border'}`}>
                            <CardContent className="p-2">
                              <div className="space-y-1.5">
                                <div className="relative w-full aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                                  {print.image_url ? (
                                    <img src={print.image_url} alt={print.name} className="w-full h-full object-contain p-1" />
                                  ) : (
                                    <div className="text-2xl">🎨</div>
                                  )}
                                </div>
                                
                                <div>
                                  <h3 className="text-xs font-medium truncate">{print.name}</h3>
                                  <p className="text-[10px] text-muted-foreground">${print.cost?.toFixed(2)}</p>
                                </div>
                                
                                {printSelections.length > 0 && (
                                  <div className="flex gap-1 flex-wrap">
                                    {printSelections.map((sel, idx) => (
                                      <Badge 
                                        key={idx} 
                                        variant="outline" 
                                        className="text-[9px] capitalize rounded-full py-0 px-1.5 gap-1"
                                        title={sel.notes || ''}
                                      >
                                        {sel.isAssemblyLocked && '🔒 '}
                                        {placementDisplayNames[sel.placement] || placementLabels[sel.placement] || sel.placement}
                                        {sel.notes && ' 📝'}
                                        {!sel.isAssemblyLocked && (
                                          <button
                                            onClick={() => handleRemoveSelection(print.id, sel.placement)}
                                            className="hover:text-red-400 transition-colors"
                                          >
                                            <X className="w-2.5 h-2.5" />
                                          </button>
                                        )}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                
                                <Select 
                                  value="" 
                                  onValueChange={(value) => handlePlacementChange(print.id, value)}
                                >
                                  <SelectTrigger className="h-7 text-[10px] touch-manipulation">
                                    <SelectValue placeholder="Add placement..." />
                                  </SelectTrigger>
                                  <SelectContent 
                                    position="popper"
                                    sideOffset={5}
                                  >
                                    {placements.map((placement) => (
                                      <SelectItem 
                                        key={placement} 
                                        value={placement} 
                                        className="text-xs touch-manipulation min-h-[44px]"
                                      >
                                        {placementDisplayNames[placement] || placementLabels[placement] || placement}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={onClose}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  {showingSecondary && (
                    <Button
                      onClick={() => loadPrimaryMatches()}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Back to Matching
                    </Button>
                  )}
                  <Button
                    onClick={handleContinue}
                    disabled={selections.length === 0}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue ({selections.length} selected)
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>

      {/* Replacement Confirmation Dialog */}
      {replacementDialog && (
        <Dialog open={true} onOpenChange={() => setReplacementDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Replace Print?</DialogTitle>
              <DialogDescription>
                {replacementDialog.existingPrint?.name || 'A print'} is already in {placementLabels[replacementDialog.placement] || replacementDialog.placement}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              <Button
                onClick={() => {
                  // Replace: remove old print+placement (but keep locked ones), add new print+placement
                  setSelections(prev => {
                    const filtered = prev.filter(s => 
                      s.isAssemblyLocked || !(s.printId === replacementDialog.existingPrintId && s.placement === replacementDialog.existingPlacement)
                    );
                    return [...filtered, { printId: replacementDialog.newPrintId, placement: replacementDialog.placement }];
                  });
                  setReplacementDialog(null);
                }}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Replace with {replacementDialog.newPrint?.name || 'this print'}
              </Button>
              <Button
                onClick={() => setReplacementDialog(null)}
                variant="outline"
                className="w-full"
              >
                Keep {replacementDialog.existingPrint?.name || 'current print'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Custom Notes Dialog */}
      {customNotesDialog && (
        <Dialog open={true} onOpenChange={() => {
          setCustomNotesDialog(null);
          setCustomNotes('');
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Special Instructions</DialogTitle>
              <DialogDescription>
                Enter placement instructions for {customNotesDialog.print.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="flex justify-center">
                <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden p-2">
                  {customNotesDialog.print.image_url ? (
                    <img 
                      src={customNotesDialog.print.image_url} 
                      alt={customNotesDialog.print.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-2xl">🎨</div>
                  )}
                </div>
              </div>
              <div>
                <Label>Placement Instructions (Required)</Label>
                <p className="text-xs text-yellow-500 mt-1 mb-2">
                  This print will not be placed on the garment. Enter detailed instructions for custom placement.
                </p>
                <Input
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Enter detailed placement instructions..."
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setCustomNotesDialog(null);
                    setCustomNotes('');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmCustomNotes}
                  disabled={!customNotes.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Print
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Print Doesn't Fit Dialog */}
      {printDoesntFitDialog && (
        <Dialog open={true} onOpenChange={() => setPrintDoesntFitDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Print Doesn't Fit</DialogTitle>
              <DialogDescription>
                {printDoesntFitDialog.print.name} ({printDoesntFitDialog.print.width}" × {printDoesntFitDialog.print.height}") is too large for {placementLabels[printDoesntFitDialog.placement] || printDoesntFitDialog.placement}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              <Button
                onClick={() => {
                  setSelections(prev => [...prev, { printId: printDoesntFitDialog.printId, placement: printDoesntFitDialog.placement }]);
                  setPrintDoesntFitDialog(null);
                }}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Override - Place Anyway
              </Button>
              <Button
                onClick={() => setPrintDoesntFitDialog(null)}
                variant="outline"
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </Dialog>

    {/* Similar Prints Dialog */}
    <Dialog open={showSimilarDialog} onOpenChange={setShowSimilarDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Do you want to see more similar prints?</DialogTitle>
        </DialogHeader>
        <div className="flex gap-3 mt-4">
          <Button
            onClick={() => {
              setShowSimilarDialog(false);
              setShowPreview(true);
            }}
            variant="outline"
            className="flex-1"
          >
            No, Continue
          </Button>
          <Button
            onClick={() => {
              setShowSimilarDialog(false);
              handleLoadSecondaryMatches();
            }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Yes, Show Similar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}