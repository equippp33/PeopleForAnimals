import type { Libraries } from "@react-google-maps/api";

import { env } from "../../env";

export const GOOGLE_MAPS_API_KEY = env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export const GOOGLE_MAPS_CONFIG = {
  apiKey: GOOGLE_MAPS_API_KEY,
  libraries: ["geometry", "places"] as Libraries,
  defaultCenter: {
    lat: 17.385044,
    lng: 78.486671,
  } as const,
  defaultZoom: 15,
} as const;

// Type for coordinates
export interface Coordinates {
  lat: number;
  lng: number;
}

// Type for place selection result
export interface PlaceSelectionResult {
  name: string;
  formattedAddress: string;
  coordinates: Coordinates;
}
