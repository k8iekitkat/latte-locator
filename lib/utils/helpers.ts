// lib/utils/helpers.ts
import { SearchParams } from '@/types';

export function getCacheKey(params: SearchParams): string {
  const { latitude, longitude, radius = 5000, query = '' } = params;
  // Round coordinates to 3 decimal places for cache hits in similar areas
  const lat = latitude.toFixed(3);
  const lng = longitude.toFixed(3);
  return `cafes:${lat},${lng}:${radius}:${query}`;
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1609.34).toFixed(1)} mi`; // Convert to miles
}

export function getCrowdColor(level: number): string {
  const colors = [
    'text-green-400',
    'text-green-400',
    'text-yellow-400',
    'text-orange-400',
    'text-red-400',
  ];
  return colors[level - 1] || 'text-gray-400';
}

export function getCrowdText(level: number): string {
  const texts = ['Very Quiet', 'Quiet', 'Moderate', 'Busy', 'Very Busy'];
  return texts[level - 1] || 'Unknown';
}