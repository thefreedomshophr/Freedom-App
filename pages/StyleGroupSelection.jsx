import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function StyleGroupSelection() {
  const navigate = useNavigate();
  const [styleGroups, setStyleGroups] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showStartOverDialog, setShowStartOverDialog] = React.useState(false);

  React.useEffect(() => {
    loadStyleGroups();
  }, []);

  const loadStyleGroups = async () => {
    try {
      const groups = await base44.entities.StyleGroup.list();
      // Sort by sort_order
      const sorted = groups.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setStyleGroups(sorted);
    } catch (error) {
      console.error('Error loading style groups:', error);
    }
    setLoading(false);
  };

  const handleGroupSelect = (group) => {
    navigate(createPageUrl(`StyleSelection?flow=style&styleGroup=${encodeURIComponent(group.name)}`));
  };

  const handleBack = () => {
    navigate(createPageUrl("Home"));
  };

  const handleStartOver = () => {
    localStorage.removeItem('selectedPrints');
    localStorage.removeItem('orderBuilds');
    localStorage.removeItem('editingBuildIndex');
    localStorage.removeItem('pendingBuild');
    setShowStartOverDialog(false);
    navigate(createPageUrl("Home"));
  };

  const confirmStartOver = () => {
    handleStartOver();
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowStartOverDialog(true)}
          >
            Start Over
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-light tracking-wider text-foreground mb-4">
            Select Style Category
          </h1>
          <p className="text-xl text-muted-foreground font-light">
            Choose a category to explore styles
          </p>
        </motion.div>

        {styleGroups.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p>No style groups available</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {styleGroups.map((group, index) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className="cursor-pointer group hover:shadow-2xl transition-all duration-300 overflow-hidden rounded-2xl"
                  onClick={() => handleGroupSelect(group)}
                >
                  <CardContent className="p-0">
                    {group.image_url && (
                      <div className="h-48 overflow-hidden relative bg-white">
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 z-10" />
                        <img
                          src={group.image_url}
                          alt={group.name}
                          className="w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="text-2xl font-light text-foreground text-center">
                        {group.name}
                      </h3>
                      <p className="text-muted-foreground text-center mt-2 text-sm">
                        {group.styles?.length || 0} style{group.styles?.length !== 1 ? 's' : ''}
                      </p>
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