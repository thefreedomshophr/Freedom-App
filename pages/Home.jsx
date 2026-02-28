import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Palette, Shirt, Image, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import toast, { Toaster } from 'react-hot-toast';

export default function Home() {
  const navigate = useNavigate();
  const [orderCount, setOrderCount] = React.useState(0);
  const [customIcons, setCustomIcons] = React.useState({});
  const [checkingUser, setCheckingUser] = React.useState(true);

  React.useEffect(() => {
    // Check for toast FIRST before any redirects
    const wasAdded = localStorage.getItem('itemAddedToCart');
    console.log('Checking for itemAddedToCart:', wasAdded);
    if (wasAdded === 'true') {
      console.log('Showing toast notification');
      toast.success('Added to cart', {
        duration: 3000,
        position: 'top-center',
        style: {
          background: '#10b981',
          color: '#fff',
          fontWeight: '600',
          fontSize: '20px',
          padding: '20px 32px',
          borderRadius: '8px',
        },
      });
      localStorage.removeItem('itemAddedToCart');
    }
    
    checkUserAndRedirect();
  }, []);

  const checkUserAndRedirect = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const user = await base44.auth.me();
        
        // If user has locked_location, auto-set it
        if (user.locked_location) {
          const locations = await base44.entities.Location.list();
          const lockedLoc = locations.find(loc => loc.id === user.locked_location);
          if (lockedLoc) {
            localStorage.setItem('selectedLocation', JSON.stringify(lockedLoc));
          }
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
    }
    
    // Now check location and employee code
    const selectedLocation = localStorage.getItem('selectedLocation');
    if (!selectedLocation) {
      // Check if user has locked location before redirecting
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const user = await base44.auth.me();
          if (user.locked_location) {
            // User is locked, redirect to employee code instead
            navigate(createPageUrl("EmployeeCode"));
            return;
          }
          // Only admins can see location selection
          if (user.role !== 'admin') {
            // Non-admin without location - use first available
            const locations = await base44.entities.Location.list();
            if (locations.length > 0) {
              localStorage.setItem('selectedLocation', JSON.stringify(locations[0]));
            }
            navigate(createPageUrl("EmployeeCode"));
            return;
          }
        }
      } catch (e) {}
      navigate(createPageUrl("LocationSelection"));
      return;
    }

    // Check for employee code
    const employeeCode = localStorage.getItem('employeeCode');
    if (!employeeCode) {
      navigate(createPageUrl("EmployeeCode"));
      return;
    }

    const storedOrder = localStorage.getItem('orderBuilds');
    if (storedOrder) {
      try {
        const builds = JSON.parse(storedOrder);
        setOrderCount(builds.length);
      } catch (error) {
        setOrderCount(0);
      }
    }
    
    // Load custom icons
    loadCustomIcons();
    setCheckingUser(false);
  };

  // Empty dependency - run once on mount

  const loadCustomIcons = async () => {
    try {
      const icons = await base44.entities.CustomIcon.list();
      const iconMap = {};
      icons.forEach(icon => {
        iconMap[icon.identifier] = icon.icon_url;
      });
      setCustomIcons(iconMap);
    } catch (error) {
      console.error('Error loading custom icons:', error);
    }
  };

  const options = [
    {
      title: "Garment Color",
      description: "Start by choosing your favorite color",
      icon: Palette,
      gradient: "from-red-500 to-red-600",
      iconColor: "text-white",
      path: "ColorSelection?flow=color"
    },
    {
      title: "Garment Style",
      description: "Browse our collection of styles",
      icon: Shirt,
      gradient: "from-gray-100 to-gray-200",
      iconColor: "text-gray-800",
      path: "StyleGroupSelection"
    },
    {
      title: "Print Design",
      description: "Explore our print catalog",
      icon: Image,
      gradient: "from-blue-500 to-blue-600",
      iconColor: "text-white",
      path: "GarmentTypeSelection"
    }
  ];

  if (checkingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  return (
    <>
      <Toaster />
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
        <div className="max-w-6xl w-full">
        {orderCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-end mb-6"
          >
            <Button
              onClick={() => navigate(createPageUrl("OrderSummary"))}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white relative"
            >
              <ShoppingCart className="w-5 h-5" />
              Go To Cart
              <Badge variant="secondary" className="ml-2 bg-white text-green-700">
                {orderCount}
              </Badge>
            </Button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-light tracking-wider text-foreground mb-4">
            Design Your Freedom
          </h1>
          <p className="text-xl text-muted-foreground font-light">
            Choose your starting point
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {options.map((option, index) => (
            <motion.div
              key={option.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="cursor-pointer group hover:shadow-2xl transition-all duration-300 overflow-hidden rounded-2xl"
                onClick={() => navigate(createPageUrl(option.path))}
              >
                <CardContent className="p-0">
                  <div className={`h-48 bg-gradient-to-br ${option.gradient} flex items-center justify-center relative overflow-hidden rounded-t-2xl`}>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                    {customIcons[`home_${option.title.toLowerCase().split(' ')[1]}`] ? (
                      <img 
                        src={customIcons[`home_${option.title.toLowerCase().split(' ')[1]}`]} 
                        alt={option.title}
                        className="w-20 h-20 object-contain transform group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <option.icon className={`w-20 h-20 ${option.iconColor} transform group-hover:scale-110 transition-transform duration-300`} />
                    )}
                  </div>
                  <div className="p-8">
                    <h3 className="text-2xl font-light text-foreground mb-2">
                      {option.title}
                    </h3>
                    <p className="text-muted-foreground font-light">
                      {option.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
      </div>
    </>
  );
}