const memoryCache = new Map<string, unknown>();

export const swrCache = {
  get<T>(key: string): T | undefined {
    return memoryCache.get(key) as T | undefined;
  },

  set<T>(key: string, value: T): void {
    memoryCache.set(key, value);
  },

  invalidate(keyPrefix: string): void {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(keyPrefix)) {
        memoryCache.delete(key);
      }
    }
  },

  clearAll(): void {
    memoryCache.clear();
  },
};
