import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import SvgImage from "../components/SvgImage";
import { filterGarmentsByLocation } from "../components/GarmentFilter";
import { filterGarmentsByPrintCompatibility } from "../components/PrintCompatibility";

export default function StyleSelection() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const flow = urlParams.get('flow');
  const color = urlParams.get('color');

  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStartOverDialog, setShowStartOverDialog] = useState(false);

  useEffect(() => {
    loadStyles();
  }, [color]);

  const loadStyles = async () => {
    try {
      let allGarments = await base44.entities.Garment.list();
      
      // Check if we have a style group filter
      const styleGroupParam = urlParams.get('styleGroup');
      let allowedStyles = null;
      
      if (styleGroupParam) {
        try {
          const groups = await base44.entities.StyleGroup.list();
          const selectedGroup = groups.find(g => g.name === styleGroupParam);
          if (selectedGroup && selectedGroup.styles) {
            allowedStyles = selectedGroup.styles;
          }
        } catch (error) {
          console.error('Error loading style group:', error);
        }
      }
      
      // Filter by location availability
      allGarments = filterGarmentsByLocation(allGarments);
      
      // Filter by print compatibility (for print flow)
      if (flow === 'print') {
        allGarments = filterGarmentsByPrintCompatibility(allGarments);
      }
      
      // Filter by garment type if in print flow
      const garmentType = urlParams.get('garment_type');
      if (garmentType === 'tops') {
        allGarments = allGarments.filter(g => !g.style?.toLowerCase().includes('sweatpants'));
      } else if (garmentType === 'bottoms') {
        allGarments = allGarments.filter(g => g.style?.toLowerCase().includes('sweatpants'));
      }
      
      if (color) {
        const decodedColor = decodeURIComponent(color);
        allGarments = allGarments.filter(g => g.color?.toLowerCase() === decodedColor.toLowerCase());
      }
      
      // Filter by style group if specified
      if (allowedStyles) {
        allGarments = allGarments.filter(g => allowedStyles.includes(g.style));
      }

      const styleMap = {};
      allGarments.forEach(garment => {
        if (garment.style) {
          // Prefer garments with front_image_url, or take the first one if none exists yet
          if (!styleMap[garment.style] || (!styleMap[garment.style].front_image_url && garment.front_image_url)) {
            styleMap[garment.style] = garment;
          }
        }
      });

      const uniqueStyleGarments = Object.values(styleMap);
      
      // Load custom icons for style thumbnails
      const icons = await base44.entities.CustomIcon.list();
      const iconMap = {};
      icons.forEach(icon => {
        if (icon.identifier.startsWith('style_thumbnail_')) {
          const styleName = icon.identifier.replace('style_thumbnail_', '');
          iconMap[styleName] = icon.icon_url;
        }
      });
      
      // Add thumbnail URLs to garments
      uniqueStyleGarments.forEach(garment => {
        if (iconMap[garment.style]) {
          garment.thumbnail_url = iconMap[garment.style];
        }
      });
      
      // Custom sort order for styles
      const styleOrder = [
        'Hoodie', 'T-Shirt', 'Ladies Crop Hoodie', 'Tall T-Shirt', 'Sweatpants',
        'Youth Hoodie', 'Youth T-Shirt', 'Youth Sweatpants',
        'Toddler Hoodie', 'Toddler T-Shirt'
      ];
      
      uniqueStyleGarments.sort((a, b) => {
        const indexA = styleOrder.indexOf(a.style);
        const indexB = styleOrder.indexOf(b.style);
        if (indexA === -1 && indexB === -1) return a.style.localeCompare(b.style);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
      
      setStyles(uniqueStyleGarments);
    } catch (error) {
      console.error('Error loading styles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStyleSelect = (style) => {
    const params = new URLSearchParams(window.location.search);
    params.set('style', style);
    
    if (flow === 'style') {
      navigate(createPageUrl(`SizeSelection?${params.toString()}`));
    } else if (flow === 'color' && color) {
      navigate(createPageUrl(`SizeSelection?${params.toString()}`));
    } else if (flow === 'print' && !color) {
      // In print flow, go to size selection next (then color)
      navigate(createPageUrl(`SizeSelection?${params.toString()}`));
    } else if (flow === 'print' && color) {
      navigate(createPageUrl(`SizeSelection?${params.toString()}`));
    }
  };

  const handleBack = () => {
    const params = new URLSearchParams(window.location.search);
    const garmentType = params.get('garment_type');
    const styleGroup = params.get('styleGroup');
    
    if (flow === 'color' && color) {
      navigate(createPageUrl(`ColorSelection?flow=color`));
    } else if (flow === 'print' && color) {
      const navParams = new URLSearchParams();
      navParams.set('flow', 'print');
      navParams.set('color', color);
      if (garmentType) navParams.set('garment_type', garmentType);
      navigate(createPageUrl(`ColorSelection?${navParams.toString()}`));
    } else if (flow === 'style' && styleGroup) {
      navigate(createPageUrl("StyleGroupSelection"));
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
        <div className="text-2xl text-muted-foreground">Loading styles...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-light text-foreground mb-2">
                Choose Your Style
              </h1>
              <p className="text-muted-foreground font-light">
                {color ? `Available styles in ${decodeURIComponent(color)}` : 'Browse our collection'}
              </p>
            </div>
            
            <div className="flex gap-3">
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

        {styles.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-muted-foreground">No styles available{color ? ` in ${decodeURIComponent(color)}` : ''}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {styles.map((styleGarment, index) => (
              <motion.div
                key={styleGarment.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className="cursor-pointer group hover:shadow-2xl transition-all duration-300 overflow-hidden rounded-3xl"
                  onClick={() => handleStyleSelect(styleGarment.style)}
                >
                  <CardContent className="p-0">
                    <div className="aspect-square flex items-center justify-center p-8 relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                      <div className="w-full h-full flex items-center justify-center">
                        {styleGarment.thumbnail_url ? (
                          <img
                            src={styleGarment.thumbnail_url}
                            alt={styleGarment.style}
                            className="w-full h-full object-contain rounded-2xl transform group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <SvgImage
                            src={styleGarment.front_image_url}
                            alt={styleGarment.style}
                            className="w-full h-full transform group-hover:scale-105 transition-transform duration-300"
                            fallback={<div className="text-6xl text-gray-400">👕</div>}
                          />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
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
    </div>
  );
}