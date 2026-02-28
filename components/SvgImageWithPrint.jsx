import React, { useState, useEffect } from "react";

// Simple cache to avoid re-fetching the same SVG
const svgCache = {};

export default function SvgImageWithPrint({ garmentSrc, prints, maxPrintWidth, maxPrintHeight, rMaxPrintWidth, rMaxPrintHeight, lMaxPrintWidth, lMaxPrintHeight, className, fallback, styleConfig }) {
  const [svgContent, setSvgContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Create a cache key based on garment and prints - v13 fixed chest placement priority
    const cacheKey = `v17-${garmentSrc}-${JSON.stringify(prints?.map(p => ({ id: p.id, placement: p.placement, print_size: p.print_size })))}-${maxPrintWidth}-${maxPrintHeight}-${rMaxPrintWidth}-${rMaxPrintHeight}-${lMaxPrintWidth}-${lMaxPrintHeight}`;
    
    console.log('[SvgImageWithPrint] useEffect triggered with:', {
      garmentSrc,
      printsLength: prints?.length,
      maxPrintWidth,
      maxPrintHeight,
      rMaxPrintWidth,
      rMaxPrintHeight,
      lMaxPrintWidth,
      lMaxPrintHeight
    });
    
    if (!garmentSrc) {
      setLoading(false);
      return;
    }

    // Check cache first
    if (svgCache[cacheKey]) {
      console.log('[SvgImageWithPrint] Using cached SVG');
      setSvgContent(svgCache[cacheKey]);
      setLoading(false);
      return;
    }

    const loadAndModifySvg = async () => {
      try {
        // Fetch the garment SVG
        const response = await fetch(garmentSrc);
        if (!response.ok) {
          console.warn(`Failed to load SVG from ${garmentSrc}: ${response.status}`);
          setSvgContent(null);
          setLoading(false);
          return;
        }
        const text = await response.text();
        
        // Parse the SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(text, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        
        if (!svgElement) {
          const modifiedText = text.replace(
            /<rect([^>]*id="print-area"[^>]*)>/g,
            '<rect$1 opacity="0" visibility="hidden" fill="none">'
          );
          svgCache[cacheKey] = modifiedText;
          setSvgContent(modifiedText);
          setLoading(false);
          return;
        }

        // Remove all transforms from the root SVG and its immediate children
        svgElement.removeAttribute('transform');
        
        // Remove transforms from immediate children groups (except print-area)
        const groups = svgElement.querySelectorAll(':scope > g');
        groups.forEach(g => {
          if (g.id !== 'print-area') {
            g.removeAttribute('transform');
          }
        });

        // Normalize SVG sizing first
        let viewBox = svgElement.getAttribute('viewBox');
        if (!viewBox) {
          const width = svgElement.getAttribute('width') || '100';
          const height = svgElement.getAttribute('height') || '100';
          viewBox = `0 0 ${width} ${height}`;
        }
        
        // Force SVG to fill container with proper scaling
        svgElement.setAttribute('viewBox', viewBox);
        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');
        svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        
        // Add inline border-radius style to the SVG element itself
        svgElement.setAttribute('style', `border-radius: 0.75rem; ${svgElement.getAttribute('style') || ''}`);

        // Find ALL elements with id="print-area", "rprint-area", "lprint-area"
        // Use more specific selector to handle multiple print-area elements
        const allElements = svgElement.querySelectorAll('*');
        let printAreaRect = null;
        let rprintAreaRect = null;
        let lprintAreaRect = null;

        // First pass: find all print areas
        allElements.forEach(element => {
          const id = element.getAttribute('id');
          if (!id) return;

          const tagName = element.tagName.toLowerCase();
          const isValidShape = tagName === 'rect' || tagName === 'rectangle' || tagName === 'image' || tagName === 'g';

          if (id === 'lprint-area') {
            lprintAreaRect = element;
            console.log(`[SvgImageWithPrint] Found lprint-area:`, {
              tag: tagName,
              x: element.getAttribute('x'),
              y: element.getAttribute('y'),
              width: element.getAttribute('width'),
              height: element.getAttribute('height')
            });
            // Hide the print area
            element.setAttribute('opacity', '0');
            element.setAttribute('visibility', 'hidden');
            element.setAttribute('fill', 'none');
          } else if (id === 'rprint-area') {
            rprintAreaRect = element;
            console.log(`[SvgImageWithPrint] Found rprint-area:`, {
              tag: tagName,
              x: element.getAttribute('x'),
              y: element.getAttribute('y'),
              width: element.getAttribute('width'),
              height: element.getAttribute('height')
            });
            // Hide the print area
            element.setAttribute('opacity', '0');
            element.setAttribute('visibility', 'hidden');
            element.setAttribute('fill', 'none');
          } else if (id === 'print-area' && !printAreaRect) {
            printAreaRect = element;
            console.log(`[SvgImageWithPrint] Found print-area:`, {
              tag: tagName,
              x: element.getAttribute('x'),
              y: element.getAttribute('y'),
              width: element.getAttribute('width'),
              height: element.getAttribute('height')
            });
            // Hide the print area
            element.setAttribute('opacity', '0');
            element.setAttribute('visibility', 'hidden');
            element.setAttribute('fill', 'none');
          }
        });
        
        // Fallback: try with querySelector for backwards compatibility
        if (!printAreaRect) {
          printAreaRect = svgElement.querySelector('#print-area');
          if (printAreaRect) {
            console.log(`[SvgImageWithPrint] Found print-area via querySelector: ${printAreaRect.tagName}`);
            printAreaRect.setAttribute('opacity', '0');
            printAreaRect.setAttribute('visibility', 'hidden');
            printAreaRect.setAttribute('fill', 'none');
          }
        }
        if (!rprintAreaRect) {
          rprintAreaRect = svgElement.querySelector('#rprint-area');
          if (rprintAreaRect) {
            console.log(`[SvgImageWithPrint] Found rprint-area via querySelector`);
            rprintAreaRect.setAttribute('opacity', '0');
            rprintAreaRect.setAttribute('visibility', 'hidden');
            rprintAreaRect.setAttribute('fill', 'none');
          }
        }
        if (!lprintAreaRect) {
          lprintAreaRect = svgElement.querySelector('#lprint-area');
          if (lprintAreaRect) {
            console.log(`[SvgImageWithPrint] Found lprint-area via querySelector`);
            lprintAreaRect.setAttribute('opacity', '0');
            lprintAreaRect.setAttribute('visibility', 'hidden');
            lprintAreaRect.setAttribute('fill', 'none');
          }
        }

        // If we have prints, add them
        console.log(`[SvgImageWithPrint] Checking if we should add prints:`, {
          hasPrints: !!prints,
          printsLength: prints?.length || 0,
          maxPrintWidth,
          maxPrintHeight,
          shouldAddPrints: !!(prints && prints.length > 0 && maxPrintWidth && maxPrintHeight)
        });

        if (prints && prints.length > 0 && maxPrintWidth && maxPrintHeight) {
          console.log(`[SvgImageWithPrint] Processing ${prints.length} print(s) for ${garmentSrc}`);
          
          // If no print area found, try to use the SVG viewBox or bounds
          let rectX, rectY, rectWidth, rectHeight;
          
          // For sweatpants/bottoms, if there's no main print-area but we have rprint-area or lprint-area, use one of those as the base
          let basePrintArea = printAreaRect;
          if (!basePrintArea && (rprintAreaRect || lprintAreaRect)) {
            basePrintArea = rprintAreaRect || lprintAreaRect;
            console.log('[SvgImageWithPrint] No print-area, using rprint-area/lprint-area as base for sweatpants');
          }
          
          if (basePrintArea) {
            console.log('[SvgImageWithPrint] Found print-area rectangle');
            
            // Check if print-area is inside a transformed group
            let parentGroup = basePrintArea.parentElement;
            let accumulatedTransform = '';
            while (parentGroup && parentGroup !== svgElement) {
              const transform = parentGroup.getAttribute('transform');
              if (transform) {
                console.log(`[SvgImageWithPrint] Parent group has transform: ${transform}`);
                accumulatedTransform = transform + ' ' + accumulatedTransform;
              }
              parentGroup = parentGroup.parentElement;
            }
            
            // REMOVE ANY TRANSFORM FROM PRINT AREA AND PARENT GROUPS
            const originalTransform = basePrintArea.getAttribute('transform');
            if (originalTransform) {
              console.log(`[SvgImageWithPrint] Removing transform from print-area: ${originalTransform}`);
              basePrintArea.removeAttribute('transform');
            }
            
            // Remove transforms from parent groups
            parentGroup = basePrintArea.parentElement;
            while (parentGroup && parentGroup !== svgElement) {
              if (parentGroup.getAttribute('transform')) {
                console.log(`[SvgImageWithPrint] Removing transform from parent group`);
                parentGroup.removeAttribute('transform');
              }
              parentGroup = parentGroup.parentElement;
            }
            
            // Get dimensions directly from rect attributes
            rectX = parseFloat(basePrintArea.getAttribute('x') || 0);
            rectY = parseFloat(basePrintArea.getAttribute('y') || 0);
            rectWidth = parseFloat(basePrintArea.getAttribute('width') || 0);
            rectHeight = parseFloat(basePrintArea.getAttribute('height') || 0);
            
            console.log(`[SvgImageWithPrint] Print area dimensions: x=${rectX}, y=${rectY}, w=${rectWidth}, h=${rectHeight}`);
          } else {
            console.warn('[SvgImageWithPrint] No print-area found, using viewBox fallback');
            // No print area found - use SVG viewBox as fallback
            const currentViewBox = svgElement.getAttribute('viewBox');
            if (currentViewBox) {
              const [vx, vy, vw, vh] = currentViewBox.split(' ').map(parseFloat);
              rectX = vx;
              rectY = vy;
              rectWidth = vw;
              rectHeight = vh;
            } else {
              // Last resort: use width/height attributes
              rectX = 0;
              rectY = 0;
              rectWidth = parseFloat(svgElement.getAttribute('width') || 100);
              rectHeight = parseFloat(svgElement.getAttribute('height') || 100);
            }
          }
          
          // Detect if dimensions are flipped
          const rectIsWide = rectWidth > rectHeight;
          const expectedTall = maxPrintHeight > maxPrintWidth;
          
          if (rectIsWide && expectedTall) {
            const originalRectWidth = rectWidth;
            const originalRectHeight = rectHeight;

            [rectWidth, rectHeight] = [rectHeight, rectWidth];
            const oldCenterX = rectX + originalRectWidth / 2;
            const oldCenterY = rectY + originalRectHeight / 2;
            rectX = oldCenterX - rectWidth / 2;
            rectY = oldCenterY - rectHeight / 2;
          }
          
          if (rectWidth === 0 || rectHeight === 0) {
            console.warn(`[SvgImageWithPrint] Print area has zero dimensions for ${garmentSrc} (w=${rectWidth}, h=${rectHeight})`);
            const serializer = new XMLSerializer();
            const modifiedSvg = serializer.serializeToString(svgElement);
            svgCache[cacheKey] = modifiedSvg;
            setSvgContent(modifiedSvg);
            setLoading(false);
            return;
          }
          
          console.log(`[SvgImageWithPrint] Max print dimensions: ${maxPrintWidth}" × ${maxPrintHeight}"`);
          
          const centerX = rectX + rectWidth / 2;
          const centerY = rectY + rectHeight / 2;

          const pixelsPerInchX = rectWidth / maxPrintWidth;
          const pixelsPerInchY = rectHeight / maxPrintHeight;

          console.log(`[SvgImageWithPrint] DEBUG: About to process ${prints.length} prints`);
          console.log(`[SvgImageWithPrint] DEBUG: Print area rects found:`, {
            printAreaRect: !!printAreaRect,
            rprintAreaRect: !!rprintAreaRect,
            lprintAreaRect: !!lprintAreaRect
          });
          console.log(`[SvgImageWithPrint] DEBUG: Max dimensions passed:`, {
            maxPrintWidth,
            maxPrintHeight,
            rMaxPrintWidth,
            rMaxPrintHeight,
            lMaxPrintWidth,
            lMaxPrintHeight
          });

          // Add each print
          prints.forEach((print, index) => {
            console.log(`[SvgImageWithPrint] Processing print ${index + 1}/${prints.length}: ${print.name} (${print.width}" × ${print.height}") placement: ${print.placement}`);

            // Skip Custom placement - it doesn't render on the garment
            if (print.placement === 'Custom') {
              console.log(`[SvgImageWithPrint] Skipping Custom placement for ${print.name}`);
              return;
            }

            if (print.image_url && print.width && print.height) {
              // Determine which print area to use based on placement
               let targetArea = printAreaRect;
               let targetRectX = rectX;
               let targetRectY = rectY;
               let targetRectWidth = rectWidth;
               let targetRectHeight = rectHeight;
               let targetMaxWidth = maxPrintWidth;
               let targetMaxHeight = maxPrintHeight;

               // Check for Right Leg, Left Leg, or special chest placements
               const placementLower = (print.placement || '').toLowerCase();
               const isFrontRightChest = print.placement === 'Front Right Chest' || placementLower === 'front_right_chest' || placementLower === 'front right chest';
               const isFrontLeftChest = print.placement === 'Front Left Chest' || placementLower === 'front_left_chest' || placementLower === 'front left chest';

              console.log(`[SvgImageWithPrint] Print placement check:`, {
                placement: print.placement,
                placementLower,
                hasRprintArea: !!rprintAreaRect,
                hasLprintArea: !!lprintAreaRect
              });

              // Track if we're using a specific area for chest placements
              let usingChestArea = false;

              if ((placementLower === 'right leg' || placementLower === 'right_leg') && rprintAreaRect) {
                targetArea = rprintAreaRect;
                targetRectX = parseFloat(rprintAreaRect.getAttribute('x') || 0);
                targetRectY = parseFloat(rprintAreaRect.getAttribute('y') || 0);
                targetRectWidth = parseFloat(rprintAreaRect.getAttribute('width') || 0);
                targetRectHeight = parseFloat(rprintAreaRect.getAttribute('height') || 0);
                targetMaxWidth = rMaxPrintWidth || maxPrintWidth;
                targetMaxHeight = rMaxPrintHeight || maxPrintHeight;
                console.log(`[SvgImageWithPrint] Using rprint-area for Right Leg: x=${targetRectX}, y=${targetRectY}, w=${targetRectWidth}, h=${targetRectHeight}, maxW=${targetMaxWidth}, maxH=${targetMaxHeight}`);
              } else if ((placementLower === 'left leg' || placementLower === 'left_leg') && lprintAreaRect) {
                targetArea = lprintAreaRect;
                targetRectX = parseFloat(lprintAreaRect.getAttribute('x') || 0);
                targetRectY = parseFloat(lprintAreaRect.getAttribute('y') || 0);
                targetRectWidth = parseFloat(lprintAreaRect.getAttribute('width') || 0);
                targetRectHeight = parseFloat(lprintAreaRect.getAttribute('height') || 0);
                targetMaxWidth = lMaxPrintWidth || maxPrintWidth;
                targetMaxHeight = lMaxPrintHeight || maxPrintHeight;
                console.log(`[SvgImageWithPrint] Using lprint-area for Left Leg: x=${targetRectX}, y=${targetRectY}, w=${targetRectWidth}, h=${targetRectHeight}, maxW=${targetMaxWidth}, maxH=${targetMaxHeight}`);
              } else if ((isFrontRightChest || placementLower.includes('front right')) && rprintAreaRect && lprintAreaRect) {
                // Front Right Chest → rprint-area (ONLY for Zip/Quarter Zip with both areas)
                // Use Right Sleeve dimensions for this placement area
                targetArea = rprintAreaRect;
                targetRectX = parseFloat(rprintAreaRect.getAttribute('x') || 0);
                targetRectY = parseFloat(rprintAreaRect.getAttribute('y') || 0);
                targetRectWidth = parseFloat(rprintAreaRect.getAttribute('width') || 0);
                targetRectHeight = parseFloat(rprintAreaRect.getAttribute('height') || 0);
                targetMaxWidth = rMaxPrintWidth || maxPrintWidth;
                targetMaxHeight = rMaxPrintHeight || maxPrintHeight;
                usingChestArea = true;
                console.log(`[SvgImageWithPrint] Using rprint-area for Front Right Chest (Zip/Quarter Zip): x=${targetRectX}, y=${targetRectY}, w=${targetRectWidth}, h=${targetRectHeight}, maxW=${targetMaxWidth}, maxH=${targetMaxHeight}`);
              } else if ((isFrontLeftChest || placementLower.includes('front left')) && lprintAreaRect && rprintAreaRect) {
                // Front Left Chest → lprint-area (ONLY for Zip/Quarter Zip with both areas)
                // Use Left Sleeve dimensions for this placement area
                targetArea = lprintAreaRect;
                targetRectX = parseFloat(lprintAreaRect.getAttribute('x') || 0);
                targetRectY = parseFloat(lprintAreaRect.getAttribute('y') || 0);
                targetRectWidth = parseFloat(lprintAreaRect.getAttribute('width') || 0);
                targetRectHeight = parseFloat(lprintAreaRect.getAttribute('height') || 0);
                targetMaxWidth = lMaxPrintWidth || maxPrintWidth;
                targetMaxHeight = lMaxPrintHeight || maxPrintHeight;
                usingChestArea = true;
                console.log(`[SvgImageWithPrint] Using lprint-area for Front Left Chest (Zip/Quarter Zip): x=${targetRectX}, y=${targetRectY}, w=${targetRectWidth}, h=${targetRectHeight}, maxW=${targetMaxWidth}, maxH=${targetMaxHeight}`);
              }

              if (targetRectWidth === 0 || targetRectHeight === 0) {
                console.warn(`[SvgImageWithPrint] Target area has zero dimensions, skipping print ${print.name}`);
                return;
              }

              const targetPixelsPerInchX = targetRectWidth / targetMaxWidth;
              const targetPixelsPerInchY = targetRectHeight / targetMaxHeight;
              const printWidthPx = print.width * targetPixelsPerInchX;
              const printHeightPx = print.height * targetPixelsPerInchY;

              const isCrest = print.print_size === 'Crest';
              const isTopAligned = ['Adult', 'Jr', 'Kid', 'Baby', 'Adult Leg', 'Jr Leg', 'Kid Leg'].includes(print.print_size);
              const isSleevePlacement = print.placement?.toLowerCase().includes('sleeve');
              const isSleeve = print.print_size === 'Sleeve';
              const isBackShoulder = print.placement === 'Back Shoulder';
              const isLegPlacement = print.placement === 'Right Leg' || print.placement === 'Left Leg';
              const isFrontCenter = print.placement === 'Front Center';

              let xPosition, yPosition;

              // Determine which placement array to use based on print_size
              const printSizeToKey = {
                'Adult': 'adult_placements',
                'Jr': 'jr_placements',
                'Kid': 'kid_placements',
                'Baby': 'baby_placements',
                'Sleeve': 'sleeve_placements',
                'Crest': 'crest_placements',
                'Adult Leg': 'leg_placements',
                'Jr Leg': 'leg_placements',
                'Kid Leg': 'leg_placements',
                'Leg': 'leg_placements',
                'Oversize': 'oversize_placements',
                'Patch': 'patch_placements'
              };
              
              const printSizeKey = printSizeToKey[print.print_size];
              const hasStyleConfig = styleConfig && printSizeKey && styleConfig[printSizeKey];
              const placementConfig = hasStyleConfig 
                ? (styleConfig[printSizeKey] || []).find(p => p.name === print.placement)
                : null;

              if (placementConfig && typeof placementConfig.x === 'number' && typeof placementConfig.y === 'number') {
                // Use percentage-based positioning from style config
                const xPercent = placementConfig.x / 100;
                const yPercent = placementConfig.y / 100;
                
                // Calculate position within the target area
                xPosition = targetRectX + (targetRectWidth * xPercent) - (printWidthPx / 2);
                yPosition = targetRectY + (targetRectHeight * yPercent) - (printHeightPx / 2);
                
                console.log(`[SvgImageWithPrint] Using style config coordinates: ${placementConfig.x}%, ${placementConfig.y}% → x=${xPosition}, y=${yPosition}`);
              } else {
                // Fallback to legacy hardcoded positioning
                console.log(`[SvgImageWithPrint] Using legacy positioning for ${print.placement} (no style config)`);
                
                // Chest placements (Front Right Chest or Front Left Chest)
                // These should be centered horizontally and aligned to top of their area
                if (usingChestArea) {
                  // Centered horizontally, top edge aligned
                  xPosition = targetRectX + (targetRectWidth / 2) - (printWidthPx / 2);
                  yPosition = targetRectY;
                  console.log(`[SvgImageWithPrint] Chest placement (${print.placement}): x=${xPosition}, y=${yPosition}, rectY=${targetRectY}, rectX=${targetRectX}, rectWidth=${targetRectWidth}, printWidth=${printWidthPx}`);
                } else if (isLegPlacement) {
                  // Leg placements: centered horizontally, top-aligned vertically
                  xPosition = targetRectX + targetRectWidth / 2 - printWidthPx / 2;
                  yPosition = targetRectY;
                } else if (isBackShoulder) {
                  // Back Shoulder: top-right aligned (top edge + right edge)
                  xPosition = targetRectX + targetRectWidth - printWidthPx;
                  yPosition = targetRectY;
                } else if (isFrontCenter && isCrest) {
                  // Front Center for Crest prints (Onesie): centered horizontally, top-aligned vertically (like Adult prints)
                  xPosition = targetRectX + targetRectWidth / 2 - printWidthPx / 2;
                  yPosition = targetRectY;
                } else if ((isCrest || isSleeve) && (isFrontRightChest || isFrontLeftChest) && !isSleevePlacement) { 
                  // Regular garment Front Right/Left Chest (using main print-area)
                  if (isFrontRightChest) {
                    // Regular garment Front Right Chest: top-left corner
                    xPosition = targetRectX;
                    yPosition = targetRectY;
                  } else if (isFrontLeftChest) {
                    // Regular garment Front Left Chest: top-right corner
                    xPosition = targetRectX + targetRectWidth - printWidthPx;
                    yPosition = targetRectY;
                  }
                } else if (isTopAligned || (isCrest && isSleevePlacement)) {
                  xPosition = targetRectX + targetRectWidth / 2 - printWidthPx / 2;
                  yPosition = targetRectY;
                } else {
                  xPosition = targetRectX + targetRectWidth / 2 - printWidthPx / 2;
                  yPosition = targetRectY + targetRectHeight / 2 - printHeightPx / 2;
                }
              }
              
              const imageElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
              imageElement.setAttributeNS('http://www.w3.org/1999/xlink', 'href', print.image_url);
              imageElement.setAttribute('x', xPosition);
              imageElement.setAttribute('y', yPosition);
              imageElement.setAttribute('width', printWidthPx);
              imageElement.setAttribute('height', printHeightPx);
              imageElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
              
              console.log(`[SvgImageWithPrint] Added print image at x=${xPosition}, y=${yPosition}, w=${printWidthPx}px, h=${printHeightPx}px`);
              
              // Temporarily store prints in an array
              if (!svgElement.__tempPrints) {
                svgElement.__tempPrints = [];
              }
              svgElement.__tempPrints.push(imageElement);
            } else {
              console.warn(`[SvgImageWithPrint] Skipping print ${print.name}: missing image_url, width, or height`);
            }
          });
          
          // After processing all prints, reorganize the SVG to ensure prints are absolutely last
          if (svgElement.__tempPrints && svgElement.__tempPrints.length > 0) {
            console.log(`[SvgImageWithPrint] Reorganizing SVG to ensure ${svgElement.__tempPrints.length} print(s) render on top`);
            
            // Get all current children (except our temp prints)
            const existingChildren = Array.from(svgElement.childNodes);
            
            // Remove all children
            while (svgElement.firstChild) {
              svgElement.removeChild(svgElement.firstChild);
            }
            
            // Add back existing children (this includes rectangles, paths, groups, etc.)
            existingChildren.forEach(child => {
              svgElement.appendChild(child);
            });
            
            // NOW add prints absolutely last - they will render on top of everything
            // Also add pointer-events to ensure they're interactive
            svgElement.__tempPrints.forEach((printImg, idx) => {
              printImg.setAttribute('pointer-events', 'all');
              printImg.setAttribute('data-print-layer', 'true');
              svgElement.appendChild(printImg);
              
              // Log the actual attributes of the image element to debug
              const href = printImg.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
              const x = printImg.getAttribute('x');
              const y = printImg.getAttribute('y');
              const width = printImg.getAttribute('width');
              const height = printImg.getAttribute('height');
              console.log(`[SvgImageWithPrint] Appended print ${idx + 1}:`);
              console.log(`  href: ${href}`);
              console.log(`  x: ${x}, y: ${y}`);
              console.log(`  width: ${width}, height: ${height}`);
              console.log(`  Element:`, printImg);
            });
            
            // Log the final structure with detailed info about groups
            const finalChildren = Array.from(svgElement.children);
            console.log(`[SvgImageWithPrint] Final SVG structure (${finalChildren.length} total children):`);
            finalChildren.forEach((child, idx) => {
              const tagName = child.tagName;
              const id = child.id || 'no-id';
              const isPrint = child.getAttribute('data-print-layer') === 'true';
              console.log(`  ${idx}: <${tagName}> id="${id}" ${isPrint ? '🖼️ PRINT IMAGE' : ''}`);
              
              // If it's a group, log what's inside recursively
              if (tagName === 'g' && child.children.length > 0) {
                console.log(`    Group contains ${child.children.length} children:`);
                Array.from(child.children).slice(0, 10).forEach((grandchild, gidx) => {
                  const fill = grandchild.getAttribute('fill') || 'none';
                  const opacity = grandchild.getAttribute('opacity') || '1';
                  console.log(`      ${gidx}: <${grandchild.tagName}> id="${grandchild.id || 'no-id'}" fill="${fill}" opacity="${opacity}"`);
                  
                  // If grandchild is also a group, show EVERYTHING inside it
                  if (grandchild.tagName === 'g' && grandchild.children.length > 0) {
                    console.log(`        └─ Contains ${grandchild.children.length} children (showing ALL):`);
                    Array.from(grandchild.children).forEach((ggchild, ggidx) => {
                      const ggfill = ggchild.getAttribute('fill') || 'none';
                      const ggopacity = ggchild.getAttribute('opacity') || '1';
                      const ggid = ggchild.id || 'no-id';
                      console.log(`           ${ggidx}: <${ggchild.tagName}> id="${ggid}" fill="${ggfill}" opacity="${ggopacity}"`);
                    });
                  }
                });
                if (child.children.length > 10) {
                  console.log(`      ... and ${child.children.length - 10} more`);
                }
              }
            });
            
            delete svgElement.__tempPrints;
          }
        }

        // Convert back to string
        const serializer = new XMLSerializer();
        const modifiedSvg = serializer.serializeToString(svgElement);
        svgCache[cacheKey] = modifiedSvg;
        setSvgContent(modifiedSvg);
        
      } catch (error) {
        console.warn('Failed to load SVG:', garmentSrc, error.message);
        setSvgContent(null);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      loadAndModifySvg();
    }, Math.random() * 100);

    return () => clearTimeout(timer);
  }, [garmentSrc, prints, maxPrintWidth, maxPrintHeight, rMaxPrintWidth, rMaxPrintHeight, lMaxPrintWidth, lMaxPrintHeight]);

  if (loading) {
    return <div className={className}>{fallback || '...'}</div>;
  }

  if (!svgContent) {
    return <div className={className}>{fallback}</div>;
  }

  return (
    <div 
      className={`${className} overflow-hidden`}
      style={{ borderRadius: '0.75rem' }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}