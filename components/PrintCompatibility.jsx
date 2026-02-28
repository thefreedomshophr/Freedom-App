// Helper function to check if selected prints fit on a garment
export function canPrintsFitOnGarment(garment, selectedPrints) {
  if (!selectedPrints || selectedPrints.length === 0) {
    return true; // No prints selected, all garments compatible
  }

  // Check each print placement
  for (const printData of selectedPrints) {
    const { print, placement } = printData;
    
    if (!print.width || !print.height) {
      continue; // Skip prints without dimensions
    }

    // Map placement to garment's max dimensions
    let maxWidth, maxHeight;
    
    switch (placement) {
      case 'front':
      case 'chest':
      case 'full_front':
        maxWidth = garment.front_max_print_width;
        maxHeight = garment.front_max_print_height;
        break;
      case 'back':
      case 'full_back':
        maxWidth = garment.back_max_print_width;
        maxHeight = garment.back_max_print_height;
        break;
      case 'right_sleeve':
        maxWidth = garment.rsleeve_max_print_width;
        maxHeight = garment.rsleeve_max_print_height;
        break;
      case 'left_sleeve':
        maxWidth = garment.lsleeve_max_print_width;
        maxHeight = garment.lsleeve_max_print_height;
        break;
      default:
        continue;
    }

    // If garment doesn't have max dimensions set, assume it's compatible
    if (!maxWidth || !maxHeight) {
      continue;
    }

    // Check if print fits
    if (print.width > maxWidth || print.height > maxHeight) {
      return false;
    }
  }

  return true;
}

// Filter garments by print compatibility
export function filterGarmentsByPrintCompatibility(garments) {
  const selectedPrintsData = localStorage.getItem('selectedPrints');
  if (!selectedPrintsData) {
    return garments; // No prints selected
  }

  try {
    const selectedPrints = JSON.parse(selectedPrintsData);
    return garments.filter(garment => canPrintsFitOnGarment(garment, selectedPrints));
  } catch (error) {
    console.error('Error filtering garments by print compatibility:', error);
    return garments;
  }
}