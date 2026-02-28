import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Shirt, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function GarmentTypeSelection() {
  const navigate = useNavigate();
  const [customIcons, setCustomIcons] = useState({});
  const [showStartOverDialog, setShowStartOverDialog] = useState(false);

  useEffect(() => {
    loadCustomIcons();
  }, []);

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
      title: "Tops",
      description: "T-Shirts, Hoodies, Long Sleeves",
      iconUrl: customIcons['garment_type_tops'] || "https://cdn-icons-png.flaticon.com/512/992/992651.png",
      gradient: "from-blue-500 to-blue-600",
      type: "tops"
    },
    {
      title: "Bottoms",
      description: "Sweatpants, Joggers",
      iconUrl: customIcons['garment_type_bottoms'] || "https://cdn-icons-png.flaticon.com/512/3050/3050405.png",
      gradient: "from-green-500 to-green-600",
      type: "bottoms"
    }
  ];

  const handleSelection = (type) => {
    const urlParams = new URLSearchParams(window.location.search);
    const flow = urlParams.get('flow');
    
    // If coming from color/style flows, preserve the URL params
    if (flow === 'color' || flow === 'style') {
      urlParams.set('garment_type', type);
      navigate(createPageUrl(`PrintCatalog?${urlParams.toString()}`));
    } else {
      // For print flow starting from home
      localStorage.removeItem('selectedPrints');
      navigate(createPageUrl(`PrintCatalog?flow=print&garment_type=${type}`));
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

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12 flex items-center justify-center">
      <div className="max-w-4xl w-full">
        <div className="flex justify-end mb-8">
          <Button
            variant="outline"
            onClick={handleStartOver}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Start Over
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-light text-foreground mb-4">
            What type of garment?
          </h1>
          <p className="text-xl text-muted-foreground font-light">
            Choose tops or bottoms to see available prints
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {options.map((option, index) => (
            <motion.div
              key={option.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="cursor-pointer group hover:shadow-2xl transition-all duration-300 overflow-hidden h-full rounded-2xl"
                onClick={() => handleSelection(option.type)}
              >
                <CardContent className="p-0">
                  <div className={`h-64 bg-gradient-to-br ${option.gradient} flex items-center justify-center relative overflow-hidden rounded-t-2xl`}>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                    <img 
                      src={option.iconUrl} 
                      alt={option.title}
                      className="w-32 h-32 object-contain transform group-hover:scale-110 transition-transform duration-300 rounded-xl"
                    />
                  </div>
                  <div className="p-8">
                    <h3 className="text-3xl font-light text-foreground mb-2 text-center">
                      {option.title}
                    </h3>
                    <p className="text-muted-foreground font-light text-center">
                      {option.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

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
      </div>
    </div>
  );
}