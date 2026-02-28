import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Edit, Check, Loader2, Trash2 } from "lucide-react";


const WAX_PROTECTION_OPTIONS = [
  { name: "Wax Protection - Free", system_id: '210000001578', itemID: '1578', price: 0.00 },
  { name: "Wax Protection - $3", system_id: '210000001577', itemID: '1577', price: 3.00 },
  { name: "Wax Protection - $5", system_id: '210000001576', itemID: '1576', price: 5.00 },
  { name: "Wax Protection - $7", system_id: '210000001575', itemID: '1575', price: 7.00 },
  { name: "Wax Protection - $10", system_id: '210000009650', itemID: '9644', price: 10.00 },
  { name: "Wax Protection - $15", system_id: '210000010665', itemID: '10659', price: 15.00 },
];

export default function ActiveOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [deletingOrderId, setDeletingOrderId] = useState(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);

  useEffect(() => {
    loadOrders();
    loadLogo();
    
    // Poll for completed sales every 10 seconds
    const pollInterval = setInterval(() => {
      checkCompletedSales();
    }, 10000);
    
    return () => clearInterval(pollInterval);
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

  const loadOrders = async () => {
    try {
      const employeeCode = localStorage.getItem('employeeCode');
      if (!employeeCode) {
        navigate(createPageUrl("EmployeeCode"));
        return;
      }

      const activeOrders = await base44.entities.ActiveOrder.filter({ 
        employee_code: employeeCode 
      }, '-created_date');
      setOrders(activeOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleTouchStart = (e) => {
    if (window.scrollY === 0) {
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (touchStart === 0 || window.scrollY > 0) return;
    
    const touchCurrent = e.touches[0].clientY;
    const distance = touchCurrent - touchStart;
    
    if (distance > 0) {
      setPullDistance(Math.min(distance, 100));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60) {
      await handleRefresh();
    }
    setTouchStart(0);
    setPullDistance(0);
  };

  const checkCompletedSales = async () => {
    const selectedLocationData = localStorage.getItem('selectedLocation');
    if (!selectedLocationData) return;
    
    const selectedLocation = JSON.parse(selectedLocationData);
    if (!selectedLocation.shopID) return;
    
    const employeeCode = localStorage.getItem('employeeCode');
    if (!employeeCode) return;
    
    try {
      // Fetch fresh orders from database
      const activeOrders = await base44.entities.ActiveOrder.filter({ 
        employee_code: employeeCode 
      }, '-created_date');
      
      if (activeOrders.length === 0) return;
      
      // Check each order's sale status
      for (const order of activeOrders) {
        console.log(`Checking sale status for ${order.sale_id}...`);
        const response = await base44.functions.invoke('lightspeedCheckSaleStatus', {
          saleID: order.sale_id,
          shopID: selectedLocation.shopID,
          locationId: order.location_id
        });
        
        console.log(`Sale ${order.sale_id} check result:`, response.data);
        
        if (response.data.success && response.data.isCompleted) {
          console.log(`Sale ${order.sale_id} is completed, processing...`);
          // Automatically process this order (print and remove)
          await handleOrderPaid(order);
        }
      }
    } catch (error) {
      console.error('Error checking sale status:', error);
    }
  };

  const handleChangeOrder = async (order) => {
    try {
      const orderData = JSON.parse(order.order_data);
      
      // Save to localStorage for editing
      localStorage.setItem('orderBuilds', JSON.stringify(orderData));
      localStorage.setItem('editingActiveOrderId', order.id);
      
      // Navigate to OrderSummary
      navigate(createPageUrl("OrderSummary"));
    } catch (error) {
      console.error('Error opening order:', error);
      alert('Failed to load order for editing');
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!confirm(`Are you sure you want to delete Sale ID ${order.sale_id}? This will cancel the sale in Lightspeed.`)) {
      return;
    }

    setDeletingOrderId(order.id);
    
    try {
      const selectedLocationData = localStorage.getItem('selectedLocation');
      if (!selectedLocationData) {
        alert('No location selected');
        return;
      }

      const selectedLocation = JSON.parse(selectedLocationData);
      
      // Delete the sale from Lightspeed
      const response = await base44.functions.invoke('lightspeedDeleteSale', {
        saleID: order.sale_id,
        shopID: selectedLocation.shopID,
        locationId: selectedLocation.id
      });

      if (response.data.success) {
        // Remove from ActiveOrders database
        await base44.entities.ActiveOrder.delete(order.id);
        console.log('Order deleted:', order.id);
        await loadOrders();
      } else {
        throw new Error(response.data.error || 'Failed to delete sale');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Failed to delete order: ' + error.message);
    } finally {
      setDeletingOrderId(null);
    }
  };

  const handleOrderPaid = async (order) => {
    setProcessingOrderId(order.id);
    
    try {
      const orderBuilds = JSON.parse(order.order_data);
      
      // Generate and print receipt
      let starReceipt = '';
      if (logoUrl) {
        starReceipt += `[align: center][image: url ${logoUrl}; width 300;]\n\n`;
      }
      starReceipt += '[align: center][mag: width 2; height 2;][bold]Sale ID:[/bold]\n';
      starReceipt += `[barcode: type code128; data ${order.sale_id}; module 3; height 90;]\n`;
      starReceipt += `${order.sale_id}[/mag]\n\n`;
      starReceipt += `[align: left][mag: width 2; height 2;][bold]Employee code: ${order.employee_code || 'N/A'}[/bold][/mag]\n`;
      
      if (order.customer_name) {
        starReceipt += `[bold]Customer: ${order.customer_name}[/bold]\n`;
      }
      starReceipt += '\n';
      
      // Add items
      orderBuilds.forEach((build, index) => {
        starReceipt += '[mag: width 2; height 2;]================================[/mag]\n';
        starReceipt += `[mag: width 2; height 2;][bold]Item ${index + 1}:[/bold][/mag]\n`;
        
        if (build.isScannedItem) {
          starReceipt += `[mag: width 2; height 2;]Item: ${build.description || build.systemSku}[/mag]\n`;
        } else {
          const capitalizedColor = build.color.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          const capitalizedSize = build.size.toUpperCase();
          starReceipt += `[mag: width 2; height 2;]Garment: ${build.garment?.style || 'T-shirt'}, ${capitalizedColor}, ${capitalizedSize}[/mag]\n`;
        }
        
        if (build.prints && build.prints.length > 0) {
          build.prints.forEach((print) => {
            starReceipt += `[mag: width 2; height 2;]Print: ${print.name || print.system_id}[/mag]\n`;
            starReceipt += `[mag: width 2; height 2;]Placement: ${print.placement.replace(/_/g, ' ')}[/mag]\n`;
            if (print.notes && print.notes.trim()) {
              starReceipt += `[mag: width 2; height 2;]${print.notes}[/mag]\n`;
            }
          });
        }
        
        if (build.wax_protection) {
          starReceipt += `[mag: width 2; height 2;]Wax: Yes[/mag]\n`;
        }
        
        starReceipt += '[mag: width 2; height 2;]================================[/mag]\n';
        
        if (index < orderBuilds.length - 1) {
          starReceipt += '\n';
        }
      });
      
      starReceipt += '\n[cut]';
      
      // Print receipt - this must succeed before deleting
      console.log('Printing receipt for sale:', order.sale_id);
      const printResult = await base44.functions.invoke('starIOPrint', { 
        receipt_data: starReceipt,
        location_id: order.location_id 
      });
      console.log('Print result:', printResult);
      
      // Only delete if print was successful
      if (printResult.data?.success !== false) {
        await base44.entities.ActiveOrder.delete(order.id);
        console.log('Order deleted:', order.id);
        await loadOrders();
      } else {
        throw new Error('Print failed');
      }
    } catch (error) {
      console.error('Error processing order payment:', error);
      alert('Failed to process order. Please try again.');
    } finally {
      setProcessingOrderId(null);
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
    <div 
      className="min-h-[calc(100vh-4rem)] p-6 md:p-12"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="fixed top-16 left-0 right-0 flex justify-center z-50 transition-transform"
          style={{ transform: `translateY(${Math.min(pullDistance - 20, 50)}px)` }}
        >
          <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            {refreshing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Refreshing...</span>
              </>
            ) : pullDistance > 60 ? (
              <span className="text-sm">Release to refresh</span>
            ) : (
              <span className="text-sm">Pull to refresh</span>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-light text-foreground mb-2">
            Active Orders
          </h1>
          <p className="text-muted-foreground font-light">
            {orders.length} order{orders.length !== 1 ? 's' : ''} pending payment
          </p>
        </motion.div>

        {orders.length === 0 ? (
          <Card className="shadow-lg p-12 text-center">
            <h2 className="text-2xl font-light mb-4">No Active Orders</h2>
            <p className="text-muted-foreground mb-6">All orders have been completed</p>
            <Button onClick={() => navigate(createPageUrl("Home"))}>
              Create New Order
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6">
            {orders.map((order) => {
              const orderBuilds = JSON.parse(order.order_data);
              const isProcessing = processingOrderId === order.id;
              const isDeleting = deletingOrderId === order.id;
              
              return (
                <Card key={order.id} className="shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h2 className="text-2xl font-light text-foreground">
                            Sale ID: {order.sale_id}
                          </h2>
                        </div>
                        <div className="space-y-1">
                          {order.customer_name && (
                            <p className="text-foreground">Customer: {order.customer_name}</p>
                          )}
                          <p className="text-muted-foreground text-sm">
                            {orderBuilds.length} item{orderBuilds.length !== 1 ? 's' : ''}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            Created: {new Date(order.created_date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleChangeOrder(order)}
                          disabled={isProcessing || isDeleting}
                          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Edit className="w-4 h-4" />
                          Change Order
                        </Button>
                        <Button
                          onClick={() => handleDeleteOrder(order)}
                          disabled={isProcessing || isDeleting}
                          variant="outline"
                          className="gap-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              Delete Order
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => handleOrderPaid(order)}
                          disabled={isProcessing || isDeleting}
                          className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              Order Paid
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Order Items Summary */}
                    <div className="border-t border-border pt-4 space-y-3">
                      {orderBuilds.map((build, index) => (
                        <div key={index} className="bg-muted p-4 rounded-lg">
                          <p className="text-foreground font-medium mb-1">
                            {build.isScannedItem 
                              ? (build.description || build.systemSku)
                              : `${build.size} ${build.color} ${build.garment?.style}`
                            }
                          </p>
                          {build.prints && build.prints.length > 0 && (
                            <p className="text-muted-foreground text-sm">
                              {build.prints.length} print{build.prints.length !== 1 ? 's' : ''}: {build.prints.map(p => p.name).join(', ')}
                            </p>
                          )}
                          {build.wax_protection && (
                            <p className="text-yellow-600 dark:text-yellow-400 text-sm">
                              + Wax Protection (${build.wax_protection.price.toFixed(2)})
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}