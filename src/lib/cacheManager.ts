/**
 * Simple Memory Cache Manager with TTL (Time To Live)
 */
class CacheManager {
  private cache: Map<string, { data: any; expiry: number }> = new Map();

  /**
   * Set a value in cache
   * @param key Unique key for the cache
   * @param data Data to store
   * @param ttlInSeconds Time to live in seconds (default 5 minutes)
   */
  set(key: string, data: any, ttlInSeconds: number = 300) {
    const expiry = Date.now() + ttlInSeconds * 1000;
    this.cache.set(key, { data, expiry });
  }

  /**
   * Get a value from cache
   * @param key Unique key
   * @returns The data if exists and not expired, otherwise null
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
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
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Check if a key exists and is valid
   */
  isValid(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() <= entry.expiry;
  }
}

export const cacheManager = new CacheManager();
