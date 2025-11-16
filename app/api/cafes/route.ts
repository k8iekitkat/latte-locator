// app/api/cafes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { memoryCache } from '@/lib/cache/memoryCache';
import { getCacheKey, formatDistance } from '@/lib/utils/helpers';
import { Cafe, SearchParams } from '@/types';

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
    'wifi': 'WiFi',
    'outdoor_seating': 'Outdoor Seating',
    'takeout': 'Takeout',
    'dine_in': 'Dine-in',
    'serves_coffee': 'Coffee',
    'bakery': 'Bakery',
    'breakfast': 'Breakfast',
  };

  const tags: string[] = [];
  
  // Add default café tags
  tags.push('WiFi', 'Coffee');
  
  // Add one more based on types if available
  for (const type of types) {
    if (tagMap[type] && !tags.includes(tagMap[type])) {
      tags.push(tagMap[type]);
      break;
    }
  }
  
  if (tags.length < 3) {
    tags.push('Seating');
  }

  return tags.slice(0, 3);
}

// Google Places API integration - Get REAL unique cafés with optional pagination
async function fetchRealCafesFromGoogle(lat: number, lng: number, radius: number, pageToken?: string): Promise<{ cafes: Cafe[], nextPageToken?: string }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    console.warn('⚠️ No valid Google Places API key found');
    return { cafes: generateMockCafes(lat, lng), nextPageToken: undefined };
  }

  try {
    let url: string;
    
    if (pageToken) {
      // Use page token to get next page
      console.log(`📄 Fetching next page of cafés...`);
      url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${pageToken}&key=${apiKey}`;
    } else {
      // Initial search
      console.log(`🌐 Fetching REAL cafés from Google Places API`);
      console.log(`📍 Location: ${lat}, ${lng} | Radius: ${radius}m`);
      console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
      url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=cafe&key=${apiKey}`;
    }
    
    console.log(`🌐 Making request to Google Places API...`);
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('❌ Google API HTTP error:', response.status, response.statusText);
      return { cafes: generateMockCafes(lat, lng), nextPageToken: undefined };
    }

    const data = await response.json();
    console.log(`📦 Google API Response Status: ${data.status}`);

    if (data.status === 'REQUEST_DENIED') {
      console.error('❌ Google API Request Denied!');
      console.error('📝 Error message:', data.error_message);
      console.error('💡 Possible fixes:');
      console.error('   1. Enable "Places API (New)" in Google Cloud Console');
      console.error('   2. Make sure billing is set up');
      console.error('   3. Check API key restrictions');
      return { cafes: generateMockCafes(lat, lng), nextPageToken: undefined };
    }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('❌ Google API error:', data.status, data.error_message);
      return { cafes: generateMockCafes(lat, lng), nextPageToken: undefined };
    }

    if (!data.results || data.results.length === 0) {
      console.warn('⚠️ No cafés found in this area');
      return { cafes: [], nextPageToken: undefined };
    }

    console.log(`✅ Found ${data.results.length} cafés`);
    console.log(`🔗 Next page token: ${data.next_page_token ? 'Available' : 'None'}`);

    // Transform each unique café
    const cafes: Cafe[] = data.results.map((place: any, index: number) => {
      const distance = calculateDistance(
        lat,
        lng,
        place.geometry.location.lat,
        place.geometry.location.lng
      );

      const isOpen = place.opening_hours?.open_now ?? true;
      const businessStatus = place.business_status || 'OPERATIONAL';
      const actuallyOpen = businessStatus === 'OPERATIONAL' && isOpen;
      const tags = generateTagsFromTypes(place.types || []);
      const crowdLevel = actuallyOpen ? Math.floor(Math.random() * 5) + 1 : 0;

      return {
        id: index + 1,
        googlePlaceId: place.place_id,
        name: place.name,
        address: place.vicinity || place.formatted_address || 'Address not available',
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        rating: place.rating || 0,
        priceLevel: place.price_level || 2,
        distance: formatDistance(distance),
        crowdLevel: crowdLevel,
        predictedWait: actuallyOpen 
          ? `${Math.floor(Math.random() * 10) + 2}-${Math.floor(Math.random() * 10) + 8} min`
          : 'Closed',
        tags: tags,
        aiScore: Math.floor(Math.random() * 20) + 80,
        cached: false,
        openNow: actuallyOpen,
        actualDistance: distance
      };
    });

    // Sort by distance
    const sortedCafes = cafes.sort((a, b) => (a.actualDistance || 0) - (b.actualDistance || 0));
    
    return {
      cafes: sortedCafes.map(({ actualDistance, ...cafe }) => cafe),
      nextPageToken: data.next_page_token
    };

  } catch (error) {
    console.error('❌ Error fetching from Google Places:', error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('⏱️ Google API timeout - taking too long (>5s)');
        console.error('💡 Using mock data instead');
      } else {
        console.error('💡 Error details:', error.message);
      }
    }
    
    return { cafes: generateMockCafes(lat, lng), nextPageToken: undefined };
  }
}

// Fallback: Generate mock cafés (only used if API fails)
const CAFE_NAMES = [
  'Blue Bottle Coffee', 'Starbucks Reserve', 'Peet\'s Coffee', 'Local Grounds', 'The Daily Grind',
  'Sunrise Café', 'Coffee House', 'Bean Scene', 'Espresso Bar', 'Café Central',
];

function generateMockCafes(lat: number, lng: number): Cafe[] {
  console.log('⚠️ Using MOCK data (API not available)');
  
  const cafes: Cafe[] = [];
  
  for (let i = 0; i < 10; i++) {
    const distanceKm = Math.random() * 5;
    const distanceMeters = distanceKm * 1000;
    const angle = Math.random() * 360;
    const angleRad = angle * (Math.PI / 180);
    const latOffset = (distanceKm / 111) * Math.cos(angleRad);
    const lngOffset = (distanceKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(angleRad);
    const cafeLat = lat + latOffset;
    const cafeLng = lng + lngOffset;
    
    cafes.push({
      id: i + 1,
      googlePlaceId: `mock_${i + 1}`,
      name: CAFE_NAMES[i % CAFE_NAMES.length] + ` (Mock)`,
      address: `${Math.floor(Math.random() * 9999)} Main St (Mock Address)`,
      latitude: cafeLat,
      longitude: cafeLng,
      rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
      priceLevel: Math.floor(Math.random() * 3) + 1,
      distance: formatDistance(distanceMeters),
      crowdLevel: Math.floor(Math.random() * 5) + 1,
      predictedWait: `${Math.floor(Math.random() * 10) + 2}-${Math.floor(Math.random() * 10) + 8} min`,
      tags: ['WiFi', 'Coffee', 'Seating'],
      aiScore: Math.floor(Math.random() * 20) + 80,
      cached: false,
      openNow: true,
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
    const radius = parseInt(searchParams.get('radius') || '25000');
    const query = searchParams.get('query') || '';
    const pageToken = searchParams.get('pageToken') || undefined;

    if (!latitude || !longitude) {
      return NextResponse.json(
        { success: false, error: 'Latitude and longitude are required' },
        { status: 400 }
      );
    }

    console.log(`📍 API Request: lat=${latitude}, lng=${longitude}, radius=${radius}, pageToken=${pageToken ? 'yes' : 'no'}`);

    const params: SearchParams = { latitude, longitude, radius, query };
    const cacheKey = getCacheKey(params) + (pageToken ? `-${pageToken}` : '');

    // Check cache first (only for initial requests, not paginated)
    let result;
    if (!pageToken) {
      const cachedData = memoryCache.get(cacheKey);
      if (cachedData && cachedData.cafes && cachedData.cafes.length > 0) {
        cacheHit = true;
        cacheSource = 'memory';
        console.log('✅ Cache HIT - returning cached cafés');
        result = cachedData;
      }
    }

    if (!result) {
      // Fetch from Google Places API
      console.log('🔄 Cache MISS - fetching from Google Places API...');
      result = await fetchRealCafesFromGoogle(latitude, longitude, radius, pageToken);
      
      if (!pageToken && result.cafes.length > 0) {
        // Only cache initial results
        memoryCache.set(cacheKey, result);
        console.log(`💾 Cached ${result.cafes.length} cafés for future requests`);
      }
    }

    const responseTime = Date.now() - startTime;
    console.log(`⏱️ Response time: ${responseTime}ms`);

    return NextResponse.json({
      success: true,
      data: result.cafes,
      nextPageToken: result.nextPageToken,
      meta: {
        count: result.cafes.length,
        cacheHit,
        cacheSource,
        responseTime,
        timestamp: new Date().toISOString(),
        hasMore: !!result.nextPageToken,
      },
    });
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('❌ API Error:', error);
    
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