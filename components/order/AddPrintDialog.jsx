import React from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AddPrintDialog({
  open,
  onOpenChange,
  printSearchQuery,
  searchedPrints,
  selectedPrint,
  selectedPlacement,
  setSelectedPlacement,
  onSearch,
  onSelectPrint,
  onClearPrint,
  onAdd,
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-2xl sm:top-[5%] sm:translate-y-0">
        <div className="space-y-4">
          <div>
            <Label htmlFor="printSearch" className="text-lg font-medium">Search Prints</Label>
            <Input
              id="printSearch"
              value={printSearchQuery}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Type print name..."
              autoFocus
              className="mt-2"
            />
          </div>

          {searchedPrints.length > 0 && !selectedPrint && (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {searchedPrints.map((print) => (
                <Card key={print.id} className="cursor-pointer hover:bg-muted" onClick={() => onSelectPrint(print)}>
                  <CardContent className="p-3 flex items-center gap-3">
                    {print.image_url && (
                      <img src={print.image_url} alt={print.name} className="w-12 h-12 object-contain bg-white rounded" />
                    )}
                    <div>
                      <p className="text-foreground font-medium">{print.name}</p>
                      <p className="text-sm text-muted-foreground">${print.cost?.toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {selectedPrint && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  {selectedPrint.image_url && (
                    <img src={selectedPrint.image_url} alt={selectedPrint.name} className="w-16 h-16 object-contain bg-white rounded" />
                  )}
                  <div>
                    <p className="text-foreground font-medium">{selectedPrint.name}</p>
                    <p className="text-sm text-muted-foreground">${selectedPrint.cost?.toFixed(2)}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={onClearPrint} className="ml-auto">Change</Button>
                </CardContent>
              </Card>

              <div>
                <Label>Select Placement</Label>
                <Select value={selectedPlacement} onValueChange={setSelectedPlacement}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {selectedPrint.garment_type === 'bottoms' && selectedPrint.bottom_placements?.length > 0 ? (
                      selectedPrint.bottom_placements.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)
                    ) : selectedPrint.front_placements?.length > 0 ? (
                      selectedPrint.front_placements.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)
                    ) : (
                      <SelectItem value="Front">Front</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={onAdd} disabled={!selectedPrint || !selectedPlacement} className="flex-1 bg-blue-600 hover:bg-blue-700">
              Add Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}