/**
 * Shared GPS accuracy formatting and capture state types.
 * Keeps frontend accuracy ceiling aligned with Backend GPS_BOUNDS.MAX_ACCURACY_M (5000m).
 */

export const MAX_GPS_ACCURACY_M = 5000;

export type GpsQuality = 'High' | 'Medium' | 'Approximate';

export type GpsCaptureStatus =
  | 'idle'
  | 'locating'
  | 'ready'
  | 'denied'
  | 'unavailable'
  | 'inaccurate'
  | 'unsupported';

export interface GpsCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface GpsCaptureState {
  status: GpsCaptureStatus;
  coords: GpsCoords | null;
  bestRawAccuracy: number | null;
  errorMessage: string | null;
}

export interface GpsAccuracyInfo {
  quality: GpsQuality;
  formatted: string;
  textClass: string;
  pillClass: string;
  mapZoom: number;
}

export function formatGpsDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters >= 1000) {
    return `±${(meters / 1000).toFixed(1)} km`;
  }
  return `±${Math.round(meters)} m`;
}

export function getGpsAccuracyInfo(accuracy?: number | null): GpsAccuracyInfo | null {
  if (accuracy == null || !Number.isFinite(accuracy) || accuracy < 0) {
    return null;
  }

  const formatted = formatGpsDistance(accuracy);

  if (accuracy < 50) {
    return {
      quality: 'High',
      formatted,
      textClass: 'text-emerald-600 dark:text-emerald-400',
      pillClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
      mapZoom: 16,
    };
  }

  if (accuracy <= 500) {
    return {
      quality: 'Medium',
      formatted,
      textClass: 'text-amber-600 dark:text-amber-400',
      pillClass: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
      mapZoom: 15,
    };
  }

  return {
    quality: 'Approximate',
    formatted,
    textClass: 'text-sky-600 dark:text-sky-400',
    pillClass: 'bg-sky-500/20 text-sky-200 border-sky-400/40',
    mapZoom: 13,
  };
}
