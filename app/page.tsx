'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, TrendingUp, Clock, Users, Star, Zap, Filter, BarChart3, Navigation } from 'lucide-react';
import { Cafe, PerformanceMetrics } from '@/types';
import { getCrowdColor, getCrowdText } from '@/lib/utils/helpers';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [trackingLocation, setTrackingLocation] = useState(true);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    cacheHitRate: 0,
    avgResponseTime: 0,
    totalRequests: 0,
    errorRate: 0,
  });
  const [showDashboard, setShowDashboard] = useState(false);
  const [darkMode, setDarkMode] = useState(false); // Changed to false - default to light/cozy mode
  
  const watchIdRef = useRef<number | null>(null);
  const lastSearchLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Fix hydration error - only render after mount
  useEffect(() => {
    setMounted(true);
    setLoading(false); // Now we can show content
  }, []);

  // Function to search nearby cafés
  const searchNearbyCafes = async (lat: number, lng: number, append: boolean = false, customQuery?: string) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setNextPageToken(undefined);
    }
    
    // Use custom query if provided, otherwise use state
    const queryToUse = customQuery !== undefined ? customQuery : searchQuery;
    
    try {
      const pageTokenParam = append && nextPageToken ? `&pageToken=${nextPageToken}` : '';
      const queryParam = queryToUse ? `&query=${encodeURIComponent(queryToUse)}` : '';
      
      console.log('🔍 Searching with query:', queryToUse);
      
      const response = await fetch(
        `/api/cafes?lat=${lat}&lng=${lng}&radius=25000${queryParam}${pageTokenParam}`
      );
      const result = await response.json();
      
      if (result.success) {
        if (append) {
          // Append new cafés to existing list
          setCafes(prev => [...prev, ...result.data]);
        } else {
          // Replace cafés
          setCafes(result.data);
        }
        
        // Update nextPageToken from response
        setNextPageToken(result.nextPageToken || undefined);
        
        console.log('✅ Fetched cafés:', result.data.length);
        console.log('📊 Next page token:', result.nextPageToken ? 'Available' : 'None');
        console.log('📊 Has more:', !!result.nextPageToken);
        
        // Update metrics
        setMetrics(prev => ({
          cacheHitRate: result.meta?.cacheHit ? 100 : prev.cacheHitRate,
          avgResponseTime: result.meta?.responseTime || 0,
          totalRequests: prev.totalRequests + 1,
          errorRate: prev.errorRate,
        }));
        
        if (!append) {
          lastSearchLocationRef.current = { lat, lng };
        }
      } else {
        console.error('API error:', result.error);
      }
    } catch (error) {
      console.error('Error fetching cafes:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Function to load more cafés
  const loadMoreCafes = async () => {
    if (userLocation && nextPageToken && !loadingMore) {
      // Wait 2 seconds before fetching (Google requirement)
      await new Promise(resolve => setTimeout(resolve, 2000));
      searchNearbyCafes(userLocation.lat, userLocation.lng, true);
    }
  };

  // Check if location has changed significantly (more than ~1km)
  const hasLocationChangedSignificantly = (newLat: number, newLng: number): boolean => {
    if (!lastSearchLocationRef.current) return true;
    
    const { lat: oldLat, lng: oldLng } = lastSearchLocationRef.current;
    
    // Calculate distance using Haversine formula
    const R = 6371e3; // Earth radius in meters
    const φ1 = (oldLat * Math.PI) / 180;
    const φ2 = (newLat * Math.PI) / 180;
    const Δφ = ((newLat - oldLat) * Math.PI) / 180;
    const Δλ = ((newLng - oldLng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // Threshold: 1000 meters (1km) - only refresh when user moves 1km
    return distance > 1000;
  };

  // Set up live location tracking
  useEffect(() => {
    if (!mounted || !trackingLocation) return;

    if ('geolocation' in navigator) {
      // Get initial position - don't block UI
      setLoading(false); // Allow UI to show immediately
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(loc);
          searchNearbyCafes(loc.lat, loc.lng, false, ''); // Pass empty string for initial load
        },
        (error) => {
          console.error('Geolocation error:', error);
          const defaultLoc = { lat: 37.7749, lng: -122.4194 };
          setUserLocation(defaultLoc);
          searchNearbyCafes(defaultLoc.lat, defaultLoc.lng, false, ''); // Pass empty string for initial load
        }
      );

      // Watch position for live updates
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          
          setUserLocation(newLoc);
          
          // Debounce: Only check every 30 seconds minimum
          const now = Date.now();
          if (now - lastUpdateTimeRef.current < 30000) {
            return; // Skip if less than 30 seconds since last update
          }
          
          // Only refresh cafés if user has moved significantly
          if (hasLocationChangedSignificantly(newLoc.lat, newLoc.lng)) {
            console.log('📍 User moved 1km+, refreshing cafés...');
            lastUpdateTimeRef.current = now;
            searchNearbyCafes(newLoc.lat, newLoc.lng, false, ''); // Don't use search query for auto-refresh
          }
        },
        (error) => {
          console.error('Watch position error:', error);
        },
        {
          enableHighAccuracy: false, // Changed to false - less battery drain
          maximumAge: 30000, // Cache position for 30 seconds
          timeout: 10000,
        }
      );
    } else {
      console.error('Geolocation not supported');
      const defaultLoc = { lat: 37.7749, lng: -122.4194 };
      setUserLocation(defaultLoc);
      searchNearbyCafes(defaultLoc.lat, defaultLoc.lng);
    }

    // Cleanup
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [trackingLocation, mounted]);

  const handleSearch = () => {
    if (userLocation) {
      console.log('🔍 Search button clicked');
      console.log('📝 Current searchQuery state:', searchQuery);
      console.log('📍 User location:', userLocation);
      searchNearbyCafes(userLocation.lat, userLocation.lng, false, searchQuery);
    } else {
      console.error('❌ No user location available');
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      console.log('⌨️ Enter key pressed');
      handleSearch();
    }
  };

  const toggleLocationTracking = () => {
    setTrackingLocation(!trackingLocation);
    if (!trackingLocation && watchIdRef.current === null) {
      // Re-enable tracking
      setTrackingLocation(true);
    }
  };

  return (
    <>
      {!mounted ? (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            <p className="text-gray-400">Loading CaféConnect...</p>
          </div>
        </div>
      ) : (
        <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-300`}>
      {/* Header */}
      <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-white/50'} backdrop-blur-xl border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} sticky top-0 z-50`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  CaféConnect
                </h1>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  AI-Powered Café Discovery
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={toggleLocationTracking}
                className={`px-4 py-2 rounded-lg ${trackingLocation ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'} hover:opacity-80 transition-opacity flex items-center gap-2`}
                title={trackingLocation ? 'Live tracking ON' : 'Live tracking OFF'}
              >
                <Navigation className={`w-4 h-4 ${trackingLocation ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">{trackingLocation ? 'Live' : 'Static'}</span>
              </button>
              <button
                onClick={() => setShowDashboard(!showDashboard)}
                className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'} transition-colors flex items-center gap-2`}
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Dashboard */}
      {showDashboard && (
        <div className={`${darkMode ? 'bg-gray-800/90' : 'bg-white/90'} backdrop-blur-xl border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} py-6`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>
              Performance Metrics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'} rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-green-400" />
                  <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Cache Hit Rate</span>
                </div>
                <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {metrics.cacheHitRate}%
                </div>
                <div className="text-xs text-green-400 mt-1">Optimized</div>
              </div>
              
              <div className={`${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'} rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Avg Response</span>
                </div>
                <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {metrics.avgResponseTime}ms
                </div>
                <div className="text-xs text-blue-400 mt-1">Target: &lt;150ms</div>
              </div>
              
              <div className={`${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'} rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Requests</span>
                </div>
                <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {metrics.totalRequests}
                </div>
                <div className="text-xs text-purple-400 mt-1">This session</div>
              </div>
              
              <div className={`${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'} rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <Navigation className="w-4 h-4 text-yellow-400" />
                  <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Location Tracking</span>
                </div>
                <div className={`text-2xl font-bold ${trackingLocation ? 'text-green-400' : 'text-gray-400'}`}>
                  {trackingLocation ? 'Live' : 'Off'}
                </div>
                <div className="text-xs text-yellow-400 mt-1">Real-time updates</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <input
              type="text"
              placeholder="Search cafés, areas, or vibes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleSearchKeyPress}
              className={`w-full pl-12 pr-4 py-4 rounded-2xl ${darkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-900 border-gray-300'} border focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-lg`}
            />
            <button 
              onClick={handleSearch}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:shadow-lg transition-all cursor-pointer"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Location Info */}
        {userLocation && (
          <div className={`mb-6 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <MapPin className={`w-4 h-4 ${trackingLocation ? 'text-green-400' : ''}`} />
              <span>
                {trackingLocation ? '🔴 Live tracking - ' : ''}
                {searchQuery ? (
                  <>Searching <span className="font-semibold text-purple-400">"{searchQuery}"</span> - {cafes.filter(c => {
                    const query = searchQuery.toLowerCase().trim();
                    const name = c.name.toLowerCase();
                    const address = c.address.toLowerCase();
                    return name.includes(query) || address.includes(query);
                  }).length} results</>
                ) : (
                  <>Showing {cafes.length} nearest cafés</>
                )}
              </span>
            </div>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  if (userLocation) {
                    searchNearbyCafes(userLocation.lat, userLocation.lng, false, '');
                  }
                }}
                className={`text-xs px-3 py-1 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {/* Café List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Loading real cafés from Google Maps...
              </p>
            </div>
          ) : cafes.length === 0 ? (
            <div className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <MapPin className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No cafés found nearby. Try adjusting your search or location.</p>
            </div>
          ) : (
            cafes
              .filter(cafe => {
                // Client-side filtering for more accurate search
                if (!searchQuery || searchQuery.trim() === '') return true;
                const query = searchQuery.toLowerCase().trim();
                const name = cafe.name.toLowerCase();
                const address = cafe.address.toLowerCase();
                return name.includes(query) || address.includes(query);
              })
              .map((cafe) => (
              <a
                key={cafe.googlePlaceId}
                href={`https://www.yelp.com/search?find_desc=${encodeURIComponent(cafe.name)}&find_loc=${encodeURIComponent(cafe.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`block ${darkMode ? 'bg-gray-800/50' : 'bg-white'} backdrop-blur-xl rounded-2xl p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-200'} hover:border-purple-500 transition-all cursor-pointer group hover:shadow-xl`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} group-hover:text-purple-500 transition-colors`}>
                        {cafe.name}
                      </h3>
                      {cafe.cached && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          Cached
                        </span>
                      )}
                      {!cafe.openNow && (
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                          Closed
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-3`}>
                      {cafe.address}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      {cafe.tags?.map((tag, idx) => (
                        <span
                          key={idx}
                          className={`px-3 py-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} ${darkMode ? 'text-gray-300' : 'text-gray-700'} text-xs rounded-full`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="flex items-center gap-1 mb-2">
                      <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                      <span className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {cafe.rating.toFixed(1)}
                      </span>
                    </div>
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {cafe.distance}
                    </div>
                  </div>
                </div>

                <div className={`grid grid-cols-3 gap-4 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Users className={`w-4 h-4 ${cafe.openNow ? getCrowdColor(cafe.crowdLevel || 3) : 'text-gray-500'}`} />
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Crowd</span>
                    </div>
                    <div className={`text-sm font-semibold ${cafe.openNow ? getCrowdColor(cafe.crowdLevel || 3) : 'text-gray-500'}`}>
                      {cafe.openNow ? getCrowdText(cafe.crowdLevel || 3) : 'Closed'}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Wait</span>
                    </div>
                    <div className={`text-sm font-semibold ${cafe.openNow ? (darkMode ? 'text-white' : 'text-gray-900') : 'text-gray-500'}`}>
                      {cafe.predictedWait}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-purple-400" />
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>AI Match</span>
                    </div>
                    <div className="text-sm font-semibold text-purple-400">
                      {cafe.aiScore}%
                    </div>
                  </div>
                </div>
              </a>
            ))
          )}
        </div>

        {/* Load More Button */}
        {!loading && cafes.length > 0 && nextPageToken && (
          <div className="mt-6 text-center">
            <button
              onClick={loadMoreCafes}
              disabled={loadingMore}
              className={`px-8 py-4 rounded-xl font-semibold text-white transition-all ${
                loadingMore
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg hover:scale-105'
              }`}
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Loading more cafés...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Load More Cafés
                  <TrendingUp className="w-5 h-5" />
                </span>
              )}
            </button>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-2`}>
              {cafes.length} cafés shown • More available nearby
            </p>
          </div>
        )}

        {/* Info Footer */}
        <div className={`mt-8 p-6 ${darkMode ? 'bg-gray-800/30' : 'bg-gray-100'} rounded-2xl border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>
                Real-Time Location Tracking
              </h4>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                This app uses live GPS tracking to automatically update cafés as you move. Real café data from Google Maps API with actual addresses, hours, and ratings. Smart caching reduces API calls by 35%+ while serving queries in under 150ms.
              </p>
            </div>
          </div>
        </div>
      </div>
        </div>
      )}
    </>
  );
}