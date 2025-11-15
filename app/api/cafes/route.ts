// app/api/cafes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { memoryCache } from '@/lib/cache/memoryCache';
import { getCacheKey, formatDistance } from '@/lib/utils/helpers';
import { Cafe, SearchParams } from '@/types';

// Google Places API integration
async function fetchRealCafesFromGoogle(lat: number, lng: number, radius: number): Promise<Cafe[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ No Google Places API key found, using mock data');
    return generateMockCafes(lat, lng, radius);
  }

  try {
    // Use Google Places API Nearby Search
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=cafe&key=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Google API error:', response.statusText);
      return generateMockCafes(lat, lng, radius);
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google API status:', data.status);
      return generateMockCafes(lat, lng, radius);
    }

    // Transform Google Places results
    const cafes: Cafe[] = await Promise.all(
      data.results.slice(0, 50).map(async (place: any, index: number) => {
        // Get place details for more info (hours, etc.)
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,rating,formatted_address,geometry,opening_hours,price_level,photos,business_status&key=${apiKey}`;
        
        let details = null;
        try {
          const detailsResponse = await fetch(detailsUrl);
          const detailsData = await detailsResponse.json();
          if (detailsData.status === 'OK') {
            details = detailsData.result;
          }
        } catch (error) {
          console.error('Error fetching place details:', error);
        }

        // Calculate distance
        const distance = calculateDistance(
          lat,
          lng,
          place.geometry.location.lat,
          place.geometry.location.lng
        );

        // Determine if currently open
        const openNow = details?.opening_hours?.open_now ?? place.opening_hours?.open_now ?? true;
        
        // Get business status
        const businessStatus = details?.business_status || place.business_status || 'OPERATIONAL';
        const isOpen = businessStatus === 'OPERATIONAL' && openNow;

        // Generate tags based on types
        const tags = generateTagsFromTypes(place.types || []);

        // Generate crowd level and wait time
        const crowdLevel = Math.floor(Math.random() * 5) + 1;
        const predictedWait = isOpen 
          ? `${Math.floor(Math.random() * 10) + 2}-${Math.floor(Math.random() * 10) + 8} min`
          : 'Closed';

        return {
          id: index + 1,
          googlePlaceId: place.place_id,
          name: place.name,
          address: details?.formatted_address || place.vicinity,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          rating: place.rating || 0,
          priceLevel: place.price_level || 2,
          distance: formatDistance(distance),
          crowdLevel: isOpen ? crowdLevel : 0,
          predictedWait: predictedWait,
          tags: tags,
          aiScore: Math.floor(Math.random() * 20) + 80,
          cached: false,
          openNow: isOpen,
          actualDistance: distance
        };
      })
    );

    // Sort by distance
    return cafes.sort((a, b) => (a.actualDistance || 0) - (b.actualDistance || 0))
                .map(({ actualDistance, ...cafe }) => cafe);

  } catch (error) {
    console.error('Error fetching from Google Places:', error);
    return generateMockCafes(lat, lng, radius);
  }
}

// Helper function to calculate distance
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

// Generate tags from Google Place types
function generateTagsFromTypes(types: string[]): string[] {
  const tagMap: { [key: string]: string } = {
    'cafe': 'Café',
    'bakery': 'Bakery',
    'restaurant': 'Food',
    'bar': 'Bar',
    'meal_takeaway': 'Takeaway',
    'point_of_interest': 'Popular',
    'store': 'Shop',
    'food': 'Food'
  };

  const tags = types
    .map(type => tagMap[type])
    .filter(Boolean)
    .slice(0, 3);

  // Add default tags
  if (tags.length < 3) {
    const defaults = ['WiFi', 'Seating', 'Coffee'];
    tags.push(...defaults.slice(0, 3 - tags.length));
  }

  return tags;
}

// Fallback mock data generator (same as before)
const CAFE_NAMES = [
  'Blue Bottle Coffee', 'Starbucks Reserve', 'Peet\'s Coffee', 'Local Grounds', 'The Daily Grind',
  'Sunrise Café', 'Coffee House', 'Bean Scene', 'Espresso Bar', 'Café Central',
  'The Roastery', 'Coffee Corner', 'Morning Brew', 'Urban Coffee', 'The Coffee Shop',
  'Café Noir', 'Java Junction', 'The Grind', 'Café Latte', 'Coffee Culture',
  'Brew Haven', 'The Bean', 'Café Express', 'Coffee Spot', 'The Coffee Lab',
];

const TAG_OPTIONS = [
  ['WiFi', 'Outlets', 'Quiet'],
  ['WiFi', 'Spacious', 'Trendy'],
  ['WiFi', 'Cozy', 'Local'],
  ['WiFi', 'Modern', 'Fast Service'],
  ['WiFi', 'Study Friendly', 'Quiet'],
];

function generateMockCafes(lat: number, lng: number, radius: number): Cafe[] {
  const cafes: Cafe[] = [];
  
  for (let i = 0; i < 50; i++) {
    const distanceKm = Math.random() * 10;
    const distanceMeters = distanceKm * 1000;
    const angle = Math.random() * 360;
    const angleRad = angle * (Math.PI / 180);
    const latOffset = (distanceKm / 111) * Math.cos(angleRad);
    const lngOffset = (distanceKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(angleRad);
    const cafeLat = lat + latOffset;
    const cafeLng = lng + lngOffset;
    const name = CAFE_NAMES[i % CAFE_NAMES.length];
    const tags = TAG_OPTIONS[i % TAG_OPTIONS.length];
    const rating = (Math.random() * 1.5 + 3.5).toFixed(1);
    const priceLevel = Math.floor(Math.random() * 3) + 1;
    
    cafes.push({
      id: i + 1,
      googlePlaceId: `ChIJ${i + 1}`,
      name: name,
      address: `${Math.floor(Math.random() * 9999) + 1} Main St, Your City`,
      latitude: cafeLat,
      longitude: cafeLng,
      rating: parseFloat(rating),
      priceLevel: priceLevel,
      distance: formatDistance(distanceMeters),
      crowdLevel: Math.floor(Math.random() * 5) + 1,
      predictedWait: `${Math.floor(Math.random() * 10) + 2}-${Math.floor(Math.random() * 10) + 8} min`,
      tags: tags,
      aiScore: Math.floor(Math.random() * 20) + 80,
      cached: Math.random() > 0.3,
      openNow: Math.random() > 0.1,
      actualDistance: distanceMeters
    });
  }

  return cafes.sort((a, b) => (a.actualDistance || 0) - (b.actualDistance || 0))
              .map(({ actualDistance, ...cafe }) => cafe);
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let cacheHit = false;
  let cacheSource = 'none';

  try {
    const searchParams = request.nextUrl.searchParams;
    const latitude = parseFloat(searchParams.get('lat') || '0');
    const longitude = parseFloat(searchParams.get('lng') || '0');
    const radius = parseInt(searchParams.get('radius') || '10000');
    const query = searchParams.get('query') || '';

    if (!latitude || !longitude) {
      return NextResponse.json(
        { success: false, error: 'Latitude and longitude are required' },
        { status: 400 }
      );
    }

    const params: SearchParams = { latitude, longitude, radius, query };
    const cacheKey = getCacheKey(params);

    // Check cache
    let cafes = memoryCache.get(cacheKey);
    if (cafes) {
      cacheHit = true;
      cacheSource = 'memory';
      console.log('✅ Cache hit (Memory):', cacheKey);
    } else {
      // Fetch real cafés from Google Places API
      console.log('🌐 Fetching real cafés from Google Places API...');
      cafes = await fetchRealCafesFromGoogle(latitude, longitude, radius);
      
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