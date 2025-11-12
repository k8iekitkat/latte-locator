// app/api/cafes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { memoryCache } from '@/lib/cache/memoryCache';
import { getCacheKey, calculateDistance, formatDistance } from '@/lib/utils/helpers';
import { Cafe, SearchParams } from '@/types';

// Mock data for demo (replace with real Google Maps API later)
const MOCK_CAFES = [
  {
    googlePlaceId: 'ChIJ1',
    name: 'Blue Bottle Coffee',
    address: '66 Mint St, San Francisco, CA',
    latitude: 37.7833,
    longitude: -122.4167,
    rating: 4.5,
    priceLevel: 2,
    tags: ['WiFi', 'Outlets', 'Quiet'],
  },
  {
    googlePlaceId: 'ChIJ2',
    name: 'Sightglass Coffee',
    address: '270 7th St, San Francisco, CA',
    latitude: 37.7764,
    longitude: -122.4085,
    rating: 4.7,
    priceLevel: 2,
    tags: ['WiFi', 'Spacious', 'Trendy'],
  },
  {
    googlePlaceId: 'ChIJ3',
    name: 'Ritual Coffee Roasters',
    address: '1026 Valencia St, San Francisco, CA',
    latitude: 37.7558,
    longitude: -122.4213,
    rating: 4.6,
    priceLevel: 2,
    tags: ['WiFi', 'Quiet', 'Outdoor Seating'],
  },
  {
    googlePlaceId: 'ChIJ4',
    name: 'Philz Coffee',
    address: '3101 24th St, San Francisco, CA',
    latitude: 37.7529,
    longitude: -122.4144,
    rating: 4.4,
    priceLevel: 2,
    tags: ['WiFi', 'Outlets', 'Custom Blends'],
  },
  {
    googlePlaceId: 'ChIJ5',
    name: 'Four Barrel Coffee',
    address: '375 Valencia St, San Francisco, CA',
    latitude: 37.7654,
    longitude: -122.4213,
    rating: 4.5,
    priceLevel: 2,
    tags: ['Artisanal', 'Local Roaster', 'WiFi'],
  },
];

function generateMockCafes(lat: number, lng: number, radius: number): Cafe[] {
  return MOCK_CAFES.map((cafe, index) => {
    const distance = calculateDistance(lat, lng, cafe.latitude, cafe.longitude);
    
    // Only include cafes within radius
    if (distance > radius) return null;

    return {
      id: index + 1,
      ...cafe,
      distance: formatDistance(distance),
      crowdLevel: Math.floor(Math.random() * 5) + 1,
      predictedWait: `${Math.floor(Math.random() * 10) + 2}-${Math.floor(Math.random() * 10) + 8} min`,
      aiScore: Math.floor(Math.random() * 20) + 80,
      cached: Math.random() > 0.3, // 70% cached
      openNow: true,
    };
  }).filter(Boolean) as Cafe[];
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let cacheHit = false;
  let cacheSource = 'none';

  try {
    // Extract parameters
    const searchParams = request.nextUrl.searchParams;
    const latitude = parseFloat(searchParams.get('lat') || '0');
    const longitude = parseFloat(searchParams.get('lng') || '0');
    const radius = parseInt(searchParams.get('radius') || '5000');
    const query = searchParams.get('query') || '';

    // Validate inputs
    if (!latitude || !longitude) {
      return NextResponse.json(
        { success: false, error: 'Latitude and longitude are required' },
        { status: 400 }
      );
    }

    const params: SearchParams = { latitude, longitude, radius, query };
    const cacheKey = getCacheKey(params);

    // Check memory cache
    let cafes = memoryCache.get(cacheKey);
    if (cafes) {
      cacheHit = true;
      cacheSource = 'memory';
      console.log('✅ Cache hit (Memory):', cacheKey);
    } else {
      // Generate mock data (in production, fetch from Google Maps API)
      console.log('🌐 Cache miss - Generating data:', cacheKey);
      cafes = generateMockCafes(latitude, longitude, radius);
      
      // Store in cache
      memoryCache.set(cacheKey, cafes);
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: cafes,
      meta: {
        count: cafes.length,
        cacheHit,
        cacheSource,
        responseTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('Error in café search:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error', 
        message: error.message 
      },
      { status: 500 }
    );
  }
}