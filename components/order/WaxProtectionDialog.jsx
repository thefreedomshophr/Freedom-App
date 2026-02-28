import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function WaxProtectionDialog({
  open,
  onOpenChange,
  waxDialogStep,
  setWaxDialogStep,
  customWaxPrice,
  setCustomWaxPrice,
  selectedBuildForWax,
  orderBuilds,
  getRecommendedWaxPrice,
  handleApplyCustomWaxPrice,
  handleRemoveWaxProtection,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {waxDialogStep === 1 && 'Wax Protection'}
            {waxDialogStep === 2 && 'Have You Had Wax Protection Before?'}
            {waxDialogStep === 3 && 'Custom Wax Price'}
          </DialogTitle>
          <DialogDescription>
            {waxDialogStep === 1 && (selectedBuildForWax !== null && orderBuilds[selectedBuildForWax]?.wax_protection
              ? `Wax protection is currently applied to this item.`
              : `Would you like to add wax protection for $${getRecommendedWaxPrice(selectedBuildForWax)}?`)}
            {waxDialogStep === 2 && 'This helps us provide the best pricing for you.'}
            {waxDialogStep === 3 && `Enter the final wax protection price. Original price: $${getRecommendedWaxPrice(selectedBuildForWax)}`}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Initial offer */}
        {waxDialogStep === 1 && selectedBuildForWax !== null && !orderBuilds[selectedBuildForWax]?.wax_protection && (
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="waxPrice">Wax Protection Price</Label>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-foreground text-lg">$</span>
                <Input
                  id="waxPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={customWaxPrice}
                  onChange={(e) => setCustomWaxPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customWaxPrice.trim()) handleApplyCustomWaxPrice();
                  }}
                  placeholder={getRecommendedWaxPrice(selectedBuildForWax).toFixed(2)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setWaxDialogStep(2)} variant="secondary" className="flex-1">No</Button>
              <Button onClick={handleApplyCustomWaxPrice} disabled={!customWaxPrice.trim()} className="flex-1 bg-green-600 hover:bg-green-700">
                Add Wax Protection
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Manage existing */}
        {waxDialogStep === 1 && selectedBuildForWax !== null && orderBuilds[selectedBuildForWax]?.wax_protection && (
          <div className="flex gap-3 mt-4">
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={handleRemoveWaxProtection} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
              Remove Wax Protection
            </Button>
          </div>
        )}

        {/* Step 2 */}
        {waxDialogStep === 2 && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Button onClick={() => { onOpenChange(false); setWaxDialogStep(1); }} className="bg-green-600 hover:bg-green-700 text-white">
              Yes<br/>$10
            </Button>
            <Button onClick={() => setWaxDialogStep(3)} variant="secondary">No</Button>
          </div>
        )}

        {/* Step 3 */}
        {waxDialogStep === 3 && (
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="customWaxPrice">Enter Final Price</Label>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-foreground text-lg">$</span>
                <Input
                  id="customWaxPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={customWaxPrice}
                  onChange={(e) => setCustomWaxPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customWaxPrice.trim()) handleApplyCustomWaxPrice();
                  }}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This will apply ${getRecommendedWaxPrice(selectedBuildForWax)} wax protection with a discount to reach your entered price
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setWaxDialogStep(2)} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleApplyCustomWaxPrice} disabled={!customWaxPrice.trim()} className="flex-1 bg-green-600 hover:bg-green-700">
                Apply
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}