import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Print } from "@/entities/Print";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SkipForward, RotateCcw } from "lucide-react"; // Updated Lucide imports
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function PrintCategorySelection() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const flow = urlParams.get('flow');
  const color = urlParams.get('color');
  const style = urlParams.get('style');
  const size = urlParams.get('size');
  const garmentType = urlParams.get('garment_type');

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStartOverDialog, setShowStartOverDialog] = useState(false); // New state for dialog

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const prints = await Print.list();
    
    // Filter prints based on garment type
    let filteredPrints = prints;
    
    if (garmentType === 'tops') {
      // Show only Crest, Sleeve, Adult, Jr, Kid, Baby
      filteredPrints = prints.filter(p => 
        ['Crest', 'Sleeve', 'Adult', 'Jr', 'Kid', 'Baby'].includes(p.print_size)
      );
    } else if (garmentType === 'bottoms') {
      // Show only Crest, Sleeve, Adult Leg, Jr Leg, Kid Leg
      filteredPrints = prints.filter(p => 
        ['Crest', 'Sleeve', 'Adult Leg', 'Jr Leg', 'Kid Leg'].includes(p.print_size)
      );
    }
    
    const allTags = filteredPrints.flatMap(p => p.tags || []);
    const uniqueCategoriesArray = [...new Set(allTags)];
    
    let finalCategories = uniqueCategoriesArray;
    
    // Sort categories based on garment style (for tops only)
    if (garmentType === 'tops' && style) {
      console.log('Current style:', style);
      console.log('Available categories:', uniqueCategoriesArray);
      
      const adultStyles = ['hoodie', 't-shirt', 'tall t-shirt', 'ladies crop hoodie'];
      const youthStyles = ['youth hoodie', 'youth t-shirt', 'toddler hoodie', 'toddler t-shirt'];
      
      let categoryOrder = [];
      if (adultStyles.includes(style.toLowerCase())) {
        console.log('Using adult order');
        categoryOrder = ['Adult', 'Sleeve', 'Crest', 'Patch', 'White', 'Single Color', 'Beach Patrol', 'North Face', 'Turtle', 'I Heart', 'One Liners', 'Things', 'Bigfoot', 'Jr', 'Kid', 'Baby'];
      } else if (youthStyles.includes(style.toLowerCase())) {
        console.log('Using youth order');
        categoryOrder = ['Jr', 'Kid', 'Baby', 'Crest', 'Patch', 'Adult', 'Single Color', 'White', 'Sleeve', 'Beach Patrol', 'North Face', 'Turtle', 'I Heart', 'One Liners', 'Things', 'Bigfoot'];
      }
      
      if (categoryOrder.length > 0) {
        // Build ordered list based on categoryOrder
        const ordered = [];
        const categoriesSet = new Set(uniqueCategoriesArray);
        
        // Add categories in the specified order if they exist
        categoryOrder.forEach(cat => {
          if (categoriesSet.has(cat)) {
            ordered.push(cat);
            categoriesSet.delete(cat);
          }
        });
        
        // Add any remaining categories alphabetically at the end
        const remaining = [...categoriesSet].sort();
        finalCategories = [...ordered, ...remaining];
        
        console.log('Final ordered categories:', finalCategories);
      }
    }
    
    setCategories(finalCategories);
    setLoading(false);
  };

  const handleCategorySelect = (category) => {
    const params = new URLSearchParams(window.location.search);
    params.set('category', category);
    navigate(createPageUrl(`PrintCatalog?${params.toString()}`));
  };

  const handleViewAll = () => {
    navigate(createPageUrl(`PrintCatalog?${window.location.search}`));
  };

  // Replaced handleBack with Start Over functionality
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

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Removed the Back button */}

        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-12 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-4xl md:text-5xl font-light text-gray-100 mb-2">
              Browse Print Designs
            </h1>
            <p className="text-gray-400 font-light">
              Choose a category or view all designs
            </p>
          </motion.div>
          
          <div className="flex flex-col md:flex-row gap-3">
            <Button // New Start Over button
              variant="outline"
              onClick={handleStartOver}
              className="gap-2 text-gray-900 border-gray-700 hover:bg-gray-800 hover:text-gray-100 bg-white"
            >
              <RotateCcw className="w-4 h-4" />
              Start Over
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                navigate(createPageUrl(`Preview?${params.toString()}`));
              }}
              className="gap-2 text-gray-900 border-gray-700 hover:bg-gray-800 hover:text-gray-100 bg-white"
            >
              <SkipForward className="w-4 h-4" />
              Skip to Preview
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-4 gap-6">
            {categories.map((category, index) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className="cursor-pointer group hover:shadow-xl transition-all duration-300 border-0 overflow-hidden h-full bg-gray-800"
                  onClick={() => handleCategorySelect(category)}
                >
                  <CardContent className="p-0">
                    <div className="h-32 bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                    </div>
                    <div className="p-4">
                      <h3 className="text-lg font-light text-gray-100 capitalize">
                        {category}
                      </h3>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Start Over Confirmation Dialog */}
      <Dialog open={showStartOverDialog} onOpenChange={setShowStartOverDialog}>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-100">Start Over?</DialogTitle>
            <DialogDescription className="text-gray-300">
              This will clear all your selections and take you back to the home page.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={() => setShowStartOverDialog(false)}
              variant="outline"
              className="flex-1 border-gray-700 text-gray-900 hover:bg-gray-700 hover:text-gray-100 bg-white"
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
    </div>
  );
}