import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, X, RotateCcw, Search, ArrowUp, Filter } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SvgImageWithPrint from "../components/SvgImageWithPrint";
import { filterGarmentsByLocation } from "../components/GarmentFilter"; // NEW IMPORT
import PrimaryMatchesDialog from "../components/PrimaryMatchesDialog";
import PullToRefresh from "../components/PullToRefresh";

export default function PrintCatalog() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const categoryParam = urlParams.get('category');
  const flow = urlParams.get('flow');
  const color = urlParams.get('color');
  const style = urlParams.get('style');
  const size = urlParams.get('size');
  
  const [prints, setPrints] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  
  // Smart initial category selection for zip hoodies
  const getInitialCategory = () => {
    if (categoryParam) return categoryParam;
    
    // Check if we're in preview mode with a zip hoodie
    if (color && style && size) {
      const decodedStyle = decodeURIComponent(style);
      const isZipHoodie = decodedStyle.toLowerCase().includes('zip');
      
      if (isZipHoodie) {
        // For zip hoodies, start with 'Crest' (front view is default)
        return 'Crest';
      }
    }
    
    return 'all';
  };
  
  const [selectedCategory, setSelectedCategory] = useState(getInitialCategory());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPrints, setSelectedPrints] = useState([]);
  const [showPlacementDialog, setShowPlacementDialog] = useState(false);
  const [currentPrint, setCurrentPrint] = useState(null);
  const [selectedPlacement, setSelectedPlacement] = useState(null);
  const [selectedGarment, setSelectedGarment] = useState(null);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [existingPrintToReplace, setExistingPrintToReplace] = useState(null);
  const [blockPlacementDialog, setBlockPlacementDialog] = useState(false);
  const [expandedView, setExpandedView] = useState(null);

  const [showStartOverDialog, setShowStartOverDialog] = useState(false);
  const [currentViewIndex, setCurrentViewIndex] = useState(0);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [previewPrint, setPreviewPrint] = useState(null);
  const [printNotes, setPrintNotes] = useState('');
  const [showPreprintDialog, setShowPreprintDialog] = useState(false);
  const [matchedPreprint, setMatchedPreprint] = useState(null);
  const [preprintInventory, setPreprintInventory] = useState(null);
  const [checkingInventory, setCheckingInventory] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showPrimaryMatchesDialog, setShowPrimaryMatchesDialog] = useState(false);
  const [printForPrimaryMatches, setPrintForPrimaryMatches] = useState(null);
  const [styleConfig, setStyleConfig] = useState(null);

  const showPreview = color && style && size;

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Get available views based on garment type
  const getAvailableViews = () => {
    if (!selectedGarment) return [];
    const isSweatpants = selectedGarment.style?.toLowerCase().includes('sweatpants');
    const isToddler = selectedGarment.style?.toLowerCase().includes('toddler');
    const isHoodie = selectedGarment.style?.toLowerCase().includes('hoodie') || selectedGarment.style?.toLowerCase().includes('zip');
    const isYouthNonHoodie = selectedGarment.style?.toLowerCase().includes('youth') && 
                              !isHoodie && 
                              !selectedGarment.style?.toLowerCase().includes('sweatpants');

    if (isSweatpants) return ['front'];
    if (isToddler || isYouthNonHoodie) return ['front', 'back'];
    return ['front', 'back', 'right', 'left'];
  };
  
  const availableViews = getAvailableViews();
  const currentView = availableViews[currentViewIndex];

  // loadPrints function, but without setting loading state
  const _loadPrintsInternal = async () => {
    console.log('PrintCatalog: Loading prints...');
    
    const allPrints = await base44.entities.Print.filter({ is_active: true }, '-created_date', 1000);
    console.log('PrintCatalog: Total prints:', allPrints.length);
    
    let activePrints = allPrints;
    
    // Apply location-based filtering using availability field
    const selectedLocation = localStorage.getItem('selectedLocation');
    if (selectedLocation) {
      try {
        const locationData = JSON.parse(selectedLocation);
        const locationName = locationData.name;
        
        // Map location names to codes
        const locationCodeMap = {
          'Freedom': 'FR',
          'Sharkys': 'SH',
          'Cannon Beach Freedom': 'CB'
        };
        
        const locationCode = locationCodeMap[locationName];
        if (locationCode) {
          activePrints = activePrints.filter(p => {
            if (!p.availability) return true; // If no availability set, show everywhere
            return p.availability.includes(locationCode);
          });
          console.log(`PrintCatalog: Filtered to ${locationName} (${locationCode}) prints:`, activePrints.length);
        }
      } catch (error) {
        console.error('Error parsing selected location:', error);
      }
    }
    
    const garmentType = urlParams.get('garment_type');
    console.log('PrintCatalog: Garment type:', garmentType);
    
    let filteredByType = activePrints;
    
    if (garmentType === 'tops') {
      filteredByType = activePrints.filter(p => 
        ['Crest', 'Sleeve', 'Adult', 'Jr', 'Kid', 'Baby', 'Patch'].includes(p.print_size)
      );
      console.log('PrintCatalog: Filtered to tops:', filteredByType.length);
    } else if (garmentType === 'bottoms') {
      filteredByType = activePrints.filter(p => 
        ['Crest', 'Sleeve', 'Adult Leg', 'Jr Leg', 'Kid Leg', 'Leg', 'Patch'].includes(p.print_size)
      );
      console.log('PrintCatalog: Filtered to bottoms:', filteredByType.length);
    }
    
    setPrints(filteredByType);
    
    const categories = filteredByType.flatMap(p => p.categories || []);
    const uniqueCategories = [...new Set(categories)];
    setAllCategories(uniqueCategories);
    
    console.log('PrintCatalog: Categories:', uniqueCategories);
  };

  // loadSelectedPrints function (async to load preprint data)
  const _loadSelectedPrintsInternal = async () => {
    const storedPrints = localStorage.getItem('selectedPrints');
    if (storedPrints) {
      try {
        const prints = JSON.parse(storedPrints);
        
        // Load all active preprints to find placement data
        const allPreprints = await base44.entities.Preprint.filter({ is_active: true });
        
        // Apply placements for assembly locked prints using preprint data
        const printsWithPlacements = prints.map(print => {
          // ONLY apply for assembly locked (preprinted) items
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
                console.log('[PrintCatalog] Using preprint placement:', {
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
          }
          
          // Not assembly locked or no preprint placement - keep existing placement
          return print;
        });
        
        setSelectedPrints(printsWithPlacements);
      } catch (error) {
        console.error('Error loading selected prints:', error);
        setSelectedPrints([]);
      }
    }
  };

  const loadSelections = async () => {
    setLoading(true); // Start loading for all initial data
    try {
      await _loadPrintsInternal(); // Load prints without setting final loading state
      await _loadSelectedPrintsInternal(); // Load selected prints (now async)

      if (color && style && size) {
        const decodedColor = decodeURIComponent(color);
        const decodedStyle = decodeURIComponent(style);
        const decodedSize = decodeURIComponent(size);
        
        console.log('PrintCatalog: Loading garment with:', { decodedColor, decodedStyle, decodedSize });
        
        // Use list() and filter manually for case-insensitive matching
        let allGarments = await base44.entities.Garment.list();
        
        // Filter by location availability (NEW LOGIC)
        allGarments = filterGarmentsByLocation(allGarments);
        
        const garments = allGarments.filter(g => 
          g.color?.toLowerCase() === decodedColor.toLowerCase() &&
          g.style?.toLowerCase() === decodedStyle.toLowerCase() &&
          g.size?.toUpperCase() === decodedSize.toUpperCase()
        );
        
        console.log('PrintCatalog: Found garments:', garments.length);
        
        if (garments.length > 0) {
          setSelectedGarment(garments[0]);
          console.log('PrintCatalog: Selected garment:', garments[0]);
          
          // Load style configuration for placement coordinates
          const styles = await base44.entities.Style.filter({ style_name: decodedStyle });
          if (styles.length > 0) {
            console.log('PrintCatalog: Loaded style config:', styles[0]);
            setStyleConfig(styles[0]);
          } else {
            setStyleConfig(null);
          }
        } else {
          setStyleConfig(null);
        }
      }
    } catch (error) {
      console.error('Error loading selections:', error);
    } finally {
      setLoading(false); // Set loading to false once all data is fetched or an error occurs
    }
  };

  useEffect(() => {
    loadSelections(); // Call the combined loading function
  }, [showPreview, color, style, size]);
  
  // Check for pending print from print-first flow after prints are loaded
  useEffect(() => {
    if (loading || !color || !style || !size || prints.length === 0) return;
    
    const pendingPrintId = localStorage.getItem('pendingPrintId');
    if (pendingPrintId) {
      console.log('Pending print detected from localStorage:', pendingPrintId);
      const pendingPrint = prints.find(p => p.id === pendingPrintId);
      if (pendingPrint) {
        console.log('Auto-opening Primary Matches dialog for pending print:', pendingPrint.name);
        localStorage.removeItem('pendingPrintId');
        // Small delay to ensure everything is rendered
        setTimeout(() => {
          setPrintForPrimaryMatches(pendingPrint);
          setShowPrimaryMatchesDialog(true);
        }, 300);
      }
    }
  }, [loading, prints, color, style, size]);
  
  useEffect(() => {
    if (!showPreview || !currentView || allCategories.length === 0) return;
    
    const isSweatpants = selectedGarment?.style?.toLowerCase().includes('sweatpants');
    const isZipHoodie = selectedGarment?.style?.toLowerCase().includes('zip');
    const isOnesie = selectedGarment?.style?.toLowerCase().includes('onesie');
    const isLadiesTShirt = selectedGarment?.style?.toLowerCase().includes('ladies t-shirt');

    if (isLadiesTShirt) {
      const feminineCategory = allCategories.find(cat => cat.toLowerCase().includes('feminine'));
      if (feminineCategory) {
        setSelectedCategory(feminineCategory);
      } else {
        setSelectedCategory('all');
      }
    } else if (isSweatpants) {
      const legPrintsCategory = allCategories.find(cat => cat.toLowerCase().includes('leg'));
      if (legPrintsCategory) {
        setSelectedCategory(legPrintsCategory);
      } else {
        setSelectedCategory('all');
      }
    } else if (isOnesie) {
      // Onesies: Front and Back both use Baby Prints
      if (currentView === 'front' || currentView === 'back') {
        const babyPrintsCategory = allCategories.find(cat => cat.toLowerCase().includes('baby'));
        if (babyPrintsCategory) {
          setSelectedCategory(babyPrintsCategory);
        } else {
          setSelectedCategory('all');
        }
      }
    } else if (isZipHoodie) {
      // Zip Hoodies and Quarter Zips: Front/Sleeves=Add-On Prints, Back=All
      if (currentView === 'back') {
        setSelectedCategory('all');
      } else if (currentView === 'front' || currentView === 'right' || currentView === 'left') {
        const addOnCategory = allCategories.find(cat => cat.toLowerCase().includes('add-on'));
        if (addOnCategory) {
          setSelectedCategory(addOnCategory);
        } else {
          setSelectedCategory('all');
        }
      }
    } else {
      // Other garments: Auto-switch to Sleeve or Crest for right or left sleeve views
      if (currentView === 'right' || currentView === 'left') {
        const isTShirt = selectedGarment?.style?.toLowerCase().includes('t-shirt');
        const isTallTShirt = selectedGarment?.style?.toLowerCase().includes('tall t-shirt');
        
        if (isTShirt || isTallTShirt) {
          // T-shirts use Crest for sleeve views
          const crestCategory = allCategories.find(cat => cat.toLowerCase().includes('crest'));
          if (crestCategory) {
            setSelectedCategory(crestCategory);
          } else {
            setSelectedCategory('all');
          }
        } else {
          // Other garments use Sleeve
          const sleeveCategory = allCategories.find(cat => cat.toLowerCase().includes('sleeve'));
          if (sleeveCategory) {
            setSelectedCategory(sleeveCategory);
          } else {
            setSelectedCategory('all');
          }
        }
      }
    }
  }, [currentView, showPreview, allCategories, selectedGarment]);


  const handlePrintClick = (print) => {
    console.log(`[handlePrintClick] ========================================`);
    console.log(`[handlePrintClick] Clicked print: "${print.name}"`);
    console.log(`[handlePrintClick] print_size: "${print.print_size}"`);
    console.log(`[handlePrintClick] front_placements:`, print.front_placements);
    console.log(`[handlePrintClick] bottom_placements:`, print.bottom_placements);
    
    // If no garment selected (print-first flow), save print and navigate to garment selection
    if (!showPreview) {
      console.log('[handlePrintClick] No garment selected - starting garment selection flow');
      localStorage.setItem('pendingPrintId', print.id);
      const garmentType = urlParams.get('garment_type');
      navigate(createPageUrl(`StyleGroupSelection?flow=print${garmentType ? `&garment_type=${garmentType}` : ''}`));
      return;
    }
    
    // Always use Primary Matches Dialog for all prints
    setPrintForPrimaryMatches(print);
    setShowPrimaryMatchesDialog(true);
  };

  const handleAddPrint = () => {
    if (!selectedPlacement) return;
    
    console.log(`[handleAddPrint] ========================================`);
    console.log(`[handleAddPrint] Adding print: "${currentPrint?.name}"`);
    console.log(`[handleAddPrint] print_size: "${currentPrint?.print_size}"`);
    console.log(`[handleAddPrint] Selected placement: "${selectedPlacement}"`);
    console.log(`[handleAddPrint] This will be stored as print.placement = "${selectedPlacement}"`);
    
    const newPrintArea = getPrintAreaForPlacement(selectedPlacement, selectedGarment);
    
    // Check if there's already a locked print on this print area
    const lockedPrintOnArea = selectedPrints.find(p => {
      const printArea = getPrintAreaForPlacement(p.placement, selectedGarment);
      return printArea === newPrintArea && p.isAssemblyLocked;
    });
    
    if (lockedPrintOnArea) {
      alert('This print area already has a locked print from the assembly. You cannot add another print here.');
      return;
    }

    // Check if there's already a print on this print area
    const existingPrintOnArea = selectedPrints.find(p => {
      const printArea = getPrintAreaForPlacement(p.placement, selectedGarment);
      return printArea === newPrintArea && p.id !== currentPrint.id;
    });
    
    if (existingPrintOnArea) {
      setExistingPrintToReplace(existingPrintOnArea);
      // CRITICAL: Close placement dialog and open replace in sequence
      setShowPlacementDialog(false);
      // Use timeout to ensure placement dialog fully closes before opening replace
      setTimeout(() => {
        setShowReplaceDialog(true);
      }, 50);
      return;
    }

    if (showPreview) {
      // New workflow: show confirmation dialog
      const newPrint = { 
        ...currentPrint, 
        placement: selectedPlacement,
        notes: printNotes.trim() || undefined
      };
      setPreviewPrint(newPrint);
      setShowPlacementDialog(false);
      setShowConfirmationDialog(true);
    } else {
      // Old workflow
      addPrintToPlacement();
    }
  };
  
  const handleConfirmPrint = () => {
    // If replacing, remove the old print first
    let updatedPrints = selectedPrints;
    if (existingPrintToReplace) {
      updatedPrints = selectedPrints.filter(
        p => !(p.id === existingPrintToReplace.id && p.placement === existingPrintToReplace.placement)
      );
    }
    
    // Add the new print
    updatedPrints = [...updatedPrints, previewPrint];
    setSelectedPrints(updatedPrints);
    localStorage.setItem('selectedPrints', JSON.stringify(updatedPrints));
    
    setShowConfirmationDialog(false);
    setShowPlacementDialog(false);
    setPreviewPrint(null);
    setCurrentPrint(null);
    setSelectedPlacement(null);
    setExistingPrintToReplace(null);
    
    // Auto-advance to next view UNLESS we're on Quarter Zip or Zip Hoodie front view
    const isQuarterZip = selectedGarment?.style?.toLowerCase().includes('quarter zip');
    const isZipHoodie = selectedGarment?.style?.toLowerCase().includes('zip hoodie');
    const shouldSkipAutoAdvance = (isQuarterZip || isZipHoodie) && currentView === 'front';
    
    if (showPreview && currentViewIndex < availableViews.length - 1 && !shouldSkipAutoAdvance) {
      setTimeout(() => {
        setCurrentViewIndex(currentViewIndex + 1);
      }, 50);
    }
  };
  
  const handleRejectPrint = () => {
    // Don't add the print, go back to selection
    setShowConfirmationDialog(false);
    setShowPlacementDialog(false);
    setPreviewPrint(null);
    setCurrentPrint(null);
    setSelectedPlacement(null);
    setExistingPrintToReplace(null);
  };

  const addPrintToPlacement = () => {
    if (!currentPrint || !selectedPlacement) {
        console.warn("Attempted to add print without currentPrint or selectedPlacement.");
        return;
    }

    const newPrintInstance = {
      ...currentPrint,
      placement: selectedPlacement,
      notes: printNotes.trim() || undefined
    };
    
    console.log('Adding print with placement:', {
      name: newPrintInstance.name,
      placement: selectedPlacement,
      image_url: newPrintInstance.image_url
    });
    
    const selectedView = getViewForPlacement(selectedPlacement, styleConfig, newPrintInstance);
    
    const exactMatch = selectedPrints.find(p => 
      p.id === newPrintInstance.id && p.placement === newPrintInstance.placement
    );
    
    if (exactMatch) {
      console.log('Exact print+placement combination already exists. Closing dialog.');
      setShowPlacementDialog(false);
      setCurrentPrint(null);
      setSelectedPlacement(null);
      setExistingPrintToReplace(null);
      return;
    }
    
    let updatedPrints = selectedPrints.filter(p => {
      const printViewOfP = getViewForPlacement(p.placement, styleConfig, p);
      
      const isExistingPrintBeingReplaced = existingPrintToReplace && 
                                           p.id === existingPrintToReplace.id && 
                                           p.placement === existingPrintToReplace.placement;

      const isSamePrintOnSameView = p.id === newPrintInstance.id && printViewOfP === selectedView;

      return !isExistingPrintBeingReplaced && !isSamePrintOnSameView;
    });
    
    updatedPrints.push(newPrintInstance);
    
    console.log('Updated prints array:', updatedPrints);
    console.log('Saving to localStorage...');
    
    setSelectedPrints(updatedPrints);
    localStorage.setItem('selectedPrints', JSON.stringify(updatedPrints));
    
    setShowPlacementDialog(false);
    setCurrentPrint(null);
    setSelectedPlacement(null);
    setExistingPrintToReplace(null);
    
    const params = new URLSearchParams(window.location.search);
    const currentFlow = params.get('flow');
    const currentColor = params.get('color');
    const currentStyle = params.get('style');
    const currentSize = params.get('size');
    const garmentType = params.get('garment_type');
    
    if (currentFlow === 'print' && updatedPrints.length === 1 && !currentColor && !currentStyle && !currentSize) {
      const navParams = new URLSearchParams();
      navParams.set('flow', 'print');
      if (garmentType) navParams.set('garment_type', garmentType);
      navigate(createPageUrl(`GarmentChoiceSelection?${navParams.toString()}`));
    }
  };



  const handleReplaceConfirm = () => {
    // Store values before clearing state
    const printToAdd = { 
      ...currentPrint, 
      placement: selectedPlacement,
      notes: printNotes.trim() || undefined
    };
    const oldPrint = existingPrintToReplace;
    
    // BLOCK placement dialog and clear state
    setBlockPlacementDialog(true);
    setCurrentPrint(null);
    setSelectedPlacement(null);
    setExistingPrintToReplace(null);
    setPrintNotes('');
    setShowReplaceDialog(false);
    
    // Unblock after delay
    setTimeout(() => setBlockPlacementDialog(false), 150);
    
    if (showPreview) {
      setPreviewPrint(printToAdd);
      setExistingPrintToReplace(oldPrint);
      setShowConfirmationDialog(true);
    } else {
      // Add the print directly
      let updatedPrints = selectedPrints.filter(p => 
        !(p.id === oldPrint?.id && p.placement === oldPrint?.placement)
      );
      updatedPrints.push(printToAdd);
      setSelectedPrints(updatedPrints);
      localStorage.setItem('selectedPrints', JSON.stringify(updatedPrints));
    }
  };

  const handleReplaceCancel = () => {
    // BLOCK placement dialog from reopening
    setBlockPlacementDialog(true);
    
    // IMMEDIATELY clear ALL state
    setShowReplaceDialog(false);
    setShowPlacementDialog(false);
    setCurrentPrint(null);
    setSelectedPlacement(null);
    setExistingPrintToReplace(null);
    setPrintNotes('');
    
    // Unblock after a short delay
    setTimeout(() => setBlockPlacementDialog(false), 100);
  };


  
  const handleStartOver = () => {
    setShowStartOverDialog(true);
  };

  const confirmStartOver = () => {
    localStorage.removeItem('selectedPrints');
    localStorage.removeItem('editingBuildIndex');
    localStorage.removeItem('pendingBuild');
    localStorage.removeItem('preprintDecisionMade');
    setShowStartOverDialog(false);
    navigate(createPageUrl("Home"));
  };

  const handleRemovePrint = (printId, placement) => {
    // Check if this print is locked from an assembly
    const printToRemove = selectedPrints.find(p => p.id === printId && p.placement === placement);
    if (printToRemove?.isAssemblyLocked) {
      alert('This print is part of the assembly and cannot be removed.');
      return;
    }

    const updatedPrints = selectedPrints.filter(
      p => !(p.id === printId && p.placement === placement)
    );
    setSelectedPrints(updatedPrints);
    localStorage.setItem('selectedPrints', JSON.stringify(updatedPrints));

    if (currentPrint && currentPrint.id === printId && selectedPlacement === placement) {
      setSelectedPlacement(null);
    }
    if (currentPrint && currentPrint.id === printId && !updatedPrints.some(p => p.id === printId)) {
        setShowPlacementDialog(false);
        setCurrentPrint(null);
        setSelectedPlacement(null);
    }
  };

  const isPrintSelected = (printId) => {
    return selectedPrints.some(p => p.id === printId);
  };

  const getPrintPlacements = (printId) => {
    return selectedPrints
      .filter(p => p.id === printId)
      .map(p => p.placement);
  };

  const handleContinue = async () => {
    if (showPreview && currentViewIndex < availableViews.length - 1) {
      // Skip current view and move to next
      setCurrentViewIndex(currentViewIndex + 1);
      return;
    }
    
    // Skip preprint check if we already have locked prints (already using preprint)
    const hasLockedPrints = selectedPrints.some(p => p.isAssemblyLocked);
    if (hasLockedPrints) {
      // Already using a preprint, skip the preprint dialog
      const params = new URLSearchParams(window.location.search);
      const currentFlow = params.get('flow');
      const color = params.get('color');
      const style = params.get('style');
      const size = params.get('size');
      const garmentType = params.get('garment_type');
      
      if (currentFlow === 'print' && color && style && size) {
        navigate(createPageUrl(`Preview?${params.toString()}`));
      }
      else if (currentFlow === 'print') {
        const navParams = new URLSearchParams();
        navParams.set('flow', 'print');
        if (garmentType) navParams.set('garment_type', garmentType);
        navigate(createPageUrl(`GarmentChoiceSelection?${navParams.toString()}`));
      } else {
        navigate(createPageUrl(`Preview?${params.toString()}`));
      }
      return;
    }
    
    // Check for preprint match before proceeding (only if not already decided)
    const preprintDecisionMade = localStorage.getItem('preprintDecisionMade');
    if (selectedGarment && selectedPrints.length > 0 && !preprintDecisionMade) {
      const preprintMatch = await checkForPreprintMatch();
      if (preprintMatch) {
        setMatchedPreprint(preprintMatch);
        setShowPreprintDialog(true);
        return;
      }
    }
    
    const params = new URLSearchParams(window.location.search);
    const currentFlow = params.get('flow');
    const color = params.get('color');
    const style = params.get('style');
    const size = params.get('size');
    const garmentType = params.get('garment_type');
    
    if (currentFlow === 'print' && color && style && size) {
      navigate(createPageUrl(`Preview?${params.toString()}`));
    }
    else if (currentFlow === 'print') {
      const navParams = new URLSearchParams();
      navParams.set('flow', 'print');
      if (garmentType) navParams.set('garment_type', garmentType);
      navigate(createPageUrl(`GarmentChoiceSelection?${navParams.toString()}`));
    } else {
      navigate(createPageUrl(`Preview?${params.toString()}`));
    }
  };

  const handleFinish = async () => {
    // Skip preprint check if we already have locked prints (already using preprint)
    const hasLockedPrints = selectedPrints.some(p => p.isAssemblyLocked);
    if (hasLockedPrints) {
      // Already using a preprint, skip the preprint dialog
      const params = new URLSearchParams(window.location.search);
      const currentFlow = params.get('flow');
      const color = params.get('color');
      const style = params.get('style');
      const size = params.get('size');
      const garmentType = params.get('garment_type');
      
      if (currentFlow === 'print' && color && style && size) {
        navigate(createPageUrl(`Preview?${params.toString()}`));
      }
      else if (currentFlow === 'print') {
        const navParams = new URLSearchParams();
        navParams.set('flow', 'print');
        if (garmentType) navParams.set('garment_type', garmentType);
        navigate(createPageUrl(`GarmentChoiceSelection?${navParams.toString()}`));
      } else {
        navigate(createPageUrl(`Preview?${params.toString()}`));
      }
      return;
    }
    
    // Check for preprint match before proceeding (only if not already decided)
    const preprintDecisionMade = localStorage.getItem('preprintDecisionMade');
    if (selectedGarment && selectedPrints.length > 0 && !preprintDecisionMade) {
      const preprintMatch = await checkForPreprintMatch();
      if (preprintMatch) {
        setMatchedPreprint(preprintMatch);
        setShowPreprintDialog(true);
        return;
      }
    }
    
    const params = new URLSearchParams(window.location.search);
    const currentFlow = params.get('flow');
    const color = params.get('color');
    const style = params.get('style');
    const size = params.get('size');
    const garmentType = params.get('garment_type');
    
    if (currentFlow === 'print' && color && style && size) {
      navigate(createPageUrl(`Preview?${params.toString()}`));
    }
    else if (currentFlow === 'print') {
      const navParams = new URLSearchParams();
      navParams.set('flow', 'print');
      if (garmentType) navParams.set('garment_type', garmentType);
      navigate(createPageUrl(`GarmentChoiceSelection?${navParams.toString()}`));
    } else {
      navigate(createPageUrl(`Preview?${params.toString()}`));
    }
  };

  const checkForPreprintMatch = async () => {
    try {
      const allPreprints = await base44.entities.Preprint.filter({ is_active: true });
      
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
    try {
      const selectedLocationData = localStorage.getItem('selectedLocation');
      if (!selectedLocationData) {
        alert('No location selected');
        return;
      }
      
      const selectedLocation = JSON.parse(selectedLocationData);
      
      // First get item details to get the correct itemID
      const itemResponse = await base44.functions.invoke('lightspeedGetItemDetails', {
        barcode: matchedPreprint.preprint_system_id,
        locationId: selectedLocation.id
      });
      
      if (!itemResponse.data.success || !itemResponse.data.item) {
        alert('Failed to load preprint details');
        setPreprintInventory({ available: 0, needed: 1 });
        setCheckingInventory(false);
        return;
      }
      
      const itemID = itemResponse.data.item.itemID;
      
      const response = await base44.functions.invoke('lightspeedCheckInventory', {
        items: [{
          name: `Preprint ${matchedPreprint.preprint_system_id}`,
          system_id: matchedPreprint.preprint_system_id,
          itemID: itemID,
          quantity: 1,
          type: 'preprint'
        }],
        shopID: selectedLocation.shopID,
        locationId: selectedLocation.id
      });
      
      if (response.data.success) {
        // Get the actual inventory from the response
        const inventory = response.data.allItemsInventory?.[0];
        if (inventory) {
          setPreprintInventory({ available: inventory.available, needed: 1 });
        } else {
          setPreprintInventory({ available: 0, needed: 1 });
        }
      }
    } catch (error) {
      console.error('Error checking inventory:', error);
      alert('Failed to check inventory');
    } finally {
      setCheckingInventory(false);
    }
  };

  const handleUsePreprint = () => {
    // Store the preprint system ID for auto-scan on OrderSummary
    localStorage.setItem('autoScanBarcode', matchedPreprint.preprint_system_id);
    localStorage.setItem('preprintDecisionMade', 'true');
    localStorage.removeItem('selectedPrints');

    setShowPreprintDialog(false);
    setMatchedPreprint(null);
    setPreprintInventory(null);

    navigate(createPageUrl("OrderSummary"));
  };

  const handleProduceAnyway = () => {
    // Store preprint bypass info to log after sale creation
    localStorage.setItem('preprintBypass', JSON.stringify({
      preprint_system_id: matchedPreprint.preprint_system_id,
      blank_system_id: matchedPreprint.blank_system_id,
      print1_system_id: matchedPreprint.print1_system_id,
      print2_system_id: matchedPreprint.print2_system_id
    }));
    localStorage.setItem('preprintDecisionMade', 'true');
    
    setShowPreprintDialog(false);
    setMatchedPreprint(null);
    setPreprintInventory(null);
    
    const params = new URLSearchParams(window.location.search);
    const currentFlow = params.get('flow');
    const color = params.get('color');
    const style = params.get('style');
    const size = params.get('size');
    const garmentType = params.get('garment_type');
    
    if (currentFlow === 'print' && color && style && size) {
      navigate(createPageUrl(`Preview?${params.toString()}`));
    }
    else if (currentFlow === 'print') {
      const navParams = new URLSearchParams();
      navParams.set('flow', 'print');
      if (garmentType) navParams.set('garment_type', garmentType);
      navigate(createPageUrl(`GarmentChoiceSelection?${navParams.toString()}`));
    } else {
      navigate(createPageUrl(`Preview?${params.toString()}`));
    }
  };

  const handlePrimaryMatchesConfirm = (printsWithPlacements) => {
    // Replace all selections with the confirmed prints from the matching dialog
    setSelectedPrints(printsWithPlacements);
    localStorage.setItem('selectedPrints', JSON.stringify(printsWithPlacements));
    
    setShowPrimaryMatchesDialog(false);
    setPrintForPrimaryMatches(null);
  };

  const filteredPrints = (() => {
    console.log('PrintCatalog: Filtering prints...');
    console.log('PrintCatalog: Starting with prints:', prints.length);
    console.log('PrintCatalog: Selected category:', selectedCategory);
    console.log('PrintCatalog: Selected garment:', selectedGarment);
    
    let filtered = selectedCategory === 'all' 
      ? prints 
      : prints.filter(p => p.categories?.some(category => category.toLowerCase() === selectedCategory.toLowerCase()));
    
    console.log('PrintCatalog: After category filter:', filtered.length);
    
    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.system_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      console.log('PrintCatalog: After search filter:', filtered.length);
    }
    
    const isSweatpants = selectedGarment?.style?.toLowerCase().includes('sweatpants');
    const isTShirt = selectedGarment?.style?.toLowerCase().includes('t-shirt');
    const isOnesie = selectedGarment?.style?.toLowerCase().includes('onesie');
    
    const garmentType = urlParams.get('garment_type');
    
    const topsPrintSizes = ['Adult', 'Jr', 'Kid', 'Baby', 'Sleeve', 'Crest', 'Patch'];
    const bottomsPrintSizes = ['Adult Leg', 'Jr Leg', 'Kid Leg', 'Leg', 'Sleeve', 'Crest', 'Patch'];
    const sleevePrintSizes = ['Sleeve', 'Crest', 'Patch'];
    
    console.log('PrintCatalog: garmentType:', garmentType);
    console.log('PrintCatalog: isSweatpants:', isSweatpants);
    console.log('PrintCatalog: isTShirt:', isTShirt);
    console.log('PrintCatalog: isOnesie:', isOnesie);
    console.log('PrintCatalog: currentView:', currentView);
    
    // Filter by current view if in sequential mode
    if (showPreview && (currentView === 'right' || currentView === 'left')) {
      const isTShirt = selectedGarment?.style?.toLowerCase().includes('t-shirt');
      const isOnesie = selectedGarment?.style?.toLowerCase().includes('onesie');
      
      if (isTShirt || isOnesie) {
        // For T-Shirts and Onesies, only show Crest prints on sleeves (no Sleeve prints)
        filtered = filtered.filter(print => print.print_size === 'Crest');
      } else {
        // For other garments, show both Sleeve and Crest
        filtered = filtered.filter(print => sleevePrintSizes.includes(print.print_size));
      }
      console.log('PrintCatalog: After sleeve view filter:', filtered.length);
    } else if (garmentType === 'tops') {
      filtered = filtered.filter(print => topsPrintSizes.includes(print.print_size));
      if (isOnesie) {
        filtered = filtered.filter(print => print.print_size !== 'Sleeve');
      }
      console.log('PrintCatalog: After tops filter:', filtered.length);
    } else if (garmentType === 'bottoms') {
      filtered = filtered.filter(print => bottomsPrintSizes.includes(print.print_size));
      console.log('PrintCatalog: After bottoms filter:', filtered.length);
    } else if (isSweatpants) {
      filtered = filtered.filter(print => bottomsPrintSizes.includes(print.print_size));
      console.log('PrintCatalog: After sweatpants filter:', filtered.length);
    } else if (isTShirt) {
      filtered = filtered.filter(print => 
        topsPrintSizes.includes(print.print_size) && print.print_size !== 'Sleeve'
      );
      console.log('PrintCatalog: After t-shirt filter:', filtered.length);
    } else if (isOnesie) {
      filtered = filtered.filter(print => 
        topsPrintSizes.includes(print.print_size) && print.print_size !== 'Sleeve'
      );
      console.log('PrintCatalog: After onesie filter:', filtered.length);
    } else if (selectedGarment) {
      filtered = filtered.filter(print => topsPrintSizes.includes(print.print_size));
      console.log('PrintCatalog: After general garment filter:', filtered.length);
    }
    
    // Check if we're in Cannon Beach
    const selectedLocation = localStorage.getItem('selectedLocation');
    let isCannonBeach = false;
    try {
      if (selectedLocation) {
        const locationData = JSON.parse(selectedLocation);
        isCannonBeach = locationData.name === 'Cannon Beach Freedom';
      }
    } catch (error) {
      console.error('Error checking location:', error);
    }
    
    // Sort prints by print_size
    const sizeOrder = ['Adult', 'Sleeve', 'Jr', 'Kid', 'Baby', 'Crest', 'Patch', 'Jr Sleeve', 'Kid Sleeve', 'Adult Leg', 'Jr Leg', 'Kid Leg', 'Leg'];
    filtered.sort((a, b) => {
      const indexA = sizeOrder.indexOf(a.print_size);
      const indexB = sizeOrder.indexOf(b.print_size);
      
      // If both are in the order list, sort by their index
      if (indexA !== -1 && indexB !== -1) {
        if (indexA !== indexB) return indexA - indexB;
        
        // If both have same print_size, sort by name prefix
        if (a.print_size === b.print_size) {
          const prefixA = a.name?.substring(0, 2)?.toUpperCase() || '';
          const prefixB = b.name?.substring(0, 2)?.toUpperCase() || '';
          
          // Move GA-prefix prints to the end
          const startsWithGA = prefixA.startsWith('G');
          const startsWithGB = prefixB.startsWith('G');

          if (startsWithGA && !startsWithGB) return 1; // A comes after B
          if (!startsWithGA && startsWithGB) return -1; // A comes before B
          // If both start or don't start with G, continue with normal sorting
          
          let prefixOrder;
          
          if (isCannonBeach) {
            // Cannon Beach specific ordering
            if (selectedCategory === 'all') {
              // All Categories in CB: CA, CC, Q, I, CJ, CB
              prefixOrder = ['CA', 'CC', 'Q', 'I', 'CJ', 'CB'];
            } else if (a.print_size === 'Adult') {
              // Adult category in CB: CA, I
              prefixOrder = ['CA', 'I'];
            } else {
              // Default for other categories
              prefixOrder = a.print_size === 'Adult' ? ['A', 'H', 'I'] : ['A', 'H'];
            }
          } else {
            // Default ordering for other locations
            prefixOrder = a.print_size === 'Adult' ? ['A', 'H', 'I'] : ['A', 'H'];
          }
          
          // Check if prefixes are 2-char codes
          const prefixIndexA = prefixOrder.indexOf(prefixA);
          const prefixIndexB = prefixOrder.indexOf(prefixB);
          
          if (prefixIndexA !== -1 && prefixIndexB !== -1) {
            if (prefixIndexA !== prefixIndexB) return prefixIndexA - prefixIndexB;
            // Same prefix, sort alphabetically by name
            return (a.name || '').localeCompare(b.name || '');
          }
          if (prefixIndexA !== -1) return -1;
          if (prefixIndexB !== -1) return 1;
          
          // If 2-char prefixes don't match, try single char
          const singleCharA = a.name?.[0]?.toUpperCase() || '';
          const singleCharB = b.name?.[0]?.toUpperCase() || '';
          const singleCharOrder = ['A', 'H', 'I'];
          const singleIndexA = singleCharOrder.indexOf(singleCharA);
          const singleIndexB = singleCharOrder.indexOf(singleCharB);
          
          if (singleIndexA !== -1 && singleIndexB !== -1) {
            if (singleIndexA !== singleIndexB) return singleIndexA - singleIndexB;
          }
          if (singleIndexA !== -1) return -1;
          if (singleIndexB !== -1) return 1;
          
          return (a.name || '').localeCompare(b.name || '');
        }
        
        return 0;
      }
      // If only A is in the list, it comes first
      if (indexA !== -1) return -1;
      // If only B is in the list, it comes first
      if (indexB !== -1) return 1;
      // If neither is in the list, maintain original order
      return 0;
    });
    
    console.log('PrintCatalog: Final filtered prints:', filtered.length);
    
    return filtered;
  })();

  const placementLabels = {
    'front': 'Front',
    'back': 'Back',
    'left_sleeve': 'Left Sleeve',
    'right_sleeve': 'Right Sleeve',
    'left_leg': 'Left Leg',
    'right_leg': 'Right Leg',
    'chest': 'Chest',
    'full_front': 'Full Front',
    'full_back': 'Full Back',
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

  const getPrintAreaForPlacement = (placement, garment) => {
    const isZipHoodie = garment?.style?.toLowerCase().includes('zip');
    const isSweatpants = garment?.style?.toLowerCase().includes('sweatpants');

    // For sweatpants, legs use separate print areas
    if (isSweatpants) {
      if (placement === 'Right Leg') return 'rprint-area';
      if (placement === 'Left Leg') return 'lprint-area';
    }

    // For zip hoodies, chest placements use separate print areas
    if (isZipHoodie) {
      if (placement === 'Front Right Chest') return 'rprint-area';
      if (placement === 'Front Left Chest') return 'lprint-area';
      if (placement === 'Front Center' || placement === 'Front Left Crest') return 'print-area-front';
    }

    // Sleeve placements
    if (placement === 'Right Sleeve') return 'rsleeve-area';
    if (placement === 'Left Sleeve') return 'lsleeve-area';

    // Back placements
    if (placement === 'Back Center' || placement === 'Back Shoulder') return 'print-area-back';

    // Front side placements
    if (placement === 'Front Right') return 'rprint-area';
    if (placement === 'Front Left') return 'lprint-area';

    // Front center placements
    if (placement === 'Front Center' || placement === 'Front Left Crest') return 'print-area-front';

    return 'print-area-front'; // default
  };

  const getViewForPlacement = (placement, styleConfigForLookup = null, print = null) => {
    if (placement === 'Custom') return null;
    
    // FIRST: Check placement name directly (handles all cases including Quarter Zip)
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
    if (!styleConfigForLookup || !print?.print_size) {
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
      'Patch': 'patch_placements',
      'Adult Leg': 'leg_placements',
      'Jr Leg': 'leg_placements',
      'Kid Leg': 'leg_placements',
      'Leg': 'leg_placements'
    };

    const printSizeKey = printSizeToKey[print.print_size];
    if (!printSizeKey || !styleConfigForLookup[printSizeKey]) return 'front';

    // Find the placement config for this exact placement name
    const placementConfig = styleConfigForLookup[printSizeKey].find(p => p.name === placement);
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
    const isYouthNonHoodieNonSweatpants = selectedGarment?.style?.toLowerCase().includes('youth') && !selectedGarment?.style?.toLowerCase().includes('hoodie') && !selectedGarment?.style?.toLowerCase().includes('sweatpants');
    
    console.log(`[getPrintsForView PrintCatalog] ========================================`);
    console.log(`[getPrintsForView PrintCatalog] Called for viewType: "${viewType}"`);
    console.log(`[getPrintsForView PrintCatalog] Total selectedPrints:`, selectedPrints.length);
    console.log(`[getPrintsForView PrintCatalog] isSweatpants:`, isSweatpants);
    console.log(`[getPrintsForView PrintCatalog] styleConfig:`, styleConfig ? 'loaded' : 'null');
    selectedPrints.forEach((p, idx) => {
      console.log(`[getPrintsForView PrintCatalog] Print ${idx}: name="${p.name}", placement="${p.placement}", print_size="${p.print_size}"`);
    });
    
    return selectedPrints.filter(p => {
      const placement = p.placement;
      const placementLower = (placement || '').toLowerCase().replace(/ /g, '_');
      
      console.log(`[getPrintsForView PrintCatalog] Checking print ${p.name}, placement="${p.placement}", placementLower="${placementLower}"`);
      
      if (isSweatpants || isYouthSweatpants) {
        if (viewType === 'front') {
          const matches = placementLower === 'right_leg' || placementLower === 'left_leg' || placementLower === 'standard';
          console.log(`[getPrintsForView PrintCatalog] Sweatpants front check for "${p.name}": ${matches} (placementLower: "${placementLower}")`);
          return matches;
        }
        console.log(`[getPrintsForView PrintCatalog] Sweatpants non-front: false`);
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
        const printView = getViewForPlacement(placement, styleConfig, p);
        const matches = printView === viewType;
        console.log(`[getPrintsForView PrintCatalog] "${p.name}" placement="${placement}" → view="${printView}" → matches "${viewType}"? ${matches}`);
        return matches;
      }
    });
  };

  return (
    <PullToRefresh onRefresh={loadSelections}>
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Filters Bar - Sticky */}
      <div className="sticky top-16 z-40 bg-background border-b border-border px-6 py-3">
        <div className="flex gap-4 items-end">
          {/* Category Dropdown */}
          <div className="w-48">
            <Label className="text-xs mb-1.5 block">Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-9">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {allCategories.map(category => (
                  <SelectItem key={category} value={category} className="capitalize">
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search Bar */}
          <div className="w-64">
            <Label className="text-xs mb-1.5 block">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search prints..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Start Over Button */}
          <div className="ml-auto">
            <Label className="text-xs mb-1.5 block opacity-0">Actions</Label>
            <Button
              variant="outline"
              onClick={handleStartOver}
              className="gap-1.5 text-[11px] h-9"
            >
              <RotateCcw className="w-3 h-3" />
              Start Over
            </Button>
          </div>

          {/* Total Price */}
          {showPreview && selectedGarment && (
            <div>
              <Label className="text-xs mb-1.5 block">Total</Label>
              <div className="text-foreground text-lg font-medium h-9 flex items-center px-3 bg-card rounded border border-border">
                ${(
                  (selectedGarment.cost || 0) + 
                  selectedPrints.reduce((sum, print) => sum + (print.cost || 0), 0)
                ).toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1">
        {/* Left Sidebar - Sticky */}
        <div className="w-56 flex-shrink-0 bg-background border-r border-border sticky top-[calc(4rem+57px)] h-[calc(100vh-4rem-57px)] overflow-y-auto">
          <div className="p-2 space-y-2">
            {/* Live Preview Section */}
            {showPreview && selectedGarment && (
              <div className="pb-2 border-b border-border">
                <div className="flex flex-col gap-1 px-3">
                  {selectedGarment.front_image_url && (
                    <div className="relative">
                      <div className="cursor-pointer" onClick={() => {
                        if (currentView === 'front') {
                          setExpandedView('front');
                        } else {
                          const frontIndex = availableViews.indexOf('front');
                          if (frontIndex !== -1) setCurrentViewIndex(frontIndex);
                        }
                      }}>
                        <div className={`w-full aspect-square bg-card rounded overflow-hidden border transition-colors scale-90 ${
                          currentView === 'front' ? 'border-green-500' : 'border-border hover:border-muted-foreground'
                        }`}>
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
                            className="w-full h-full flex items-center justify-center p-0.5"
                            fallback={<div className="text-sm">{selectedGarment.style?.toLowerCase().includes('sweatpants') ? '👖' : '👕'}</div>}
                          />
                        </div>
                      </div>
                      {getPrintsForView('front').some(p => !p.isAssemblyLocked) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updatedPrints = selectedPrints.filter(p => {
                              const isThisView = getViewForPlacement(p.placement, styleConfig, p) === 'front';
                              return !isThisView || p.isAssemblyLocked;
                            });
                            setSelectedPrints(updatedPrints);
                            localStorage.setItem('selectedPrints', JSON.stringify(updatedPrints));
                          }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-lg transition-colors"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      )}
                    </div>
                  )}

                  {availableViews.includes('back') && selectedGarment.back_image_url && (
                    <div className="relative">
                      <div className="cursor-pointer" onClick={() => {
                        if (currentView === 'back') {
                          setExpandedView('back');
                        } else {
                          const backIndex = availableViews.indexOf('back');
                          if (backIndex !== -1) setCurrentViewIndex(backIndex);
                        }
                      }}>
                        <div className={`w-full aspect-square bg-card rounded overflow-hidden border transition-colors scale-90 ${
                         currentView === 'back' ? 'border-green-500' : 'border-border hover:border-muted-foreground'
                        }`}>
                          <SvgImageWithPrint
                            garmentSrc={selectedGarment.back_image_url}
                            prints={getPrintsForView('back')}
                            maxPrintWidth={selectedGarment.back_max_print_width}
                            maxPrintHeight={selectedGarment.back_max_print_height}
                            styleConfig={styleConfig}
                            className="w-full h-full flex items-center justify-center p-0.5"
                            fallback={<div className="text-sm">👕</div>}
                          />
                        </div>
                      </div>
                      {getPrintsForView('back').some(p => !p.isAssemblyLocked) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updatedPrints = selectedPrints.filter(p => {
                              const isThisView = getViewForPlacement(p.placement, styleConfig, p) === 'back';
                              return !isThisView || p.isAssemblyLocked;
                            });
                            setSelectedPrints(updatedPrints);
                            localStorage.setItem('selectedPrints', JSON.stringify(updatedPrints));
                          }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-lg transition-colors"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      )}
                    </div>
                  )}

                  {availableViews.includes('right') && selectedGarment.rsleeve_image_url && (
                    <div className="relative">
                      <div className="cursor-pointer" onClick={() => {
                        if (currentView === 'right') {
                          setExpandedView('right');
                        } else {
                          const rightIndex = availableViews.indexOf('right');
                          if (rightIndex !== -1) setCurrentViewIndex(rightIndex);
                        }
                      }}>
                        <div className={`w-full aspect-square bg-card rounded overflow-hidden border transition-colors scale-90 ${
                         currentView === 'right' ? 'border-green-500' : 'border-border hover:border-muted-foreground'
                        }`}>
                          <SvgImageWithPrint
                           garmentSrc={selectedGarment.rsleeve_image_url || selectedGarment.rleg_image_url}
                           prints={getPrintsForView('right')}
                           maxPrintWidth={selectedGarment.rsleeve_max_print_width}
                           maxPrintHeight={selectedGarment.rsleeve_max_print_height}
                           styleConfig={styleConfig}
                           className="w-full h-full flex items-center justify-center p-0.5"
                           fallback={<div className="text-sm">👕</div>}
                          />
                        </div>
                      </div>
                      {getPrintsForView('right').some(p => !p.isAssemblyLocked) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updatedPrints = selectedPrints.filter(p => {
                              const isThisView = getViewForPlacement(p.placement, styleConfig, p) === 'right';
                              return !isThisView || p.isAssemblyLocked;
                            });
                            setSelectedPrints(updatedPrints);
                            localStorage.setItem('selectedPrints', JSON.stringify(updatedPrints));
                          }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-lg transition-colors"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      )}
                    </div>
                  )}

                  {availableViews.includes('left') && selectedGarment.lsleeve_image_url && (
                    <div className="relative">
                      <div className="cursor-pointer" onClick={() => {
                        if (currentView === 'left') {
                          setExpandedView('left');
                        } else {
                          const leftIndex = availableViews.indexOf('left');
                          if (leftIndex !== -1) setCurrentViewIndex(leftIndex);
                        }
                      }}>
                        <div className={`w-full aspect-square bg-card rounded overflow-hidden border transition-colors scale-90 ${
                         currentView === 'left' ? 'border-green-500' : 'border-border hover:border-muted-foreground'
                        }`}>
                          <SvgImageWithPrint
                           garmentSrc={selectedGarment.lsleeve_image_url || selectedGarment.lleg_image_url}
                           prints={getPrintsForView('left')}
                           maxPrintWidth={selectedGarment.lsleeve_max_print_width}
                           maxPrintHeight={selectedGarment.lsleeve_max_print_height}
                           styleConfig={styleConfig}
                           className="w-full h-full flex items-center justify-center p-0.5"
                           fallback={<div className="text-sm">👕</div>}
                          />
                        </div>
                      </div>
                      {getPrintsForView('left').some(p => !p.isAssemblyLocked) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updatedPrints = selectedPrints.filter(p => {
                              const isThisView = getViewForPlacement(p.placement, styleConfig, p) === 'left';
                              return !isThisView || p.isAssemblyLocked;
                            });
                            setSelectedPrints(updatedPrints);
                            localStorage.setItem('selectedPrints', JSON.stringify(updatedPrints));
                          }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-lg transition-colors"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      )}
                    </div>
                  )}
              </div>
            </div>
            )}


        </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 md:p-12 overflow-y-auto">



        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-64 md:h-80 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filteredPrints.map((print, index) => {
              const placements = getPrintPlacements(print.id);
              const isCurrentlySelected = isPrintSelected(print.id);

              return (
                <div key={print.id}>
                  <Card 
                    className={`cursor-pointer hover:shadow-lg transition-shadow duration-200 border-2 overflow-hidden rounded-xl ${
                      isCurrentlySelected ? 'border-muted-foreground shadow-lg' : 'border-transparent'
                    }`}
                    onClick={() => handlePrintClick(print)}
                  >
                    <CardContent className="p-0">
                      <div className="h-36 bg-gray-400 flex items-center justify-center relative overflow-hidden rounded-t-xl">
                        {print.image_url ? (
                          <img src={print.image_url} alt={print.name} className="w-full h-full object-contain p-2" loading="lazy" />
                        ) : (
                          <div className="text-2xl">🎨</div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />
                        {isCurrentlySelected && (
                          <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className="text-sm font-light text-foreground truncate">
                            {print.name}
                          </h3>
                          {(print.print_size === 'Crest' || print.print_size === 'Sleeve') && (
                            <span className="text-xs text-muted-foreground ml-1 flex-shrink-0">
                              {print.print_size}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-1.5 line-clamp-1">
                          {print.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-light text-foreground">
                            ${print.cost?.toFixed(2)}
                          </span>
                          {placements.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {placements.map((placement, i) => (
                                <Badge key={i} variant="outline" className="text-[9px] capitalize rounded-full py-0 px-1.5">
                                  {placementLabels[placement] || placement.replace('_', ' ')}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        <>
          {!showReplaceDialog && !blockPlacementDialog && (
            <Dialog open={showPlacementDialog} onOpenChange={(open) => {
              if (!open) {
                setShowPlacementDialog(false);
                setSelectedPlacement(null);
                setPrintNotes('');
              }
            }}>
              <DialogContent>
            <DialogHeader>
              <DialogTitle>Choose Placement for {currentPrint?.name}</DialogTitle>
            </DialogHeader>
            {currentPrint && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="w-40 h-40 md:w-48 md:h-48 bg-muted rounded-lg flex items-center justify-center overflow-hidden p-4">
                    {currentPrint.image_url ? (
                      <img 
                        src={currentPrint.image_url} 
                        alt={currentPrint.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-4xl">🎨</div>
                    )}
                  </div>
                </div>
                
                {currentPrint.width && currentPrint.height && (
                  <div className="text-center text-sm text-muted-foreground">
                    Print Size: {currentPrint.print_size} - {currentPrint.width}" × {currentPrint.height}"
                  </div>
                )}
                
                {getPrintPlacements(currentPrint.id).length > 0 && (
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-2">Current Placements:</p>
                    <div className="flex gap-2 flex-wrap">
                      {getPrintPlacements(currentPrint.id).map((placement, index) => {
                        const print = selectedPrints.find(p => p.id === currentPrint.id && p.placement === placement);
                        return (
                          <Badge key={index} variant="secondary" className={`text-sm py-2 px-3 gap-2 ${print?.isAssemblyLocked ? 'bg-yellow-900 text-yellow-200' : ''}`}>
                            {print?.isAssemblyLocked && '🔒 '}
                            {placementLabels[placement] || placement.replace('_', ' ')}
                            {!print?.isAssemblyLocked && (
                              <button
                                onClick={() => handleRemovePrint(currentPrint.id, placement)}
                                className="hover:text-red-400 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div>
                  <Label className="mb-3 block">Select Placement</Label>
                  {(() => {
                    const isSweatpants = selectedGarment?.style?.toLowerCase().includes('sweatpants');
                    const isZipOrQuarterZip = selectedGarment?.style?.toLowerCase().includes('zip hoodie') || 
                                               selectedGarment?.style?.toLowerCase().includes('quarter zip');
                    const isCrestPrint = currentPrint.print_size === 'Crest';
                    
                    const garmentTypeParam = urlParams.get('garment_type');
                    const isBottomsFlow = garmentTypeParam === 'bottoms' || currentPrint.garment_type === 'bottoms';

                    let possiblePlacements = [];
                    if ((isSweatpants || isBottomsFlow) && currentPrint.bottom_placements && currentPrint.bottom_placements.length > 0) {
                      possiblePlacements = currentPrint.bottom_placements;
                    } else if (currentPrint.front_placements && currentPrint.front_placements.length > 0) {
                      possiblePlacements = currentPrint.front_placements;
                    }

                    const isOnesie = selectedGarment?.style?.toLowerCase().includes('onesie');
                    if (isOnesie && isCrestPrint) {
                      possiblePlacements = possiblePlacements.filter(p => p !== 'Front Left Chest');
                      if (!possiblePlacements.includes('Front Center')) {
                        possiblePlacements = ['Front Center', ...possiblePlacements];
                      }
                    }

                    const isSleevePrint = currentPrint.print_size === 'Sleeve';
                    if (isZipOrQuarterZip && (isCrestPrint || isSleevePrint)) {
                      if (!possiblePlacements.includes('Front Right Chest')) {
                        possiblePlacements = [...possiblePlacements, 'Front Right Chest'];
                      }
                      if (!possiblePlacements.includes('Front Left Chest')) {
                        possiblePlacements = [...possiblePlacements, 'Front Left Chest'];
                      }
                    }

                    if (!possiblePlacements.includes('Custom')) {
                      possiblePlacements = [...possiblePlacements, 'Custom'];
                    }

                    // Filter by current view in preview mode
                    if (showPreview && currentView) {
                      possiblePlacements = possiblePlacements.filter(placement => {
                        if (placement === 'Custom') return true;
                        const view = getViewForPlacement(placement, styleConfig, currentPrint);
                        return view === currentView;
                      });
                    }

                    // Check if current view has locked prints - if so, don't allow adding more
                    const viewHasLockedPrint = selectedPrints.some(p => {
                      if (!p.isAssemblyLocked) return false;
                      const printView = getViewForPlacement(p.placement, styleConfig, p);
                      return printView === currentView;
                    });

                    if (viewHasLockedPrint) {
                      // Don't allow adding prints to views with locked assembly prints
                      possiblePlacements = [];
                    }

                    // Check which placements are already selected vs don't fit
                    const alreadySelectedPlacements = [];
                    const tooSmallPlacements = [];
                    
                    for (const option of possiblePlacements) {
                      const alreadySelected = selectedPrints.some(p => p.id === currentPrint.id && p.placement === option);
                      if (alreadySelected) {
                        alreadySelectedPlacements.push(option);
                        continue;
                      }

                      const view = getViewForPlacement(option, styleConfig, currentPrint);
                      let maxWidth, maxHeight;
                      const isQuarterZip = selectedGarment?.style?.toLowerCase().includes('quarter zip');

                      if (view === 'front') {
                        if (option === 'Right Leg') {
                          maxWidth = selectedGarment.rsleeve_max_print_width;
                          maxHeight = selectedGarment.rsleeve_max_print_height;
                        } else if (option === 'Left Leg') {
                          maxWidth = selectedGarment.lsleeve_max_print_width;
                          maxHeight = selectedGarment.lsleeve_max_print_height;
                        } else if (isQuarterZip && option === 'Front Right Chest') {
                          maxWidth = selectedGarment.rsleeve_max_print_width;
                          maxHeight = selectedGarment.rsleeve_max_print_height;
                        } else if (isQuarterZip && option === 'Front Left Chest') {
                          maxWidth = selectedGarment.lsleeve_max_print_width;
                          maxHeight = selectedGarment.lsleeve_max_print_height;
                        } else {
                          maxWidth = selectedGarment.front_max_print_width;
                          maxHeight = selectedGarment.front_max_print_height;
                        }
                      } else if (view === 'back') {
                        maxWidth = selectedGarment.back_max_print_width;
                        maxHeight = selectedGarment.back_max_print_height;
                      } else if (view === 'right' || view === 'left') {
                        maxWidth = selectedGarment.rsleeve_max_print_width; 
                        maxHeight = selectedGarment.rsleeve_max_print_height;
                      }

                      if (selectedGarment && currentPrint.width && currentPrint.height && maxWidth && maxHeight) {
                        if (currentPrint.width > maxWidth || currentPrint.height > maxHeight) {
                          tooSmallPlacements.push(option);
                        }
                      }
                    }
                    
                    const availablePlacements = possiblePlacements.filter(option => 
                      !alreadySelectedPlacements.includes(option) && !tooSmallPlacements.includes(option)
                    );

                    if (possiblePlacements.length === 0) {
                      if (viewHasLockedPrint) {
                        return (
                          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 text-center">
                            <p className="text-yellow-400 text-sm">
                              🔒 This view has a locked print from the assembly. You cannot add more prints here.
                            </p>
                          </div>
                        );
                      }
                      return (
                        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 text-center">
                          <p className="text-yellow-400 text-sm">
                            No placement options defined for this print. Please update the print's placement options in the admin panel.
                          </p>
                        </div>
                      );
                    }

                    if (availablePlacements.length === 0) {
                      // Check if all placements are already selected (vs don't fit)
                      if (alreadySelectedPlacements.length === possiblePlacements.length) {
                        return (
                          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 text-center">
                            <p className="text-blue-400 text-sm">
                              You already have this print on all available placements.
                            </p>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="space-y-3">
                          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-center">
                            <p className="text-red-400 text-sm">
                              This print is too large to fit on the selected garment.
                            </p>
                            {selectedGarment && currentPrint.width && currentPrint.height && (
                              <p className="text-red-400 text-xs mt-2">
                                Print: {currentPrint.width}" × {currentPrint.height}"<br/>
                                Max areas: 
                                Front: {selectedGarment.front_max_print_width || 'N/A'}" × {selectedGarment.front_max_print_height || 'N/A'}", 
                                Back: {selectedGarment.back_max_print_width || 'N/A'}" × {selectedGarment.back_max_print_height || 'N/A'}", 
                                Sleeves/Legs: {selectedGarment.rsleeve_max_print_width || 'N/A'}" × {selectedGarment.rsleeve_max_print_height || 'N/A'}"
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {possiblePlacements.map(option => (
                              <Button
                                key={option}
                                variant={selectedPlacement === option ? "default" : "outline"}
                                onClick={() => setSelectedPlacement(option)}
                                className={selectedPlacement === option 
                                  ? "bg-orange-600 hover:bg-orange-700 text-white" 
                                  : "border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white bg-white"
                                }
                              >
                                {placementLabels[option] || option.replace('_', ' ')} (Override)
                              </Button>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-2 gap-3">
                        {availablePlacements.map(option => (
                          <Button
                            key={option}
            variant={selectedPlacement === option ? "default" : "outline"}
                            onClick={() => setSelectedPlacement(option)}
                          >
                            {placementLabels[option] || option.replace('_', ' ')}
                          </Button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                
                <div>
                  <Label>
                    {selectedPlacement === 'Custom' ? 'Special Instructions (Required)' : 'Notes (Optional)'}
                  </Label>
                  {selectedPlacement === 'Custom' && (
                    <p className="text-xs text-yellow-400 mt-1">
                      This print will not be placed on the garment. Enter detailed instructions for custom placement.
                    </p>
                  )}
                  <Input
                    value={printNotes}
                    onChange={(e) => setPrintNotes(e.target.value)}
                    placeholder={selectedPlacement === 'Custom' ? 'Enter detailed placement instructions...' : 'Special instructions for this print...'}
                    className="mt-2"
                    autoFocus={selectedPlacement === 'Custom'}
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPlacementDialog(false);
                      setSelectedPlacement(null);
                      setPrintNotes('');
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddPrint}
                    disabled={!selectedPlacement || (selectedPlacement === 'Custom' && !printNotes.trim())}
                    className={`flex-1 text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedPlacement && (selectedPlacement !== 'Custom' || printNotes.trim())
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {selectedPrints.some(p => p.id === currentPrint.id && p.placement === selectedPlacement) ? 'Update Print' : 'Add Print'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
          </Dialog>
          )}

          <Dialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Replace Existing Print?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                There is already a print ("{existingPrintToReplace?.name}") on this view. 
                Do you want to replace it with "{currentPrint?.name}"?
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleReplaceCancel}
                  variant="outline"
                  className="flex-1"
                >
                  Keep Existing
                </Button>
                <Button
                  onClick={handleReplaceConfirm}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  Replace
                </Button>
              </div>
            </div>
            </DialogContent>
            </Dialog>
            </>

            <Dialog open={showStartOverDialog} onOpenChange={setShowStartOverDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start Over?</DialogTitle>
              <DialogDescription>
                This will clear all your selections and take you back to the home page.
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
        
        <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
          <DialogContent className="max-w-[90vw] md:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">Confirm Print Selection</DialogTitle>
              <DialogDescription>
                {existingPrintToReplace 
                  ? `Replace "${existingPrintToReplace.name}" with "${previewPrint?.name}"?`
                  : `Does this look good? Click "Yes, Continue" to add this print and select more, or "Finish" when done.`
                }
              </DialogDescription>
            </DialogHeader>
            {previewPrint && (
              <div className="space-y-4">
                <div className="w-full bg-muted rounded-2xl overflow-hidden" style={{ height: '50vh', maxHeight: '400px' }}>
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <SvgImageWithPrint
                      garmentSrc={
                        currentView === 'front' ? selectedGarment?.front_image_url :
                        currentView === 'back' ? selectedGarment?.back_image_url :
                        currentView === 'right' ? (selectedGarment?.rsleeve_image_url || selectedGarment?.rleg_image_url) :
                        (selectedGarment?.lsleeve_image_url || selectedGarment?.lleg_image_url)
                      }
                      prints={[
                       ...selectedPrints.filter(p => {
                         const pView = getViewForPlacement(p.placement, styleConfig, p);
                         const shouldInclude = pView === currentView && 
                           !(existingPrintToReplace && p.id === existingPrintToReplace.id && p.placement === existingPrintToReplace.placement);
                         return shouldInclude;
                       }), 
                       previewPrint
                      ]}
                      maxPrintWidth={
                        currentView === 'front' ? (selectedGarment?.style?.toLowerCase().includes('sweatpants') ? selectedGarment?.rsleeve_max_print_width : selectedGarment?.front_max_print_width) :
                        currentView === 'back' ? selectedGarment?.back_max_print_width :
                        currentView === 'right' ? selectedGarment?.rsleeve_max_print_width :
                        selectedGarment?.lsleeve_max_print_width
                      }
                      maxPrintHeight={
                        currentView === 'front' ? (selectedGarment?.style?.toLowerCase().includes('sweatpants') ? selectedGarment?.rsleeve_max_print_height : selectedGarment?.front_max_print_height) :
                        currentView === 'back' ? selectedGarment?.back_max_print_height :
                        currentView === 'right' ? selectedGarment?.rsleeve_max_print_height :
                        selectedGarment?.lsleeve_max_print_height
                      }
                      rMaxPrintWidth={selectedGarment?.rsleeve_max_print_width}
                      rMaxPrintHeight={selectedGarment?.rsleeve_max_print_height}
                      lMaxPrintWidth={selectedGarment?.lsleeve_max_print_width}
                      lMaxPrintHeight={selectedGarment?.lsleeve_max_print_height}
                      styleConfig={styleConfig}
                      className="max-w-full max-h-full rounded-xl"
                      fallback={<div className="text-4xl">👕</div>}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleRejectPrint}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2 h-16 text-lg"
                  >
                    <X className="w-6 h-6" />
                    {existingPrintToReplace ? 'Keep Original' : 'No, Choose Different'}
                  </Button>
                  <Button
                    onClick={handleConfirmPrint}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2 h-16 text-lg"
                  >
                    <Check className="w-6 h-6" />
                    Yes, Continue
                  </Button>
                </div>
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

      {(selectedPrints.length > 0 || showPreview) && (
        <div className="flex flex-col gap-3 fixed right-6 z-50 print-catalog-buttons" style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom) + 4rem)' }}>
          <style>{`
            @media (min-width: 768px) {
              .print-catalog-buttons {
                bottom: calc(1.5rem + env(safe-area-inset-bottom)) !important;
              }
            }
          `}</style>
          {showBackToTop && (
            <Button
              onClick={scrollToTop}
              variant="outline"
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-2xl px-6 py-6 text-lg border-0"
            >
              <ArrowUp className="w-5 h-5" />
              Back To Top
            </Button>
          )}
          <Button
            onClick={showPreview ? handleFinish : handleContinue}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-2xl px-6 py-6 text-lg"
          >
            {showPreview ? 'Next' : `Continue with ${selectedPrints.length} Print${selectedPrints.length > 1 ? 's' : ''}`}
          </Button>
        </div>
      )}



      <PrimaryMatchesDialog
        open={showPrimaryMatchesDialog}
        onClose={() => {
          setShowPrimaryMatchesDialog(false);
          setPrintForPrimaryMatches(null);
        }}
        selectedPrint={printForPrimaryMatches}
        selectedGarment={selectedGarment}
        onConfirm={handlePrimaryMatchesConfirm}
        currentView={currentView}
        styleConfig={styleConfig}
      />

      <Dialog open={expandedView !== null} onOpenChange={() => setExpandedView(null)}>
        <DialogContent className="max-w-[90vw] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {expandedView === 'front' && (selectedGarment?.style?.toLowerCase().includes('sweatpants') ? 'Sweatpants' : 'Front View')}
              {expandedView === 'back' && 'Back View'}
              {expandedView === 'right' && 'Right Sleeve / Leg'}
              {expandedView === 'left' && 'Left Sleeve / Leg'}
            </DialogTitle>
          </DialogHeader>
          <div className="w-full bg-muted rounded-2xl overflow-hidden" style={{ height: '60vh', maxHeight: '500px' }}>
            <div className="w-full h-full flex items-center justify-center p-4">
              {expandedView === 'front' && (
                <div className="w-full h-full flex items-center justify-center rounded-xl overflow-hidden">
                  <SvgImageWithPrint
                    garmentSrc={selectedGarment?.front_image_url}
                    prints={getPrintsForView('front')}
                    maxPrintWidth={selectedGarment?.style?.toLowerCase().includes('sweatpants') ? selectedGarment?.rsleeve_max_print_width : selectedGarment?.front_max_print_width}
                    maxPrintHeight={selectedGarment?.style?.toLowerCase().includes('sweatpants') ? selectedGarment?.rsleeve_max_print_height : selectedGarment?.front_max_print_height}
                    rMaxPrintWidth={selectedGarment?.rsleeve_max_print_width}
                    rMaxPrintHeight={selectedGarment?.rsleeve_max_print_height}
                    lMaxPrintWidth={selectedGarment?.lsleeve_max_print_width}
                    lMaxPrintHeight={selectedGarment?.lsleeve_max_print_height}
                    styleConfig={styleConfig}
                    className="max-w-full max-h-full rounded-xl"
                    fallback={<div className="text-4xl">👕</div>}
                  />
                </div>
              )}
              {expandedView === 'back' && !selectedGarment?.style?.toLowerCase().includes('sweatpants') && (
                <div className="w-full h-full flex items-center justify-center rounded-xl overflow-hidden">
                  <SvgImageWithPrint
                    garmentSrc={selectedGarment?.back_image_url}
                    prints={getPrintsForView('back')}
                    maxPrintWidth={selectedGarment?.back_max_print_width}
                    maxPrintHeight={selectedGarment?.back_max_print_height}
                    styleConfig={styleConfig}
                    className="max-w-full max-h-full rounded-xl"
                    fallback={<div className="text-4xl">👕</div>}
                  />
                </div>
              )}
              {expandedView === 'right' && !selectedGarment?.style?.toLowerCase().includes('sweatpants') && (
                <div className="w-full h-full flex items-center justify-center rounded-xl overflow-hidden">
                  <SvgImageWithPrint
                    garmentSrc={selectedGarment?.rsleeve_image_url || selectedGarment?.rleg_image_url}
                    prints={getPrintsForView('right')}
                    maxPrintWidth={selectedGarment?.rsleeve_max_print_width}
                    maxPrintHeight={selectedGarment?.rsleeve_max_print_height}
                    styleConfig={styleConfig}
                    className="max-w-full max-h-full rounded-xl"
                    fallback={<div className="text-4xl">👕</div>}
                  />
                </div>
              )}
              {expandedView === 'left' && !selectedGarment?.style?.toLowerCase().includes('sweatpants') && (
                <div className="w-full h-full flex items-center justify-center rounded-xl overflow-hidden">
                  <SvgImageWithPrint
                    garmentSrc={selectedGarment?.lsleeve_image_url || selectedGarment?.lleg_image_url}
                    prints={getPrintsForView('left')}
                    maxPrintWidth={selectedGarment?.lsleeve_max_print_width}
                    maxPrintHeight={selectedGarment?.lsleeve_max_print_height}
                    styleConfig={styleConfig}
                    className="max-w-full max-h-full rounded-xl"
                    fallback={<div className="text-4xl">👕</div>}
                  />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
    </PullToRefresh>
  );
}