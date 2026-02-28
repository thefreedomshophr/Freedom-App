import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
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
import { filterGarmentsByLocation } from "../components/GarmentFilter";
import { filterGarmentsByPrintCompatibility } from "../components/PrintCompatibility";

export default function ColorSelection() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const flow = urlParams.get('flow');
  const style = urlParams.get('style');

  const [colors, setColors] = useState([]);
  const [colorGroups, setColorGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showGroups, setShowGroups] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showStartOverDialog, setShowStartOverDialog] = useState(false);

  useEffect(() => {
    loadColors();
  }, [style]);

  const loadColors = async () => {
    try {
      let allGarments = await base44.entities.Garment.list();
      
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
      
      if (style) {
        const decodedStyle = decodeURIComponent(style);
        allGarments = allGarments.filter(g => g.style?.toLowerCase() === decodedStyle.toLowerCase());
      }
      
      // Filter by size if in 'style' flow
      const size = urlParams.get('size');
      if (flow === 'style' && size) {
        allGarments = allGarments.filter(g => g.size === size);
      }

      const allColors = await base44.entities.Color.list();
      const availableColorNames = [...new Set(allGarments.map(g => g.color))];
      const colorObjects = allColors.filter(c => availableColorNames.includes(c.name));
      
      setColors(colorObjects);

      // Load color groups
      const groups = await base44.entities.ColorGroup.list('sort_order');
      // Only show groups that have at least one available color
      const availableGroups = groups.filter(group => 
        group.colors?.some(colorName => availableColorNames.includes(colorName))
      );
      setColorGroups(availableGroups);
      // Only use color groups if there are more than 8 colors
      setShowGroups(availableGroups.length > 0 && colorObjects.length > 8);
    } catch (error) {
      console.error('Error loading colors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleColorSelect = (colorName) => {
    const params = new URLSearchParams(window.location.search);
    params.set('color', colorName);
    
    if (flow === 'color') {
      navigate(createPageUrl(`StyleSelection?${params.toString()}`));
    } else if (flow === 'style') {
      // In style flow, we now go to print catalog after color
      navigate(createPageUrl(`PrintCatalog?${params.toString()}`));
    } else if (flow === 'print' && style) {
      // If we already have a style (from "Choose by Style"), go to size
      navigate(createPageUrl(`SizeSelection?${params.toString()}`));
    } else if (flow === 'print') {
      // If we don't have a style yet (from "Choose by Color"), go to style
      navigate(createPageUrl(`StyleSelection?${params.toString()}`));
    }
  };

  const handleBack = () => {
    if (selectedGroup && !showGroups) {
      // Go back to color groups
      setSelectedGroup(null);
      setShowGroups(true);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const garmentType = params.get('garment_type');
    const size = params.get('size');
    
    if (flow === 'style' && size) {
      // Go back to size selection
      navigate(createPageUrl(`SizeSelection?${params.toString()}`));
    } else if (flow === 'style' && style) {
      navigate(createPageUrl(`StyleSelection?flow=style`));
    } else if (flow === 'print') {
      const navParams = new URLSearchParams();
      navParams.set('flow', 'print');
      if (garmentType) navParams.set('garment_type', garmentType);
      navigate(createPageUrl(`GarmentChoiceSelection?${navParams.toString()}`));
    } else {
      navigate(createPageUrl("Home"));
    }
  };

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
    setShowGroups(false);
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
        <div className="text-2xl text-muted-foreground">Loading colors...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-light text-foreground mb-2">
                Choose Your Color
              </h1>
              <p className="text-muted-foreground font-light">
                {style ? `Available colors for ${decodeURIComponent(style)}` : 'Select from our color palette'}
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
        </div>

        {showGroups && colorGroups.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {colorGroups.map((group, index) => (
              <div key={group.id}>
                <Card
                  className="cursor-pointer group hover:shadow-lg transition-shadow duration-200 overflow-hidden rounded-2xl"
                  onClick={() => handleGroupSelect(group)}
                >
                  <CardContent className="p-0">
                    <div className="aspect-square relative overflow-hidden">
                      {group.image_url ? (
                        <img 
                          src={group.image_url} 
                          alt={group.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-600 flex items-center justify-center">
                          <span className="text-2xl text-gray-400">{group.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 text-center">
                      <h3 className="text-lg font-light text-foreground">
                        {group.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {group.colors?.filter(c => colors.find(col => col.name === c)).length} colors
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        ) : !showGroups && selectedGroup ? (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-light text-foreground">{selectedGroup.name} Colors</h2>
            </div>
            {colors.filter(c => selectedGroup.colors?.includes(c.name)).length === 0 ? (
              <div className="text-center py-20">
                <p className="text-xl text-muted-foreground">No colors available in this group.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6">
                {selectedGroup.colors
                  ?.map(colorName => colors.find(c => c.name === colorName))
                  .filter(Boolean)
                  .map((color) => (
                  <div key={color.id}>
                    <Card
                      className="cursor-pointer hover:shadow-lg transition-shadow duration-200 overflow-hidden rounded-2xl"
                      onClick={() => handleColorSelect(color.name)}
                    >
                      <CardContent className="p-0">
                        <div className="aspect-square relative overflow-hidden">
                          {color.image_url ? (
                            <img 
                              src={color.image_url} 
                              alt={color.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <span className="text-xs text-muted-foreground">No image</span>
                            </div>
                          )}
                        </div>
                        <div className="p-4 text-center">
                          <h3 className="text-sm font-light text-foreground capitalize truncate">
                            {color.name}
                          </h3>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          colors.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-xl text-muted-foreground">No colors available{style ? ` for ${decodeURIComponent(style)}` : ''}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6">
              {colors.map((color) => (
                <div key={color.id}>
                  <Card
                    className="cursor-pointer hover:shadow-lg transition-shadow duration-200 overflow-hidden rounded-2xl"
                    onClick={() => handleColorSelect(color.name)}
                  >
                    <CardContent className="p-0">
                      <div className="aspect-square relative overflow-hidden">
                        {color.image_url ? (
                          <img 
                            src={color.image_url} 
                            alt={color.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">No image</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4 text-center">
                        <h3 className="text-sm font-light text-foreground capitalize truncate">
                          {color.name}
                        </h3>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )
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