import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";

export default function LocationSelection() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkLockedLocation();
  }, []);

  const checkLockedLocation = async () => {
    try {
      // Check if user is locked to a location
      const isAuth = await base44.auth.isAuthenticated();
      console.log('=== LocationSelection Debug ===');
      console.log('isAuth:', isAuth);
      if (isAuth) {
        const user = await base44.auth.me();
        console.log('FULL USER OBJECT:', JSON.stringify(user, null, 2));
        console.log('user.role:', user.role);
        console.log('user.locked_location:', user.locked_location);
        
        if (user.locked_location) {
          // User is locked - find and auto-select their location
          const allLocations = await base44.entities.Location.list();
          console.log('LocationSelection - allLocations:', allLocations);
          const lockedLoc = allLocations.find(loc => loc.id === user.locked_location);
          console.log('LocationSelection - lockedLoc found:', lockedLoc);
          if (lockedLoc) {
            localStorage.setItem('selectedLocation', JSON.stringify(lockedLoc));
            navigate(createPageUrl("EmployeeCode"));
            return;
          }
        }
        
        // If user is not admin, they shouldn't see location selection at all
        if (user.role !== 'admin') {
          // Non-admin without locked location - use first available location
          const allLocations = await base44.entities.Location.list();
          if (allLocations.length > 0) {
            localStorage.setItem('selectedLocation', JSON.stringify(allLocations[0]));
            navigate(createPageUrl("EmployeeCode"));
            return;
          }
        }
      }
    } catch (error) {
      console.error('Error checking locked location:', error);
    }
    
    // Only admins without locked location should see location selection
    loadLocations();
  };

  const loadLocations = async () => {
    try {
      const data = await base44.entities.Location.list();
      setLocations(data);
    } catch (error) {
      console.error('Error loading locations:', error);
    }
    setLoading(false);
  };

  const handleLocationSelect = (location) => {
    localStorage.setItem('selectedLocation', JSON.stringify(location));
    navigate(createPageUrl("EmployeeCode"));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <MapPin className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-4xl md:text-5xl font-light text-foreground mb-4">
            Select Your Location
          </h1>
          <p className="text-xl text-muted-foreground font-light">
            Choose a store location to continue
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {locations.map((location, index) => (
            <motion.div
              key={location.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="cursor-pointer group hover:shadow-2xl transition-all duration-300 overflow-hidden rounded-2xl"
                onClick={() => handleLocationSelect(location)}
              >
                <CardContent className="p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-blue-600 dark:bg-blue-900 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <MapPin className="w-8 h-8 text-white dark:text-blue-300" />
                    </div>
                    <h3 className="text-2xl font-light text-foreground">
                      {location.name}
                    </h3>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {locations.length === 0 && (
          <div className="text-center">
            <p className="text-muted-foreground mb-4">No locations available. Please contact an administrator.</p>
          </div>
        )}
      </div>
    </div>
  );
}