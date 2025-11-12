// lib/cache/memoryCache.ts
import { CacheEntry } from '@/types';

const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_MEMORY_CACHE_SIZE = 100;

class MemoryCache {
  private cache: Map<string, CacheEntry>;

  constructor() {
    this.cache = new Map();
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > MEMORY_CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  set(key: string, data: any): void {
    // LRU eviction - remove oldest entry if cache is full
    if (this.cache.size >= MAX_MEMORY_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      key,
      data,
      timestamp: Date.now(),
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
export const memoryCache = new MemoryCache();