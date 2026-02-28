import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Pencil, Sparkles, Plus, Minus } from "lucide-react";
import SvgImage from "../SvgImage";
import SvgImageWithPrint from "../SvgImageWithPrint";

function getPrintsForView(prints, viewName) {
  return prints.filter(p => {
    const placement = p.placement.toLowerCase();
    const hasLegPlacement = prints.some(print => {
      const pl = print.placement.toLowerCase();
      return pl === 'right_leg' || pl === 'left_leg' || pl === 'right leg' || pl === 'left leg' || pl === 'standard';
    });
    if (hasLegPlacement) {
      if (viewName === 'front' || viewName === 'right') return placement === 'standard' || placement === 'front';
      if (viewName === 'back') return placement === 'back';
      if (viewName === 'left') return placement === 'left_leg' || placement === 'left leg';
    } else {
      if (viewName === 'front') return placement.includes('front') || placement.includes('chest') || placement.includes('crest');
      if (viewName === 'back') return placement.includes('back');
      if (viewName === 'right') return placement.includes('right') && placement.includes('sleeve');
      if (viewName === 'left') return placement.includes('left') && placement.includes('sleeve');
    }
    return false;
  });
}

function GarmentView({ label, imageUrl, prints, maxWidth, maxHeight }) {
  if (!imageUrl) return null;
  return (
    <div className="bg-gray-50 border border-gray-300 rounded-sm overflow-hidden">
      <div className="h-14 flex items-center justify-center p-1">
        {prints.length > 0 ? (
          <SvgImageWithPrint
            garmentSrc={imageUrl}
            prints={prints}
            maxPrintWidth={maxWidth}
            maxPrintHeight={maxHeight}
            className="w-full h-full"
            fallback={<div className="text-2xl">👕</div>}
          />
        ) : (
          <SvgImage src={imageUrl} alt={label} className="w-full h-full" fallback={<div className="text-2xl">👕</div>} />
        )}
      </div>
      <div className="px-1 py-0.5 text-center bg-gray-100 border-t border-gray-300">
        <p className="text-[10px] text-gray-700">{label}</p>
      </div>
    </div>
  );
}

export default function OrderBuildCard({
  build,
  buildIndex,
  placementDisplayNames,
  vinylItems,
  orderBuilds,
  setOrderBuilds,
  onEdit,
  onRemove,
  onManageWax,
  onAddPrint,
}) {
  const handleQuantityChange = (delta) => {
    const newQty = (build.quantity || 1) + delta;
    if (newQty <= 0) {
      onRemove(buildIndex);
      return;
    }
    const updatedBuilds = [...orderBuilds];
    updatedBuilds[buildIndex] = { ...updatedBuilds[buildIndex], quantity: newQty };
    setOrderBuilds(updatedBuilds);
    localStorage.setItem('orderBuilds', JSON.stringify(updatedBuilds));
  };
  const style = build.garment?.style?.toLowerCase() || '';
  const isSweatpants = style.includes('sweatpants');
  const isToddler = style.includes('toddler');
  const isYouthNoHoodie = style.includes('youth') && !style.includes('hoodie');

  return (
    <Card className="border-2 border-gray-600 shadow-none bg-white mb-6 rounded-sm">
      <CardContent className="p-6">
        {/* Header row */}
        {build.isScannedItem ? (
          <div className="flex justify-between items-center mb-4 pb-4 border-b-2 border-gray-300">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">{build.description || 'Scanned Item'}</h2>
              <p className="text-gray-600">System SKU: {build.systemSku}</p>
              <p className="text-gray-600">Item ID: {build.itemID}</p>
              {build.price > 0 && <p className="text-gray-600">Price: ${build.price.toFixed(2)}</p>}
              {build.itemType === 'assembly' && <p className="text-blue-600 text-sm mt-1">Assembly Item</p>}
              {build.wax_protection && (
                <p className="text-yellow-600 text-sm mt-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Wax Protection Added (${build.wax_protection.finalPrice ? build.wax_protection.finalPrice.toFixed(2) : build.wax_protection.price.toFixed(2)})
                </p>
              )}
              {build.prints?.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600">Prints:</p>
                  {build.prints.map((print, idx) => (
                    <p key={idx} className="text-sm text-gray-700">• {print.name} - {placementDisplayNames[print.placement] || print.placement}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {build.itemType === 'merchandise' && (
                <div className="flex items-center gap-1 border border-gray-400 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleQuantityChange(-1)}>
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium text-gray-800 dark:text-gray-100">{build.quantity || 1}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleQuantityChange(1)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {build.itemType === 'assembly' && (
                <>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(buildIndex)} className="text-blue-400 hover:text-blue-300">
                    <Pencil className="w-5 h-5" />
                  </Button>
                  <Button onClick={() => onAddPrint(buildIndex)} className="gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white">
                    <Plus className="w-5 h-5" /> Add Print
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" onClick={() => onRemove(buildIndex)} className="text-red-400 hover:text-red-300">
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center mb-4 pb-4 border-b-2 border-gray-300">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">{build.size} {build.color} {build.garment?.style}</h2>
              <p className="text-gray-600">{build.garment?.name}</p>
              {build.wax_protection && (
                <p className="text-yellow-600 text-sm mt-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Wax Protection Added
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => onManageWax(buildIndex)}
                className={`gap-2 ${build.wax_protection ? 'text-yellow-400 border-yellow-400 hover:bg-yellow-400 hover:text-white' : 'text-gray-300 border-gray-500 hover:bg-gray-700 hover:text-gray-100'}`}
              >
                <Sparkles className="w-4 h-4" />
                {build.wax_protection ? 'Manage Wax' : 'Add Wax'}
              </Button>
              <Select onValueChange={(value) => {
                const vinyl = vinylItems.find(v => v.id === value);
                if (vinyl) {
                  const updatedBuilds = [...orderBuilds];
                  if (!updatedBuilds[buildIndex].vinyl_items) updatedBuilds[buildIndex].vinyl_items = [];
                  updatedBuilds[buildIndex].vinyl_items.push(vinyl);
                  setOrderBuilds(updatedBuilds);
                  localStorage.setItem('orderBuilds', JSON.stringify(updatedBuilds));
                }
              }}>
                <SelectTrigger className="w-32 bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Add Vinyl" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {vinylItems.map((vinyl) => (
                    <SelectItem key={vinyl.id} value={vinyl.id} className="text-gray-900">{vinyl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => onEdit(buildIndex)} className="text-blue-400 hover:text-blue-300">
                <Pencil className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onRemove(buildIndex)} className="text-red-400 hover:text-red-300">
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Body */}
        {!build.isScannedItem ? (
          <div className="flex gap-6">
            {/* Garment previews */}
            <div className="flex-shrink-0 space-y-2" style={{ width: '70px' }}>
              <GarmentView label="Front" imageUrl={build.garment?.front_image_url} prints={getPrintsForView(build.prints, 'front')} maxWidth={build.garment?.front_max_print_width} maxHeight={build.garment?.front_max_print_height} />
              {!isSweatpants && <GarmentView label="Back" imageUrl={build.garment?.back_image_url} prints={getPrintsForView(build.prints, 'back')} maxWidth={build.garment?.back_max_print_width} maxHeight={build.garment?.back_max_print_height} />}
              {!isToddler && !isYouthNoHoodie && <GarmentView label="Right Sleeve" imageUrl={build.garment?.rsleeve_image_url} prints={getPrintsForView(build.prints, 'right')} maxWidth={build.garment?.rsleeve_max_print_width} maxHeight={build.garment?.rsleeve_max_print_height} />}
              {!isToddler && !isYouthNoHoodie && !isSweatpants && <GarmentView label="Left Sleeve" imageUrl={build.garment?.lsleeve_image_url} prints={getPrintsForView(build.prints, 'left')} maxWidth={build.garment?.lsleeve_max_print_width} maxHeight={build.garment?.lsleeve_max_print_height} />}
            </div>
            {/* Line items */}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-300">Line Items</h3>
              <div className="space-y-0">
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-900">{build.size} {build.color} {build.garment?.style}</span>
                  <span className="text-gray-900 font-medium">${build.garment?.cost?.toFixed(2) || '0.00'}</span>
                </div>
                {build.prints?.map((print, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 ml-4 text-sm">
                    <span className="text-gray-700">{print.name} ({placementDisplayNames[print.placement] || print.placement})</span>
                    <span className="text-gray-900 font-medium">${print.cost?.toFixed(2) || '0.00'}</span>
                  </div>
                ))}
                {build.wax_protection && (
                  <>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 ml-4 text-sm">
                      <span className="text-gray-700">Wax Protection</span>
                      <span className="text-gray-900 font-medium">${build.wax_protection.price.toFixed(2)}</span>
                    </div>
                    {build.wax_protection.discountAmount > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-gray-200 ml-4 text-sm">
                        <span className="text-gray-700">Wax Discount</span>
                        <span className="text-green-600 font-medium">-${build.wax_protection.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                {build.vinyl_items?.map((vinyl, vIdx) => (
                  <div key={vIdx} className="flex justify-between items-center py-2 border-b border-gray-200 ml-4 text-sm">
                    <span className="text-gray-700">{vinyl.name}</span>
                    <span className="text-gray-900 font-medium">${vinyl.price?.toFixed(2) || '0.00'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-900">
                {build.description || 'Scanned Item'}
                {(build.quantity || 1) > 1 && <span className="text-gray-500 text-sm ml-2">× {build.quantity}</span>}
              </span>
              <span className="text-gray-900 font-medium">${((build.price || 0) * (build.quantity || 1)).toFixed(2)}</span>
            </div>
            {build.prints?.map((print, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 ml-4 text-sm">
                <span className="text-gray-700">{print.name} ({placementDisplayNames[print.placement] || print.placement})</span>
                <span className="text-gray-900 font-medium">${print.cost?.toFixed(2) || '0.00'}</span>
              </div>
            ))}
            {build.wax_protection && (
              <>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 ml-4 text-sm">
                  <span className="text-gray-700">Wax Protection</span>
                  <span className="text-gray-900 font-medium">${build.wax_protection.price.toFixed(2)}</span>
                </div>
                {build.wax_protection.discountAmount > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 ml-4 text-sm">
                    <span className="text-gray-700">Wax Discount</span>
                    <span className="text-green-600 font-medium">-${build.wax_protection.discountAmount.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}