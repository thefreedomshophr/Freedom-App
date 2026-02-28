import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Shirt, AlertCircle } from "lucide-react";

export default function EmployeeCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [customIcon, setCustomIcon] = useState(null);
  const [user, setUser] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);

  useEffect(() => {
    loadUserData();
    loadCustomIcon();
  }, []);

  const loadUserData = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // If user has a locked_location, auto-set it
        if (currentUser.locked_location) {
          const locations = await base44.entities.Location.list();
          const lockedLoc = locations.find(loc => loc.id === currentUser.locked_location);
          if (lockedLoc) {
            localStorage.setItem('selectedLocation', JSON.stringify(lockedLoc));
          }
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
    setUserLoaded(true);
  };

  const loadCustomIcon = async () => {
    try {
      const icons = await base44.entities.CustomIcon.list();
      const logoIcon = icons.find(icon => icon.identifier === 'employee_code_logo');
      if (logoIcon) {
        setCustomIcon(logoIcon.icon_url);
      }
    } catch (error) {
      console.error('Error loading custom icon:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check for location selection first
    const selectedLocation = localStorage.getItem('selectedLocation');
    if (!selectedLocation) {
      navigate(createPageUrl("LocationSelection"));
      return;
    }
    
    if (!code.trim()) {
      setError('Please enter an employee code');
      return;
    }

    setLoading(true); // Changed from setValidating to setLoading
    setError('');

    try {
      // Check if the code exists and is active
      const codes = await base44.entities.EmployeeCode.filter({ 
        code: code.trim(),
        is_active: true 
      });

      if (codes.length === 0) {
        setError("Invalid employee code. Please try again."); // Updated error message
        setLoading(false); // Changed from setValidating to setLoading
        return;
      }

      // Valid code - save and continue
      localStorage.setItem('employeeCode', code.trim());
      navigate(createPageUrl("Home"));
    } catch (error) {
      console.error('Error validating employee code:', error);
      setError("Error validating code. Please try again.");
    } finally {
      setLoading(false); // Ensure loading is reset in all cases
    }
  };

  // Show loading until user is loaded
  if (!userLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-400 rounded-lg flex items-center justify-center mx-auto mb-4">
            {customIcon ? (
              <img 
                src={customIcon} 
                alt="Logo"
                className="w-10 h-10 object-contain"
              />
            ) : (
              <Shirt className="w-8 h-8 text-gray-900" />
            )}
          </div>
          <h1 className="text-4xl font-light tracking-wider text-foreground mb-2">
            FREEDOM APPAREL
          </h1>
          <p className="text-muted-foreground">Enter your employee code to continue</p>
        </div>

        <Card className="shadow-2xl">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/[^0-9]/g, ''));
                    setError("");
                  }}
                  placeholder="Employee Code"
                  className="text-lg h-14 text-center"
                  autoFocus
                  disabled={loading}
                />
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 mt-3 text-red-400 text-sm"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}
              </div>
              <Button
                type="submit"
                disabled={!code.trim() || loading} // Changed from validating to loading
                className="w-full h-14 text-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Validating...' : 'Continue'} {/* Changed text for loading state */}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}