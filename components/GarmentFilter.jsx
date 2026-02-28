// Helper function to filter garments by location availability
export function filterGarmentsByLocation(garments) {
  const selectedLocationData = localStorage.getItem('selectedLocation');
  if (!selectedLocationData) return garments;
  
  try {
    const selectedLocation = JSON.parse(selectedLocationData);
    const locationName = selectedLocation.name;
    
    // Map location names to codes
    const locationCodeMap = {
      'Freedom': 'FR',
      'Sharkys': 'SH',
      'Cannon Beach Freedom': 'CB'
    };
    
    const locationCode = locationCodeMap[locationName];
    if (!locationCode) return garments;
    
    // Filter garments that have the location code in their availability
    return garments.filter(garment => {
      if (!garment.availability) return true; // If no availability set, show everywhere
      return garment.availability.includes(locationCode);
    });
  } catch (error) {
    console.error('Error filtering garments by location:', error);
    return garments;
  }
}