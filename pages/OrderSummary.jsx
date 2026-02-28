import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Download, Trash2, Scan, Search } from "lucide-react";
import PrintReceipt from "../components/order/PrintReceipt";
import OrderBuildCard from "../components/order/OrderBuildCard";
import WaxProtectionDialog from "../components/order/WaxProtectionDialog";
import CustomerDialog from "../components/order/CustomerDialog";
import AddPrintDialog from "../components/order/AddPrintDialog";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Define wax protection system IDs and prices
const WAX_PROTECTION_SYSTEM_IDS = [
  { system_id: '210000001578', price: 0.00 },
  { system_id: '210000001577', price: 3.00 },
  { system_id: '210000001576', price: 5.00 },
  { system_id: '210000001575', price: 7.00 },
  { system_id: '210000009650', price: 10.00 },
  { system_id: '210000010665', price: 15.00 },
];

// Wax discount system IDs for custom pricing
const WAX_DISCOUNT_SYSTEM_IDS = {
  1: '210000016207',
  2: '210000016208',
  3: '210000016209',
  4: '210000016210',
  5: '210000016211',
  6: '210000016212',
  7: '210000016213',
  8: '210000016214',
  9: '210000016215',
  10: '210000016216',
  11: '210000016217',
  12: '210000016218',
  13: '210000016219',
  14: '210000016220',
  15: '210000016221',
};

export default function OrderSummary() {
  const navigate = useNavigate();
  const [orderBuilds, setOrderBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showWaxProtectionDialog, setShowWaxProtectionDialog] = useState(false);
  const [selectedWaxOption, setSelectedWaxOption] = useState(null);
  const [waxDialogStep, setWaxDialogStep] = useState(1); // 1=first offer, 2=had before?, 3=custom price
  const [customWaxPrice, setCustomWaxPrice] = useState('');
  const [selectedBuildForWax, setSelectedBuildForWax] = useState(null);
  const [customerInfo, setCustomerInfo] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [existingCustomerID, setExistingCustomerID] = useState(null);
  const [customerStep, setCustomerStep] = useState('phone'); // 'phone' or 'details'
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showStartOverDialog, setShowStartOverDialog] = useState(false);
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [insufficientItems, setInsufficientItems] = useState([]);
  const [saleID, setSaleID] = useState(null);
  const [employeeCode, setEmployeeCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showAddPrintDialog, setShowAddPrintDialog] = useState(false);
  const [selectedBuildForPrint, setSelectedBuildForPrint] = useState(null);
  const [printSearchQuery, setPrintSearchQuery] = useState('');
  const [searchedPrints, setSearchedPrints] = useState([]);
  const [selectedPrint, setSelectedPrint] = useState(null);
  const [selectedPlacement, setSelectedPlacement] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [waxProtectionOptions, setWaxProtectionOptions] = useState([]);
  const [waxDiscountItems, setWaxDiscountItems] = useState({});
  const [waxItemsLoading, setWaxItemsLoading] = useState(true);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogSearchResults, setCatalogSearchResults] = useState([]);
  const [searchingCatalog, setSearchingCatalog] = useState(false);
  const [vinylItems, setVinylItems] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [placementDisplayNames, setPlacementDisplayNames] = useState({});
  const [cartToast, setCartToast] = useState(null);

  useEffect(() => {
    loadOrderData();
    loadLogo();
    loadWaxProtectionItems();
    loadVinylItems();
    loadPlacementDisplayNames();
    const storedEmployeeCode = localStorage.getItem('employeeCode');
    if (storedEmployeeCode) {
      setEmployeeCode(storedEmployeeCode);
    }
    
    // Check for auto-scan barcode
    const autoScanBarcode = localStorage.getItem('autoScanBarcode');
    if (autoScanBarcode) {
      localStorage.removeItem('autoScanBarcode');
      // Auto-trigger barcode scan after a short delay
      setTimeout(() => {
        handleBarcodeScan(autoScanBarcode);
      }, 500);
    }
  }, []);

  const loadLogo = async () => {
    try {
      const selectedLocation = localStorage.getItem('selectedLocation');
      let logoIdentifier = 'receipt_logo_freedom';
      
      if (selectedLocation) {
        const locationData = JSON.parse(selectedLocation);
        const locationName = locationData.name;
        
        if (locationName === 'Sharkys') {
          logoIdentifier = 'receipt_logo_sharkys';
        } else if (locationName === 'Cannon Beach Freedom') {
          logoIdentifier = 'receipt_logo_cannon_beach';
        }
      }
      
      const icons = await base44.entities.CustomIcon.filter({ identifier: logoIdentifier });
      if (icons.length > 0 && icons[0].icon_url) {
        setLogoUrl(icons[0].icon_url);
      }
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  };

  const loadWaxProtectionItems = async () => {
    try {
      setWaxItemsLoading(true);
      // Load wax protection items
      const waxOptions = [];
      for (const item of WAX_PROTECTION_SYSTEM_IDS) {
        const merchandise = await base44.entities.Merchandise.filter({ system_id: item.system_id });
        if (merchandise.length > 0 && merchandise[0].itemID) {
          waxOptions.push({
            name: merchandise[0].name,
            system_id: item.system_id,
            itemID: merchandise[0].itemID,
            price: item.price
          });
        }
      }
      setWaxProtectionOptions(waxOptions);

      // Load wax discount items
      const discountItems = {};
      for (const [amount, system_id] of Object.entries(WAX_DISCOUNT_SYSTEM_IDS)) {
        const merchandise = await base44.entities.Merchandise.filter({ system_id });
        if (merchandise.length > 0 && merchandise[0].itemID) {
          discountItems[amount] = {
            system_id,
            itemID: merchandise[0].itemID,
            name: merchandise[0].name
          };
        }
      }
      setWaxDiscountItems(discountItems);
      console.log('Loaded wax protection options:', waxOptions);
      console.log('Loaded wax discount items:', discountItems);
    } catch (error) {
      console.error('Error loading wax protection items:', error);
    } finally {
      setWaxItemsLoading(false);
    }
  };

  const loadVinylItems = async () => {
    try {
      const merchandise = await base44.entities.Merchandise.list();
      const vinyl = merchandise.filter(item => 
        item.name?.startsWith('Custom') || item.name?.startsWith('Printed')
      );
      setVinylItems(vinyl);
    } catch (error) {
      console.error('Error loading vinyl items:', error);
    }
  };

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

  const loadOrderData = async () => {
    const storedOrder = localStorage.getItem('orderBuilds');
    console.log('Stored order builds:', storedOrder);

    if (storedOrder) {
      try {
        const builds = JSON.parse(storedOrder);
        console.log('Parsed order builds:', builds);
        
        // Debug: Check system_id for each item
        builds.forEach((build, index) => {
          console.log(`Build ${index}:`);
          console.log('  - Garment system_id:', build.garment?.system_id);
          console.log('  - Garment object:', build.garment);
          console.log('  - Prints:', build.prints?.map(p => ({ name: p.name, system_id: p.system_id })));
          console.log('  - Wax Protection system_id:', build.wax_protection?.system_id);
        });
        
        setOrderBuilds(builds);
      } catch (error) {
        console.error('Error parsing order builds:', error);
        setOrderBuilds([]);
      }
    } else {
      setOrderBuilds([]);
    }

    setLoading(false);
  };

  const handleRemoveBuild = (index) => {
    const updatedBuilds = orderBuilds.filter((_, i) => i !== index);
    setOrderBuilds(updatedBuilds);
    localStorage.setItem('orderBuilds', JSON.stringify(updatedBuilds));
  };

  const handleEditBuild = async (index) => {
    const build = orderBuilds[index];

    // Check if this is an assembly item that needs to be decomposed
    if (build.isScannedItem && build.isAssembly && build.assemblyComponents) {
      // Extract components
      const components = Array.isArray(build.assemblyComponents.ItemComponent) 
        ? build.assemblyComponents.ItemComponent 
        : [build.assemblyComponents.ItemComponent];
      
      // Find garment component
      let garmentComponent = null;
      const printComponents = [];
      
      for (const component of components) {
        const componentItemID = component.componentItemID;
        
        // Try to match to garment
        const matchedGarments = await base44.entities.Garment.filter({ itemID: componentItemID });
        if (matchedGarments.length > 0) {
          garmentComponent = matchedGarments[0];
          continue;
        }
        
        // Try to match to print
        const matchedPrints = await base44.entities.Print.filter({ itemID: componentItemID });
        if (matchedPrints.length > 0) {
          printComponents.push(matchedPrints[0]);
        }
      }
      
      if (!garmentComponent) {
        alert('Could not find garment component for this assembly');
        return;
      }
      
      // Determine print placements based on print_size and mark as locked
      const printsWithPlacements = printComponents.map(print => {
        console.log('[handleEditBuild] Processing print component:', { 
          name: print.name, 
          print_size: print.print_size 
        });
        
        let placement = 'Front Center'; // Default
        
        // Map print_size to placement
        const printSize = print.print_size || '';
        if (printSize === 'Adult' || printSize === 'Jr' || printSize === 'Kid' || printSize === 'Baby') {
          placement = 'Front Center';
        } else if (printSize === 'Sleeve') {
          placement = 'Right Sleeve';
        } else if (printSize === 'Crest') {
          placement = 'Front Left Chest';
        } else if (printSize.includes('Leg')) {
          placement = 'Right Leg';
        }
        
        console.log('[handleEditBuild] Assigned placement:', placement);
        
        return {
          ...print,
          placement: placement,
          isAssemblyLocked: true
        };
      });
      
      // Store the prints
      localStorage.setItem('selectedPrints', JSON.stringify(printsWithPlacements));
      
      // Store which build we're editing
      localStorage.setItem('editingBuildIndex', index.toString());
      
      // Navigate to preview with the garment's parameters
      const params = new URLSearchParams();
      params.set('color', garmentComponent.color);
      params.set('style', garmentComponent.style);
      params.set('size', garmentComponent.size);
      params.set('flow', 'color');
      navigate(createPageUrl(`Preview?${params.toString()}`));
      return;
    }

    // Regular build or scanned item without assembly
    // Store the prints for this build
    localStorage.setItem('selectedPrints', JSON.stringify(build.prints || []));

    // Store which build we're editing
    localStorage.setItem('editingBuildIndex', index.toString());

    if (build.isScannedItem) {
      // Can't edit scanned items
      alert('Cannot edit scanned items');
      return;
    }

    // Navigate to preview with the build's parameters
    const params = new URLSearchParams();
    params.set('garmentId', build.garment?.id);
    params.set('color', build.color);
    params.set('style', build.style);
    params.set('size', build.size);
    params.set('flow', 'color');
    navigate(createPageUrl(`Preview?${params.toString()}`));
  };

  const handlePlaceOrder = async () => {
    // Show confirmation dialog first
    setShowConfirmDialog(true);
  };

  const handleConfirmPlaceOrder = async () => {
    setShowConfirmDialog(false);
    setStatusMessage('Checking inventory...');
    
    // Get selected location
    const selectedLocationData = localStorage.getItem('selectedLocation');
    if (!selectedLocationData) {
      alert('No location selected');
      setStatusMessage('');
      return;
    }
    
    const selectedLocation = JSON.parse(selectedLocationData);
    if (!selectedLocation.shopID) {
      alert('Selected location has no Shop ID configured. Please contact an administrator.');
      setStatusMessage('');
      return;
    }
    
    // Check if we're editing an existing active order
    const editingActiveOrderId = localStorage.getItem('editingActiveOrderId');
    
    // Prepare items to check - use stored itemID from database
    const itemsToCheck = [];
    orderBuilds.forEach(build => {
      // Check if this is a scanned item
      if (build.isScannedItem) {
        itemsToCheck.push({
          name: build.description || `Scanned Item (${build.systemSku})`,
          system_id: build.systemSku,
          itemID: build.itemID,
          quantity: 1,
          type: 'scanned',
          buildIndex: orderBuilds.indexOf(build)
        });

        // Add prints for scanned item
        build.prints?.forEach(print => {
          if (print.itemID) {
            itemsToCheck.push({
              name: print.name,
              system_id: print.system_id,
              itemID: print.itemID,
              quantity: 1,
              type: 'print',
              placement: print.placement,
              buildIndex: orderBuilds.indexOf(build)
            });
          }
        });
        return;
      }

      // Add garment
      if (build.garment?.itemID) {
        itemsToCheck.push({
          name: `${build.size} ${build.color} ${build.garment.style}`,
          system_id: build.garment.system_id,
          itemID: build.garment.itemID,
          quantity: 1,
          type: 'garment',
          buildIndex: orderBuilds.indexOf(build)
        });
      }

      // Add prints
      build.prints.forEach(print => {
        if (print.itemID) {
          itemsToCheck.push({
            name: print.name,
            system_id: print.system_id,
            itemID: print.itemID,
            quantity: 1,
            type: 'print',
            placement: print.placement,
            buildIndex: orderBuilds.indexOf(build)
          });
        }
      });

      // Wax protection is not an inventory item - skip inventory check
    });
    
    setSubmitting(true);
    try {
      const response = await base44.functions.invoke('lightspeedCheckInventory', {
        items: itemsToCheck,
        shopID: selectedLocation.shopID,
        locationId: selectedLocation.id
      });
      
      if (response.data.success && response.data.hasInsufficientInventory) {
        setInsufficientItems(response.data.insufficientItems);
        setShowInventoryDialog(true);
        setSubmitting(false);
        setStatusMessage('');
        return;
      }
      
      setStatusMessage('');
      
      // If editing an active order, skip customer dialog and update directly
      if (editingActiveOrderId) {
        await createSaleInLightspeed();
      } else {
        // If new order, show customer dialog
        setShowCustomerDialog(true);
      }
    } catch (error) {
      console.error('Error checking inventory:', error);
      alert('Failed to check inventory. Please try again.');
      setStatusMessage('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipCustomerInfo = async () => {
    setShowCustomerDialog(false);
    setSubmitting(true);
    setStatusMessage('Creating sale...');

    try {
      // Use default customer ID 6210
      await createSaleInLightspeed('6210');
    } catch (error) {
      console.error('Error creating sale:', error);
      alert('Failed to create sale in POS. Please try again.');
      setSubmitting(false);
      setStatusMessage('');
    }
  };

  const createSaleInLightspeed = async (customerID = null) => {
    try {
      const selectedLocationData = localStorage.getItem('selectedLocation');
      if (!selectedLocationData) {
        throw new Error('No location selected');
      }
      
      const selectedLocation = JSON.parse(selectedLocationData);
      
      // Check if wax items are still loading
      if (waxItemsLoading) {
        throw new Error('Wax protection items are still loading. Please wait and try again.');
      }
      
      // Prepare items for sale
      const items = [];
      for (const build of orderBuilds) {
      // Check if this is a scanned item
      if (build.isScannedItem) {
        // Validate itemID - should not be a system_id (system_ids are typically > 1000000)
        const itemID = build.itemID;
        if (!itemID || parseInt(itemID) > 1000000) {
          throw new Error(`Invalid itemID for scanned item: ${itemID}. This appears to be a system_id, not an itemID.`);
        }
        items.push({
          itemID: build.itemID,
          quantity: build.quantity || 1,
          note: `Scanned Item (${build.systemSku})`
        });

        // Add prints for scanned item
        build.prints?.forEach(print => {
          if (print.itemID) {
            const itemID = print.itemID;
            if (parseInt(itemID) > 1000000) {
              throw new Error(`Invalid itemID for print "${print.name}": ${itemID}. This appears to be a system_id, not an itemID.`);
            }
            items.push({
              itemID: print.itemID,
              quantity: 1,
              note: `${print.name} - ${print.placement}`
            });
          }
        });

        // Add wax protection for scanned item if present
        if (build.wax_protection) {
          // Look up itemID from Merchandise database using system_id
          const waxMerchandise = await base44.entities.Merchandise.filter({ system_id: build.wax_protection.system_id });
          if (waxMerchandise.length === 0 || !waxMerchandise[0].itemID) {
            throw new Error(`Wax protection item ${build.wax_protection.system_id} not found in database. Please sync merchandise items.`);
          }
          
          const waxItemID = waxMerchandise[0].itemID;
          items.push({
            itemID: waxItemID,
            quantity: 1,
            note: `Wax Protection`
          });

          // Calculate discount amount (from discountAmount or finalPrice)
          const discountAmt = build.wax_protection.discountAmount || 
                              (build.wax_protection.finalPrice 
                                ? build.wax_protection.price - build.wax_protection.finalPrice 
                                : 0);
          const roundedDiscount = Math.round(discountAmt);

          if (roundedDiscount > 0) {
            // Look up discount item from Merchandise database
            const discountSystemId = WAX_DISCOUNT_SYSTEM_IDS[roundedDiscount];
            if (discountSystemId) {
              const discountMerchandise = await base44.entities.Merchandise.filter({ system_id: discountSystemId });
              if (discountMerchandise.length > 0 && discountMerchandise[0].itemID) {
                items.push({
                  itemID: discountMerchandise[0].itemID,
                  quantity: 1,
                  note: `Wax Discount -$${roundedDiscount}`
                });
              }
            }
          }
        }
        return;
      }

      // Add garment
      if (build.garment?.itemID) {
        const itemID = build.garment.itemID;
        if (parseInt(itemID) > 1000000) {
          throw new Error(`Invalid itemID for garment "${build.garment.name}": ${itemID}. This appears to be a system_id, not an itemID.`);
        }
        items.push({
          itemID: build.garment.itemID,
          quantity: 1,
          note: `${build.size} ${build.color} ${build.garment.style}`
        });
      }

      // Add prints
      build.prints?.forEach(print => {
        if (print.itemID) {
          const itemID = print.itemID;
          if (parseInt(itemID) > 1000000) {
            throw new Error(`Invalid itemID for print "${print.name}": ${itemID}. This appears to be a system_id, not an itemID.`);
          }
          items.push({
            itemID: print.itemID,
            quantity: 1,
            note: `${print.name} - ${print.placement}`
          });
        }
      });

      // Add wax protection if present
      if (build.wax_protection) {
        // Look up itemID from Merchandise database using system_id
        const waxMerchandise = await base44.entities.Merchandise.filter({ system_id: build.wax_protection.system_id });
        if (waxMerchandise.length === 0 || !waxMerchandise[0].itemID) {
          throw new Error(`Wax protection item ${build.wax_protection.system_id} not found in database. Please sync merchandise items.`);
        }
        
        const waxItemID = waxMerchandise[0].itemID;
        items.push({
          itemID: waxItemID,
          quantity: 1,
          note: `Wax Protection`
        });

        // Calculate discount amount (from discountAmount or finalPrice)
        const discountAmt = build.wax_protection.discountAmount || 
                            (build.wax_protection.finalPrice 
                              ? build.wax_protection.price - build.wax_protection.finalPrice 
                              : 0);
        const roundedDiscount = Math.round(discountAmt);

        if (roundedDiscount > 0) {
          // Look up discount item from Merchandise database
          const discountSystemId = WAX_DISCOUNT_SYSTEM_IDS[roundedDiscount];
          if (discountSystemId) {
            const discountMerchandise = await base44.entities.Merchandise.filter({ system_id: discountSystemId });
            if (discountMerchandise.length > 0 && discountMerchandise[0].itemID) {
              items.push({
                itemID: discountMerchandise[0].itemID,
                quantity: 1,
                note: `Wax Discount -$${roundedDiscount}`
              });
            }
          }
        }
      }

      // Add vinyl items if present
      if (build.vinyl_items) {
        for (const vinyl of build.vinyl_items) {
          if (vinyl.itemID) {
            items.push({
              itemID: vinyl.itemID,
              quantity: 1,
              note: vinyl.name
            });
          }
        }
      }
    }

    // Check if we're editing an existing order
    const editingActiveOrderId = localStorage.getItem('editingActiveOrderId');
    let saleResponse;
    
    if (editingActiveOrderId) {
      // Get the existing sale ID from the active order
      const activeOrder = await base44.entities.ActiveOrder.filter({ id: editingActiveOrderId });
      if (activeOrder.length > 0) {
        const existingSaleID = activeOrder[0].sale_id;
        console.log('Updating existing sale:', existingSaleID);
        
        // Update the existing sale
        saleResponse = await base44.functions.invoke('lightspeedUpdateSale', {
          saleID: existingSaleID,
          items,
          shopID: selectedLocation.shopID,
          registerID: selectedLocation.registerID,
          employeeCode: employeeCode,
          customerID: customerID,
          locationId: selectedLocation.id
        });
      }
    } else {
      // Create new sale
      console.log('=== CREATING NEW SALE ===');
      console.log('Items:', JSON.stringify(items, null, 2));
      console.log('Items count:', items.length);
      console.log('Shop ID:', selectedLocation.shopID);
      console.log('Register ID:', selectedLocation.registerID);
      console.log('Employee Code:', employeeCode);
      console.log('Customer ID:', customerID || '(none)');
      console.log('Location ID:', selectedLocation.id);
      
      saleResponse = await base44.functions.invoke('lightspeedCreateSale', {
        items,
        shopID: selectedLocation.shopID,
        registerID: selectedLocation.registerID,
        employeeCode: employeeCode,
        customerID: customerID,
        locationId: selectedLocation.id
      });
    }

    console.log('=== SALE RESPONSE ===');
    console.log('Full response:', JSON.stringify(saleResponse, null, 2));
    console.log('Response data:', JSON.stringify(saleResponse.data, null, 2));
    console.log('Response status:', saleResponse.status);

    if (!saleResponse.data.success) {
      console.error('=== SALE CREATION FAILED ===');
      console.error('Error:', saleResponse.data.error);
      console.error('Status Code:', saleResponse.data.statusCode);
      console.error('Request that was sent:', JSON.stringify(saleResponse.data.requestSent, null, 2));
      throw new Error(saleResponse.data.error || 'Failed to create sale');
    }

    if (saleResponse.data.success && saleResponse.data.saleID) {
                const newSaleID = saleResponse.data.saleID;
                setSaleID(newSaleID);

                // Print immediate receipt with Sale ID and Employee Code
                const selectedLocationData = localStorage.getItem('selectedLocation');
                if (selectedLocationData) {
                  const selectedLocation = JSON.parse(selectedLocationData);

                  // Build minimal receipt
                  let receiptContent = '[align: center]\n';
                  if (logoUrl) {
                    receiptContent += `[image: url ${logoUrl}; width 380;]\n`;
                  }
                  receiptContent += `[font: size large; style bold]FREEDOM APPAREL[font]\n`;
                  receiptContent += `[font: size normal; style bold]Employee: ${employeeCode || 'N/A'}[font]\n`;
                  receiptContent += '\n[align: center]\n';
                  receiptContent += `[font: size xlarge; style bold]Sale ID: ${newSaleID}[font]\n`;
                  receiptContent += `[barcode: type code128; data ${newSaleID}; height 120; hri bottom;]\n`;
                  receiptContent += '\n[align: center]\n';
                  receiptContent += `[font: size normal; style bold]Thank You![font]\n`;
                  receiptContent += '[cut: feed; partial]\n';

                  try {
                    await base44.functions.invoke('starIOPrint', {
                      receipt_data: receiptContent,
                      location_id: selectedLocation.id
                    });
                  } catch (printError) {
                    console.error('Failed to print immediate receipt:', printError);
                  }
                }

                // Check if we're editing an existing active order
                const editingActiveOrderId = localStorage.getItem('editingActiveOrderId');

                if (editingActiveOrderId) {
                  // Update existing active order
                  await base44.entities.ActiveOrder.update(editingActiveOrderId, {
                    sale_id: newSaleID,
                    order_data: JSON.stringify(orderBuilds),
                    customer_name: customerName || null,
                    total: orderBuilds.reduce((sum, build) => {
                      let itemTotal = build.garment?.cost || 0;
                      itemTotal += build.prints.reduce((pSum, p) => pSum + (p.cost || 0), 0);
                      itemTotal += build.wax_protection?.finalPrice || build.wax_protection?.price || 0;
                      return sum + itemTotal;
                    }, 0)
                  });

                  localStorage.removeItem('editingActiveOrderId');
                } else {
                  // Create new active order
                  await base44.entities.ActiveOrder.create({
                    sale_id: newSaleID,
                    employee_code: employeeCode,
                    location_id: selectedLocation.id || selectedLocation.name,
                    customer_name: customerName || null,
                    customer_phone: customerInfo.phone || null,
                    customer_email: customerInfo.email || null,
                    order_data: JSON.stringify(orderBuilds),
                    total: orderBuilds.reduce((sum, build) => {
                      let itemTotal = build.garment?.cost || 0;
                      itemTotal += build.prints.reduce((pSum, p) => pSum + (p.cost || 0), 0);
                      itemTotal += build.wax_protection?.finalPrice || build.wax_protection?.price || 0;
                      return sum + itemTotal;
                    }, 0)
                  });
                }

                // Log preprint bypass if applicable
                const preprintBypass = localStorage.getItem('preprintBypass');
                if (preprintBypass) {
                  try {
                    const bypassData = JSON.parse(preprintBypass);
                    const selectedLocationData = localStorage.getItem('selectedLocation');
                    const storedEmployeeCode = localStorage.getItem('employeeCode');
                    
                    if (selectedLocationData) {
                      const location = JSON.parse(selectedLocationData);
                      const employees = await base44.entities.EmployeeCode.filter({ code: storedEmployeeCode });
                      const employeeName = employees.length > 0 ? employees[0].employee_name : storedEmployeeCode;
                      
                      await base44.entities.PreprintLog.create({
                        sale_id: newSaleID,
                        preprint_system_id: bypassData.preprint_system_id,
                        blank_system_id: bypassData.blank_system_id,
                        print1_system_id: bypassData.print1_system_id,
                        print2_system_id: bypassData.print2_system_id,
                        location_name: location.name,
                        employee_name: employeeName,
                        reason: 'User chose to produce anyway'
                      });
                    }
                    localStorage.removeItem('preprintBypass');
                  } catch (error) {
                    console.error('Error logging preprint bypass:', error);
                  }
                }

                // Clear the order after placing
                localStorage.removeItem('orderBuilds');
                localStorage.removeItem('selectedPrints');
                localStorage.removeItem('editingBuildIndex');

                // Navigate to Home page to start a new order
                navigate(createPageUrl("Home"));
              } else {
                throw new Error('Failed to create sale');
              }
    } catch (error) {
      console.error('Error in createSaleInLightspeed:', error);
      alert(`Failed to create sale: ${error.message}`);
      setSubmitting(false);
      setStatusMessage('');
      throw error;
    }
  };

  const handleSearchCustomer = async () => {
    if (!customerInfo.phone.trim()) {
      alert('Please enter a phone number');
      return;
    }

    const selectedLocationData = localStorage.getItem('selectedLocation');
    if (!selectedLocationData) {
      alert('No location selected');
      return;
    }

    const selectedLocation = JSON.parse(selectedLocationData);

    setSearchingCustomer(true);
    setStatusMessage('Checking customer...');
    try {
      // Clean phone number for searching (remove formatting)
      const cleanPhone = customerInfo.phone.replace(/\D/g, '');
      
      // Search local CustomerInformation database first - fetch ALL customers in batches
      let allCustomers = [];
      let skip = 0;
      const limit = 5000;
      
      while (true) {
        const batch = await base44.entities.CustomerInformation.list('-created_date', limit, skip);
        allCustomers = allCustomers.concat(batch);
        
        if (batch.length < limit) {
          break;
        }
        
        skip += limit;
      }
      
      const localCustomer = allCustomers.find(c => {
        const homeClean = (c.home || '').replace(/\D/g, '');
        const workClean = (c.work || '').replace(/\D/g, '');
        const mobileClean = (c.mobile || '').replace(/\D/g, '');
        return homeClean === cleanPhone || workClean === cleanPhone || mobileClean === cleanPhone;
      });

      if (localCustomer) {
        // Customer found in local database
        console.log('Customer found in local database:', localCustomer);
        const nameParts = (localCustomer.name || '').trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        setCustomerInfo({
          firstName: firstName,
          lastName: lastName,
          phone: customerInfo.phone,
          email: localCustomer.email || ''
        });
        setExistingCustomerID(localCustomer.customerID || null);
        setCustomerStep('details');
      } else {
        // Not in local database - new customer
        console.log('Customer not found in local database, will create new');
        setExistingCustomerID(null);
        setCustomerStep('details');
      }
    } catch (error) {
      console.error('Error searching customer:', error);
      alert(`Failed to search for customer: ${error.message}`);
      setStatusMessage('');
    } finally {
      setSearchingCustomer(false);
      setStatusMessage('');
    }
  };

  const handleSubmitOrder = async () => {
    if (!customerInfo.firstName.trim() || !customerInfo.lastName.trim() || !customerInfo.phone.trim()) {
      alert('Please fill in all required fields (First Name, Last Name, and Phone Number)');
      return;
    }

    const selectedLocationData = localStorage.getItem('selectedLocation');
    if (!selectedLocationData) {
      alert('No location selected');
      return;
    }

    const selectedLocation = JSON.parse(selectedLocationData);

    setSubmitting(true);
    setStatusMessage(existingCustomerID ? 'Updating customer...' : 'Creating customer...');
    try {
      let customerID;
      const cleanPhone = customerInfo.phone.replace(/\D/g, '');

      if (existingCustomerID) {
        // Update existing customer in Lightspeed
        const updateResponse = await base44.functions.invoke('lightspeedUpdateCustomer', {
          customerID: existingCustomerID,
          firstName: customerInfo.firstName,
          lastName: customerInfo.lastName,
          phone: customerInfo.phone,
          email: customerInfo.email,
          locationId: selectedLocation.id
        });

        if (updateResponse.data.success) {
          customerID = existingCustomerID;
          
          // Also update local CustomerInformation database
          const allCustomers = await base44.entities.CustomerInformation.list();
          const localCustomer = allCustomers.find(c => c.customerID === existingCustomerID);
          
          if (localCustomer) {
            await base44.entities.CustomerInformation.update(localCustomer.id, {
              name: `${customerInfo.firstName} ${customerInfo.lastName}`,
              home: cleanPhone,
              email: customerInfo.email,
              customerID: existingCustomerID
            });
          }
        } else {
          throw new Error('Failed to update customer');
        }
      } else {
        // Create new customer in Lightspeed
        const posResponse = await base44.functions.invoke('createPosCustomer', {
          firstName: customerInfo.firstName,
          lastName: customerInfo.lastName,
          phone: customerInfo.phone,
          email: customerInfo.email,
          locationId: selectedLocation.id
        });

        if (posResponse.data.success && posResponse.data.customerID) {
          customerID = posResponse.data.customerID;
          
          // Also create in local CustomerInformation database
          await base44.entities.CustomerInformation.create({
            name: `${customerInfo.firstName} ${customerInfo.lastName}`,
            home: cleanPhone,
            email: customerInfo.email,
            customerID: customerID
          });
        } else {
          throw new Error('Failed to create customer');
        }
      }

      // Save customer name and close dialog
      setCustomerName(`${customerInfo.firstName} ${customerInfo.lastName}`);
      setShowCustomerDialog(false);
      setCustomerStep('phone');
      setCustomerInfo({ firstName: '', lastName: '', phone: '', email: '' });
      setExistingCustomerID(null);
      setStatusMessage('Creating sale...');
      await createSaleInLightspeed(customerID);

    } catch (error) {
      console.error('Error placing order:', error);

      if (error.response?.status === 401 || error.response?.data?.needsReauth) {
        alert('POS connection expired. Please contact an administrator to re-authorize POS Setup.');
      } else {
        alert('Failed to place order. Please try again.');
      }
      setStatusMessage('');
    } finally {
      setSubmitting(false);
      setStatusMessage('');
    }
  };

  const handleClearOrder = () => {
    setShowClearDialog(true);
  };

  const confirmClearOrder = () => {
    localStorage.removeItem('orderBuilds');
    localStorage.removeItem('selectedPrints');
    localStorage.removeItem('editingBuildIndex');
    setOrderBuilds([]);
    setShowClearDialog(false);
  };

  // Derived state to check if wax protection is applied to ALL items
  const isWaxProtectionAppliedToAllItems = useMemo(() => {
    return orderBuilds.length > 0 && orderBuilds.every(build => build.wax_protection);
  }, [orderBuilds]);

  // Calculate total price
  const totalPrice = useMemo(() => {
    return orderBuilds.reduce((sum, build) => {
      if (build.isScannedItem) {
        const qty = build.quantity || 1;
        let itemTotal = (build.price || 0) * qty;
        itemTotal += build.prints?.reduce((pSum, p) => pSum + (p.cost || 0), 0) || 0;
        return sum + itemTotal;
      }
      let itemTotal = build.garment?.cost || 0;
      itemTotal += build.prints.reduce((pSum, p) => pSum + (p.cost || 0), 0);
      itemTotal += build.wax_protection?.finalPrice || build.wax_protection?.price || 0;
      itemTotal += build.vinyl_items?.reduce((vSum, v) => vSum + (v.price || 0), 0) || 0;
      return sum + itemTotal;
    }, 0);
  }, [orderBuilds]);

  // Calculate recommended wax price based on number of prints for a specific build
  const getRecommendedWaxPrice = (buildIndex = null) => {
    if (buildIndex !== null) {
      const build = orderBuilds[buildIndex];
      const printCount = build?.prints?.length || 0;
      return printCount >= 2 ? 15 : 10;
    }
    // Fallback: Count total prints across all items
    const totalPrints = orderBuilds.reduce((sum, build) => sum + (build.prints?.length || 0), 0);
    return totalPrints >= 2 ? 15 : 10;
  };

  // Handler for applying selected wax protection to specific item
  const handleApplyWaxProtection = (waxOption) => {
    if (!waxOption || !waxOption.itemID) {
      alert('Wax protection item not found in database. Please go to Admin > Merchandise and sync items from Lightspeed first.');
      return;
    }
    
    // Validate that itemID is actually an itemID and not a system_id
    if (parseInt(waxOption.itemID) > 1000000) {
      alert(`Error: The stored value appears to be a system_id (${waxOption.itemID}) instead of an itemID. Please re-sync merchandise items from Lightspeed.`);
      return;
    }
    
    // Ensure all properties are included
    const waxData = {
      name: waxOption.name,
      system_id: waxOption.system_id,
      itemID: waxOption.itemID,
      price: waxOption.price
    };
    console.log('Applying wax protection to build:', selectedBuildForWax, waxData);
    
    const updatedBuilds = [...orderBuilds];
    updatedBuilds[selectedBuildForWax] = {
      ...updatedBuilds[selectedBuildForWax],
      wax_protection: waxData,
    };
    
    setOrderBuilds(updatedBuilds);
    localStorage.setItem('orderBuilds', JSON.stringify(updatedBuilds));
    setShowWaxProtectionDialog(false);
    setWaxDialogStep(1);
    setCustomWaxPrice('');
    setSelectedWaxOption(null);
    setSelectedBuildForWax(null);
  };

  // Handler for applying custom wax price to specific item
  const handleApplyCustomWaxPrice = () => {
    const customPrice = parseFloat(customWaxPrice);
    if (isNaN(customPrice) || customPrice < 0) {
      alert('Please enter a valid price');
      return;
    }

    const recommendedPrice = getRecommendedWaxPrice(selectedBuildForWax);
    
    // Find the full-price wax option
    const fullPriceWax = waxProtectionOptions.find(opt => opt.price === recommendedPrice);
    if (!fullPriceWax || !fullPriceWax.itemID) {
      alert('Error: Could not find wax protection option. Please go to Admin > Merchandise and sync items from Lightspeed first.');
      return;
    }
    
    // Validate that itemID is actually an itemID and not a system_id
    if (parseInt(fullPriceWax.itemID) > 1000000) {
      alert(`Error: The stored value appears to be a system_id (${fullPriceWax.itemID}) instead of an itemID. Please re-sync merchandise items from Lightspeed.`);
      return;
    }

    // Calculate discount amount
    const discountAmount = recommendedPrice - customPrice;
    
    // If there's a discount, validate the discount item exists
    if (discountAmount > 0) {
      const roundedDiscount = Math.round(discountAmount);
      const discountItem = waxDiscountItems[roundedDiscount];
      if (!discountItem || !discountItem.itemID) {
        alert(`Error: Discount item for $${roundedDiscount} not found. Please sync merchandise items from Lightspeed.`);
        return;
      }
      if (parseInt(discountItem.itemID) > 1000000) {
        alert(`Error: The discount item has a system_id (${discountItem.itemID}) instead of an itemID. Please re-sync merchandise items from Lightspeed.`);
        return;
      }
    }

    // Apply wax to specific item with proper discount structure
    const updatedBuilds = [...orderBuilds];
    updatedBuilds[selectedBuildForWax] = {
      ...updatedBuilds[selectedBuildForWax],
      wax_protection: {
        system_id: fullPriceWax.system_id,
        itemID: fullPriceWax.itemID,
        name: fullPriceWax.name,
        price: fullPriceWax.price,
        discountAmount: discountAmount > 0 ? discountAmount : 0,
        finalPrice: customPrice
      }
    };

    setOrderBuilds(updatedBuilds);
    localStorage.setItem('orderBuilds', JSON.stringify(updatedBuilds));
    setShowWaxProtectionDialog(false);
    setWaxDialogStep(1);
    setCustomWaxPrice('');
    setSelectedBuildForWax(null);
  };

  // Handler for removing wax protection from specific item
  const handleRemoveWaxProtection = () => {
    const updatedBuilds = [...orderBuilds];
    updatedBuilds[selectedBuildForWax] = {
      ...updatedBuilds[selectedBuildForWax],
      wax_protection: undefined,
    };
    setOrderBuilds(updatedBuilds);
    localStorage.setItem('orderBuilds', JSON.stringify(updatedBuilds));
    setShowWaxProtectionDialog(false);
    setWaxDialogStep(1);
    setCustomWaxPrice('');
    setSelectedBuildForWax(null);
  };

  const handlePrintSearch = async (query) => {
    setPrintSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchedPrints([]);
      return;
    }
    
    try {
      // Get current location
      const selectedLocationData = localStorage.getItem('selectedLocation');
      let locationCode = '';
      if (selectedLocationData) {
        const location = JSON.parse(selectedLocationData);
        if (location.name === 'Freedom') locationCode = 'FR';
        else if (location.name === 'Sharkys') locationCode = 'SH';
        else if (location.name === 'Cannon Beach Freedom') locationCode = 'CB';
      }
      
      const prints = await base44.entities.Print.filter({ is_active: true }, '-created_date', 1000);
      const filtered = prints.filter(p => {
        // Check name match
        if (!p.name || !p.name.toLowerCase().includes(query.toLowerCase())) {
          return false;
        }
        // Check location availability
        if (locationCode && p.availability) {
          return p.availability.includes(locationCode);
        }
        return true;
      });
      setSearchedPrints(filtered);
    } catch (error) {
      console.error('Error searching prints:', error);
      setSearchedPrints([]);
    }
  };

  const handleSelectPrint = (print) => {
    setSelectedPrint(print);
    // Determine placement options based on garment type
    if (print.garment_type === 'bottoms' && print.bottom_placements?.length > 0) {
      setSelectedPlacement(print.bottom_placements[0]);
    } else if (print.front_placements?.length > 0) {
      setSelectedPlacement(print.front_placements[0]);
    } else {
      setSelectedPlacement('Front');
    }
  };

  const handleAddPrintToScannedItem = () => {
    if (!selectedPrint || selectedBuildForPrint === null) return;
    
    const updatedBuilds = [...orderBuilds];
    const build = updatedBuilds[selectedBuildForPrint];
    
    if (!build.prints) {
      build.prints = [];
    }
    
    build.prints.push({
      ...selectedPrint,
      placement: selectedPlacement
    });
    
    setOrderBuilds(updatedBuilds);
    localStorage.setItem('orderBuilds', JSON.stringify(updatedBuilds));
    
    // Reset dialog state
    setShowAddPrintDialog(false);
    setSelectedBuildForPrint(null);
    setPrintSearchQuery('');
    setSearchedPrints([]);
    setSelectedPrint(null);
    setSelectedPlacement('');
  };

  const handleCatalogSearch = async (query) => {
    setCatalogSearchQuery(query);
    
    if (query.trim().length < 2) {
      setCatalogSearchResults([]);
      return;
    }
    
    setSearchingCatalog(true);
    
    try {
      const selectedLocationData = localStorage.getItem('selectedLocation');
      let locationCode = '';
      if (selectedLocationData) {
        const location = JSON.parse(selectedLocationData);
        if (location.name === 'Freedom') locationCode = 'FR';
        else if (location.name === 'Sharkys') locationCode = 'SH';
        else if (location.name === 'Cannon Beach Freedom') locationCode = 'CB';
      }
      
      const lowerQuery = query.toLowerCase();
      const results = [];
      
      // Search prints
      const prints = await base44.entities.Print.filter({ is_active: true }, '-created_date', 1000);
      prints.forEach(print => {
        const matchesName = print.name?.toLowerCase().includes(lowerQuery);
        const matchesDesc = print.description?.toLowerCase().includes(lowerQuery);
        const matchesSystemId = print.system_id?.toLowerCase().includes(lowerQuery);
        const matchesLocation = !locationCode || !print.availability || print.availability.includes(locationCode);
        
        if ((matchesName || matchesDesc || matchesSystemId) && matchesLocation) {
          results.push({
            ...print,
            type: 'print',
            displayName: print.name,
            displayPrice: print.cost
          });
        }
      });
      
      // Search garments
      const garments = await base44.entities.Garment.list('-created_date', 1000);
      garments.forEach(garment => {
        const matchesName = garment.name?.toLowerCase().includes(lowerQuery);
        const matchesSystemId = garment.system_id?.toLowerCase().includes(lowerQuery);
        const matchesColor = garment.color?.toLowerCase().includes(lowerQuery);
        const matchesStyle = garment.style?.toLowerCase().includes(lowerQuery);
        const matchesLocation = !locationCode || !garment.availability || garment.availability.includes(locationCode);
        
        if ((matchesName || matchesSystemId || matchesColor || matchesStyle) && matchesLocation) {
          results.push({
            ...garment,
            type: 'garment',
            displayName: `${garment.size} ${garment.color} ${garment.style}`,
            displayPrice: garment.cost
          });
        }
      });
      
      // Search merchandise
      const merchandise = await base44.entities.Merchandise.list('-created_date', 1000);
      merchandise.forEach(item => {
        const matchesName = item.name?.toLowerCase().includes(lowerQuery);
        const matchesSystemId = item.system_id?.toLowerCase().includes(lowerQuery);
        
        if (matchesName || matchesSystemId) {
          results.push({
            ...item,
            type: 'merchandise',
            displayName: item.name,
            displayPrice: item.price
          });
        }
      });
      
      setCatalogSearchResults(results);
    } catch (error) {
      console.error('Error searching catalog:', error);
      setCatalogSearchResults([]);
    } finally {
      setSearchingCatalog(false);
    }
  };

  const handleAddCatalogItem = (item) => {
    if (item.type === 'garment') {
      // Add garment as new build
      const newBuild = {
        garment: item,
        color: item.color,
        style: item.style,
        size: item.size,
        prints: []
      };
      
      const updatedBuilds = [...orderBuilds, newBuild];
      setOrderBuilds(updatedBuilds);
      localStorage.setItem('orderBuilds', JSON.stringify(updatedBuilds));
    } else if (item.type === 'print') {
      if (orderBuilds.length === 0) {
        return;
      }
      
      // Add print to the last item in order
      const updatedBuilds = [...orderBuilds];
      const lastBuild = updatedBuilds[updatedBuilds.length - 1];
      
      const placement = item.garment_type === 'bottoms' && item.bottom_placements?.length > 0
        ? item.bottom_placements[0]
        : item.front_placements?.[0] || 'Front';
      
      lastBuild.prints.push({
        ...item,
        placement: placement
      });
      
      setOrderBuilds(updatedBuilds);
      localStorage.setItem('orderBuilds', JSON.stringify(updatedBuilds));
    } else if (item.type === 'merchandise') {
      // Check if same merch item already exists, increment quantity if so
      const updatedBuilds = [...orderBuilds];
      const existingIdx = updatedBuilds.findIndex(b => b.isScannedItem && b.itemType === 'merchandise' && b.systemSku === item.system_id);
      if (existingIdx >= 0) {
        updatedBuilds[existingIdx] = { ...updatedBuilds[existingIdx], quantity: (updatedBuilds[existingIdx].quantity || 1) + 1 };
      } else {
        updatedBuilds.push({
          systemSku: item.system_id,
          itemID: item.itemID,
          description: item.name,
          price: item.price || 0,
          itemType: 'merchandise',
          isScannedItem: true,
          isAssembly: false,
          assemblyComponents: null,
          prints: [],
          quantity: 1
        });
      }
      setOrderBuilds(updatedBuilds);
      localStorage.setItem('orderBuilds', JSON.stringify(updatedBuilds));
      setCartToast(item.name);
      setTimeout(() => setCartToast(null), 3000);
    }
    
    // Clear search
    setCatalogSearchQuery('');
    setCatalogSearchResults([]);
  };

  // Send log to server
  const logToServer = async (message, level = 'info', data = null) => {
    try {
      await base44.entities.DeviceLog.create({
        message,
        level,
        data: data ? JSON.stringify(data) : null,
        device_info: navigator.userAgent
      });
    } catch (error) {
      console.error('Failed to send log to server:', error);
    }
  };

  // Handle barcode scan
  const handleBarcodeScan = async (barcode) => {
    try {
      await logToServer('Barcode scanned', 'info', { barcode });
      console.log('Scanned barcode:', barcode);
      
      // Look up garment by system_id
      const garments = await base44.entities.Garment.filter({ system_id: barcode });
      await logToServer('Garments search result', 'info', { barcode, count: garments.length });
      console.log('Garments found:', garments.length);
      
      if (garments.length > 0) {
        const garment = garments[0];
        
        // Create a new build with this garment
        const newBuild = {
          garment: garment,
          color: garment.color,
          style: garment.style,
          size: garment.size,
          prints: []
        };
        
        const updatedBuilds = [...orderBuilds, newBuild];
        setOrderBuilds(updatedBuilds);
        localStorage.setItem('orderBuilds', JSON.stringify(updatedBuilds));
        
        alert(`Added ${garment.size} ${garment.color} ${garment.style} to order`);
        return;
      }
      
      // Look up print by system_id
      const prints = await base44.entities.Print.filter({ system_id: barcode });
      await logToServer('Prints search result', 'info', { barcode, count: prints.length });
      console.log('Prints found:', prints.length);
      
      if (prints.length > 0) {
        const print = prints[0];
        
        if (orderBuilds.length === 0) {
          alert('Please add a garment first before adding prints');
          return;
        }
        
        // Add print to the last item in order
        const updatedBuilds = [...orderBuilds];
        const lastBuild = updatedBuilds[updatedBuilds.length - 1];
        
        // Ask for placement (simplified - add to front by default)
        const placement = print.garment_type === 'bottoms' && print.bottom_placements?.length > 0
          ? print.bottom_placements[0]
          : print.front_placements?.[0] || 'Front';
        
        lastBuild.prints.push({
          ...print,
          placement: placement
        });
        
        setOrderBuilds(updatedBuilds);
        localStorage.setItem('orderBuilds', JSON.stringify(updatedBuilds));
        
        alert(`Added ${print.name} to last item in order`);
        return;
      }
      
      // Check Preprints by system_id or UPC (via Merchandise lookup)
      await logToServer('Checking preprints for barcode', 'info', { barcode });
      
      // First try to match preprint directly by preprint_system_id
      let preprints = await base44.entities.Preprint.filter({ preprint_system_id: barcode, is_active: true });
      
      // If no match by system_id, try to find a matching Merchandise item by UPC, then check preprint by its system_id
      if (preprints.length === 0) {
        const mercByUpc = await base44.entities.Merchandise.filter({ upc: barcode });
        if (mercByUpc.length > 0 && mercByUpc[0].system_id) {
          preprints = await base44.entities.Preprint.filter({ preprint_system_id: mercByUpc[0].system_id, is_active: true });
        }
      }

      if (preprints.length > 0) {
        const preprint = preprints[0];
        await logToServer('Preprint found', 'info', { preprint_system_id: preprint.preprint_system_id });

        // Look up the blank garment and prints that make up this preprint
        const [blankGarments, print1Results, print2Results] = await Promise.all([
          base44.entities.Garment.filter({ system_id: preprint.blank_system_id }),
          preprint.print1_system_id ? base44.entities.Print.filter({ system_id: preprint.print1_system_id }) : Promise.resolve([]),
          preprint.print2_system_id ? base44.entities.Print.filter({ system_id: preprint.print2_system_id }) : Promise.resolve([])
        ]);

        if (blankGarments.length === 0) {
          alert(`Preprint found but blank garment (${preprint.blank_system_id}) not found in database.`);
          return;
        }

        const garment = blankGarments[0];
        const prints = [];

        if (print1Results.length > 0) {
          const print = print1Results[0];
          const printSize = print.print_size || '';
          let placement = 'Front Center';
          if (printSize === 'Sleeve') placement = 'Right Sleeve';
          else if (printSize === 'Crest') placement = 'Front Left Chest';
          else if (printSize.includes('Leg')) placement = 'Right Leg';
          prints.push({ ...print, placement, isAssemblyLocked: true });
        }

        if (print2Results.length > 0) {
          const print = print2Results[0];
          const printSize = print.print_size || '';
          let placement = preprint.print2_placement || 'Front Center';
          if (!preprint.print2_placement) {
            if (printSize === 'Sleeve') placement = 'Right Sleeve';
            else if (printSize === 'Crest') placement = 'Front Left Chest';
            else if (printSize.includes('Leg')) placement = 'Right Leg';
          }
          prints.push({ ...print, placement, isAssemblyLocked: true });
        }

        localStorage.setItem('selectedPrints', JSON.stringify(prints));

        // Add the preprint as a new build and navigate to preview
        const newBuild = {
          garment,
          color: garment.color,
          style: garment.style,
          size: garment.size,
          prints,
          isPreprintScan: true,
          preprintSystemId: preprint.preprint_system_id
        };

        const updatedBuilds = [...orderBuilds, newBuild];
        setOrderBuilds(updatedBuilds);
        localStorage.setItem('orderBuilds', JSON.stringify(updatedBuilds));
        localStorage.setItem('editingBuildIndex', (updatedBuilds.length - 1).toString());

        const params = new URLSearchParams();
        params.set('color', garment.color);
        params.set('style', garment.style);
        params.set('size', garment.size);
        params.set('flow', 'color');
        navigate(createPageUrl(`Preview?${params.toString()}`));
        return;
      }

      // Not a preprint — check Merchandise (by system_id or UPC)
      await logToServer('Checking merchandise for barcode', 'info', { barcode });
      let merchandiseResults = await base44.entities.Merchandise.filter({ system_id: barcode });
      if (merchandiseResults.length === 0) {
        merchandiseResults = await base44.entities.Merchandise.filter({ upc: barcode });
      }

      if (merchandiseResults.length > 0) {
        const item = merchandiseResults[0];
        await logToServer('Merchandise found', 'info', { name: item.name, system_id: item.system_id });

        const updatedBuilds = [...orderBuilds];
        const existingIdx = updatedBuilds.findIndex(b => b.isScannedItem && b.itemType === 'merchandise' && b.systemSku === item.system_id);
        if (existingIdx >= 0) {
          updatedBuilds[existingIdx] = { ...updatedBuilds[existingIdx], quantity: (updatedBuilds[existingIdx].quantity || 1) + 1 };
        } else {
          updatedBuilds.push({
            systemSku: item.system_id,
            itemID: item.itemID,
            description: item.name,
            price: item.price || 0,
            itemType: 'merchandise',
            isScannedItem: true,
            isAssembly: false,
            assemblyComponents: null,
            prints: [],
            quantity: 1
          });
        }
        setOrderBuilds(updatedBuilds);
        localStorage.setItem('orderBuilds', JSON.stringify(updatedBuilds));
        setCartToast(item.name);
        setTimeout(() => setCartToast(null), 3000);
        return;
      }

      await logToServer('Item not found', 'warn', { barcode });
      alert('Item not found. Please check the barcode and try again.');
    } catch (error) {
      await logToServer('Barcode scan error', 'error', { barcode, error: error.message });
      console.error('Error looking up barcode:', error);
      alert('Error scanning barcode. Please try again.');
    }
  };





  if (loading) {
    return (
      <div className="min-h-[calc(10vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-100"></div>
      </div>
    );
  }

  if (orderBuilds.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
        <Card className="border-0 shadow-lg p-12 text-center">
          <h2 className="text-2xl font-light mb-4">No items in order</h2>
          <p className="text-muted-foreground mb-6">Start building your custom apparel</p>
          <Button onClick={() => navigate(createPageUrl("Home"))}>
            Start Building
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12">
      <PrintReceipt
        orderBuilds={orderBuilds}
        saleID={saleID}
        employeeCode={employeeCode}
        logoUrl={logoUrl}
        placementDisplayNames={placementDisplayNames}
      />

      {/* Item added to cart toast */}
      {cartToast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg text-sm font-medium pointer-events-none"
        >
          ✓ {cartToast} added to cart
        </motion.div>
      )}

      <div className="max-w-7xl mx-auto no-print">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          {/* Catalog Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                value={catalogSearchQuery}
                onChange={(e) => handleCatalogSearch(e.target.value)}
                placeholder="Search entire catalog by name, description, or system ID..."
                className="pl-12 pr-4 py-6 text-lg"
              />
            </div>
            
            {/* Search Results Dropdown */}
            {catalogSearchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 max-w-2xl bg-card border border-border rounded-lg shadow-lg max-h-96 overflow-y-auto"
              >
                {catalogSearchResults.map((item, index) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="p-4 hover:bg-muted cursor-pointer border-b border-border last:border-b-0 flex items-center gap-4"
                    onClick={() => handleAddCatalogItem(item)}
                  >
                    {item.type === 'print' && item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.displayName}
                        className="w-12 h-12 object-contain bg-white rounded"
                      />
                    )}
                    {item.type === 'merchandise' && item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.displayName}
                        className="w-12 h-12 object-contain bg-white rounded"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-foreground font-medium">{item.displayName}</p>
                        <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                          {item.type}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        System ID: {item.system_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-foreground font-medium">${item.displayPrice?.toFixed(2) || '0.00'}</p>
                      <p className="text-xs text-muted-foreground">Click to add</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
            
            {searchingCatalog && (
              <div className="mt-2 max-w-2xl bg-card border border-border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
                Searching...
              </div>
            )}
            
            {catalogSearchQuery.trim().length >= 2 && catalogSearchResults.length === 0 && !searchingCatalog && (
              <div className="mt-2 max-w-2xl bg-card border border-border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
                No items found
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate(createPageUrl("Home"))}
              className="gap-2 self-start"
            >
              <ArrowLeft className="w-4 h-4" />
              Add More Items
            </Button>
            <div className="flex flex-col md:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setShowBarcodeDialog(true)}
                className="gap-2"
              >
                <Scan className="w-4 h-4" />
                Scan Barcode
              </Button>
              <Button
                variant="outline"
                onClick={handleClearOrder}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear Order
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSaleID('PREVIEW-TEST');
                  setTimeout(() => window.print(), 100);
                }}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Preview Receipt
              </Button>
              <div className="flex flex-col items-end gap-2">
                <div className="text-2xl font-bold">
                  Total: ${totalPrice.toFixed(2)}
                </div>
                <Button
                  onClick={handlePlaceOrder}
                  className="gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
                  disabled={submitting || waxItemsLoading}
                >
                  {waxItemsLoading ? 'Loading...' : (statusMessage || 'Confirm Order')}
                </Button>
              </div>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-light mb-2">
            Order Summary
          </h1>
          <p className="text-muted-foreground font-light">
            {orderBuilds.length} item{orderBuilds.length !== 1 ? 's' : ''} in order
          </p>
        </motion.div>

        {/* Each Build */}
        {orderBuilds.map((build, buildIndex) => (
          <OrderBuildCard
            key={buildIndex}
            build={build}
            buildIndex={buildIndex}
            placementDisplayNames={placementDisplayNames}
            vinylItems={vinylItems}
            orderBuilds={orderBuilds}
            setOrderBuilds={setOrderBuilds}
            onEdit={handleEditBuild}
            onRemove={handleRemoveBuild}
            onManageWax={(idx) => { setSelectedBuildForWax(idx); setShowWaxProtectionDialog(true); }}
            onAddPrint={(idx) => { setSelectedBuildForPrint(idx); setShowAddPrintDialog(true); }}
          />
        ))}
      </div>

      {/* Confirm Order Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Order</DialogTitle>
            <DialogDescription>
              Are you sure you're done with your order? You cannot make any changes after this.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={() => setShowConfirmDialog(false)}
              variant="outline"
              className="flex-1"
            >
              No
            </Button>
            <Button
              onClick={handleConfirmPlaceOrder}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              Yes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Order Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear entire order?</DialogTitle>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={() => setShowClearDialog(false)}
              variant="outline"
              className="flex-1"
            >
              No
            </Button>
            <Button
              onClick={confirmClearOrder}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              Yes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CustomerDialog
        open={showCustomerDialog}
        onOpenChange={setShowCustomerDialog}
        customerStep={customerStep}
        setCustomerStep={setCustomerStep}
        customerInfo={customerInfo}
        setCustomerInfo={setCustomerInfo}
        existingCustomerID={existingCustomerID}
        setExistingCustomerID={setExistingCustomerID}
        searchingCustomer={searchingCustomer}
        submitting={submitting}
        statusMessage={statusMessage}
        onSearch={handleSearchCustomer}
        onSkip={handleSkipCustomerInfo}
        onSubmit={handleSubmitOrder}
      />

      {/* Insufficient Inventory Dialog */}
      <Dialog open={showInventoryDialog} onOpenChange={setShowInventoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Insufficient Inventory</DialogTitle>
            <DialogDescription>The following items don't have enough inventory at this location:</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4 max-h-96 overflow-y-auto">
            {insufficientItems.map((item, index) => (
              <div key={index} className="bg-muted p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-foreground font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">System ID: {item.system_id}</p>
                    {item.placement && <p className="text-sm text-muted-foreground">Placement: {placementDisplayNames[item.placement] || item.placement}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-red-500">Available: {item.available}</p>
                    <p className="text-foreground">Requested: {item.requested}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="destructive" onClick={() => { handleRemoveBuild(item.buildIndex); setShowInventoryDialog(false); setInsufficientItems([]); }} className="flex-1">Remove Item</Button>
                  <Button size="sm" onClick={() => { handleEditBuild(item.buildIndex); setShowInventoryDialog(false); setInsufficientItems([]); }} className="flex-1 bg-blue-600 hover:bg-blue-700">Replace</Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={() => { setShowInventoryDialog(false); setInsufficientItems([]); }} className="flex-1">Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddPrintDialog
        open={showAddPrintDialog}
        onOpenChange={(open) => {
          setShowAddPrintDialog(open);
          if (!open) { setSelectedBuildForPrint(null); setPrintSearchQuery(''); setSearchedPrints([]); setSelectedPrint(null); setSelectedPlacement(''); }
        }}
        printSearchQuery={printSearchQuery}
        searchedPrints={searchedPrints}
        selectedPrint={selectedPrint}
        selectedPlacement={selectedPlacement}
        setSelectedPlacement={setSelectedPlacement}
        onSearch={handlePrintSearch}
        onSelectPrint={handleSelectPrint}
        onClearPrint={() => { setSelectedPrint(null); setSelectedPlacement(''); }}
        onAdd={handleAddPrintToScannedItem}
      />

      {/* Barcode Input Dialog */}
      <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan Barcode</DialogTitle>
            <DialogDescription>Scan item with bluetooth scanner or enter System ID manually</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && barcodeInput.trim()) {
                  handleBarcodeScan(barcodeInput.trim().substring(0, 12));
                  setBarcodeInput('');
                  setShowBarcodeDialog(false);
                }
              }}
              placeholder="Scan or enter barcode..."
              autoFocus
            />
            <div className="flex gap-3">
              <Button onClick={() => { setBarcodeInput(''); setShowBarcodeDialog(false); }} variant="outline" className="flex-1">Cancel</Button>
              <Button
                onClick={() => { if (barcodeInput.trim()) { handleBarcodeScan(barcodeInput.trim().substring(0, 12)); setBarcodeInput(''); setShowBarcodeDialog(false); } }}
                disabled={!barcodeInput.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Add Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <WaxProtectionDialog
        open={showWaxProtectionDialog}
        onOpenChange={(open) => {
          setShowWaxProtectionDialog(open);
          if (!open) { setWaxDialogStep(1); setCustomWaxPrice(''); setSelectedBuildForWax(null); }
        }}
        waxDialogStep={waxDialogStep}
        setWaxDialogStep={setWaxDialogStep}
        customWaxPrice={customWaxPrice}
        setCustomWaxPrice={setCustomWaxPrice}
        selectedBuildForWax={selectedBuildForWax}
        orderBuilds={orderBuilds}
        getRecommendedWaxPrice={getRecommendedWaxPrice}
        handleApplyCustomWaxPrice={handleApplyCustomWaxPrice}
        handleRemoveWaxProtection={handleRemoveWaxProtection}
      />
    </div>
  );
}