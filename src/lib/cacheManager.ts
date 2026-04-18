/**
 * Enhanced Cache Manager with TTL and Persistence support
 */
class CacheManager {
  private memoryCache: Map<string, { data: any; expiry: number }> = new Map();

  /**
   * Set a value in cache
   * @param key Unique key for the cache
   * @param data Data to store
   * @param ttlInSeconds Time to live in seconds (default 5 minutes)
   * @param persistent Whether to persist in localStorage
   */
  set(key: string, data: any, ttlInSeconds: number = 300, persistent: boolean = false) {
    const expiry = Date.now() + ttlInSeconds * 1000;
    const entry = { data, expiry };
    
    this.memoryCache.set(key, entry);
    
    if (persistent) {
      try {
        localStorage.setItem(`lasya_cache_${key}`, JSON.stringify(entry));
      } catch (e) {
        console.warn("Storage quota exceeded, caching in memory only.");
      }
    }
  }

  /**
   * Get a value from cache
   * @param key Unique key
   * @returns The data if exists and not expired, otherwise null
   */
  get<T>(key: string): T | null {
    // 1. Try memory
    let entry = this.memoryCache.get(key);
    
    // 2. Try localStorage if not in memory
    if (!entry) {
      try {
        const stored = localStorage.getItem(`lasya_cache_${key}`);
        if (stored) {
          entry = JSON.parse(stored);
          if (entry) this.memoryCache.set(key, entry);
        }
      } catch (e) {
        console.warn("Cache parsing error for key:", key);
      }
    }

    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.clear(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Clear a specific key or the entire cache
   * @param key Optional key to clear
   */
  clear(key?: string) {
    if (key) {
      this.memoryCache.delete(key);
      localStorage.removeItem(`lasya_cache_${key}`);
    } else {
      this.memoryCache.clear();
      // Only clear our specific keys from localStorage
      Object.keys(localStorage)
        .filter(k => k.startsWith('lasya_cache_'))
        .forEach(k => localStorage.removeItem(k));
    }
  }

  /**
   * Check if a key exists and is valid
   */
  isValid(key: string): boolean {
    return this.get(key) !== null;
  }
}

export const cacheManager = new CacheManager();
