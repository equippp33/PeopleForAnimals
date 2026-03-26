interface Coordinates {
  lat: number;
  lng: number;
}

export const calculateDistance = (
  origin: Coordinates,
  destination: Coordinates,
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(destination.lat - origin.lat);
  const dLon = toRad(destination.lng - origin.lng);
  const lat1 = toRad(origin.lat);
  const lat2 = toRad(destination.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateDuration = (distance: number): string => {
  // Assume average speed of 30 km/h in city traffic
  const speedKmH = 30;
  const hours = distance / speedKmH;

  if (hours >= 1) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}hr ${m}m` : `${h}hr`;
  } else {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  }
};

const toRad = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};
