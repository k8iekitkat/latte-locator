// types/index.ts
export interface Cafe {
  id: number;
  googlePlaceId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  priceLevel: number;
  distance?: string;
  crowdLevel?: number;
  predictedWait?: string;
  tags?: string[];
  cached?: boolean;
  aiScore?: number;
  openNow?: boolean;
  photos?: string[];
  actualDistance?: number;
}

export interface UserProfile {
  userId: number;
  username: string;
  email: string;
  preferences: {
    priceLevel?: number;
    minRating?: number;
    preferredTags?: string[];
    avoidCrowds?: boolean;
  };
}

export interface SearchParams {
  latitude: number;
  longitude: number;
  radius?: number;
  query?: string;
}

export interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
}

export interface APIResponse<T> {
  success: boolean;
  data: T;
  nextPageToken?: string;
  meta?: {
    count?: number;
    cacheHit?: boolean;
    cacheSource?: string;
    responseTime?: number;
    timestamp?: string;
    hasMore?: boolean;
  };
  error?: string;
}

export interface PerformanceMetrics {
  cacheHitRate: number;
  avgResponseTime: number;
  totalRequests: number;
  errorRate: number;
}