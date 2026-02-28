import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Palette, Shirt, ArrowLeft, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function GarmentChoiceSelection() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const garmentType = urlParams.get('garment_type');
  const [showStartOverDialog, setShowStartOverDialog] = useState(false);

  const options = [
    {
      title: "Choose by Color",
      description: "Select your favorite color first",
      icon: Palette,
      gradient: "from-pink-500 to-rose-500",
      path: `ColorSelection?flow=print${garmentType ? `&garment_type=${garmentType}` : ''}`
    },
    {
      title: "Choose by Style",
      description: "Browse garment styles first",
      icon: Shirt,
      gradient: "from-blue-500 to-cyan-500",
      path: `StyleSelection?flow=print${garmentType ? `&garment_type=${garmentType}` : ''}`
    }
  ];

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
            How would you like to choose your garment?
          </h1>
          <p className="text-xl text-muted-foreground font-light">
            Select your preferred way to browse
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
                className="cursor-pointer group hover:shadow-2xl transition-all duration-300 border-0 overflow-hidden bg-gray-800 h-full"
                onClick={() => navigate(createPageUrl(option.path))}
              >
                <CardContent className="p-0">
                  <div className={`h-64 bg-gradient-to-br ${option.gradient} flex items-center justify-center relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                    <option.icon className="w-24 h-24 text-white transform group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <div className="p-8">
                    <h3 className="text-2xl font-light text-gray-100 mb-2">
                      {option.title}
                    </h3>
                    <p className="text-gray-400 font-light">
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