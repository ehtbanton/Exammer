/**
 * Global Gemini API Key Manager
 *
 * Manages multiple Gemini API keys on a when-available basis across the entire application.
 *
 * Rules per API key:
 * - Max 2 concurrent requests
 * - Max 10 requests per minute
 *
 * Usage:
 * ```typescript
 * const manager = GeminiApiKeyManager.getInstance();
 * const apiKey = await manager.acquireKey();
 * try {
 *   // Make your API call with the apiKey
 * } finally {
 *   manager.releaseKey(apiKey);
 * }
 * ```
 */

interface KeyState {
  key: string;
  concurrentCount: number;
  requestCount: number;
  windowStart: number;
  lastRequestTime: number;
}

export class GeminiApiKeyManager {
  private static instance: GeminiApiKeyManager;
  private apiKeys: string[];
  private keyStates: Map<string, KeyState>;
  private waitQueue: Array<{
    resolve: (key: string) => void;
    reject: (error: Error) => void;
  }>;
  private currentKeyIndex: number;
  private isProcessingQueue: boolean;

  // Rate limiting constants
  private readonly MAX_CONCURRENT_PER_KEY = 1;
  private readonly MAX_REQUESTS_PER_MINUTE = 10;
  private readonly MINUTE_MS = 60 * 1000;
  private readonly MIN_REQUEST_INTERVAL_MS = 1000; // 1 second between requests to same key

  private constructor() {
    this.apiKeys = [];
    this.keyStates = new Map();
    this.waitQueue = [];
    this.currentKeyIndex = 0;
    this.isProcessingQueue = false;
    this.initialize();
  }

  /**
   * Get the singleton instance of the API key manager
   */
  public static getInstance(): GeminiApiKeyManager {
    if (!GeminiApiKeyManager.instance) {
      GeminiApiKeyManager.instance = new GeminiApiKeyManager();
    }
    return GeminiApiKeyManager.instance;
  }

  /**
   * Initialize API keys from environment variables
   */
  private initialize(): void {
    // Try to load parallel keys first
    const parallelKeysEnv = process.env.GEMINI_API_KEYS_PARALLEL;
    if (parallelKeysEnv) {
      try {
        const parsedKeys = JSON.parse(parallelKeysEnv);
        if (Array.isArray(parsedKeys) && parsedKeys.length > 0) {
          this.apiKeys = parsedKeys.filter((k) => typeof k === 'string' && k.length > 0);
        }
      } catch (error) {
        console.error('Failed to parse GEMINI_API_KEYS_PARALLEL:', error);
      }
    }

    // Fallback to single key if parallel keys not available
    if (this.apiKeys.length === 0) {
      const singleKey = process.env.GEMINI_API_KEY;
      if (singleKey) {
        this.apiKeys = [singleKey];
      } else {
        throw new Error('No Gemini API keys found in environment variables');
      }
    }

    // Initialize state for each key
    const now = Date.now();
    for (const key of this.apiKeys) {
      this.keyStates.set(key, {
        key,
        concurrentCount: 0,
        requestCount: 0,
        windowStart: now,
        lastRequestTime: 0,
      });
    }

    console.log(`[GeminiApiKeyManager] Initialized with ${this.apiKeys.length} API key(s)`);
  }

  /**
   * Get the number of available API keys
   */
  public getKeyCount(): number {
    return this.apiKeys.length;
  }

  /**
   * Get all API keys (useful for creating genkit instances)
   */
  public getAllKeys(): string[] {
    return [...this.apiKeys];
  }

  /**
   * Acquire an API key when available
   * This method will wait if all keys are currently at their limits
   */
  public async acquireKey(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      // Add to queue
      this.waitQueue.push({ resolve, reject });

      const queuePosition = this.waitQueue.length;
      if (queuePosition > this.apiKeys.length * this.MAX_CONCURRENT_PER_KEY) {
        console.log(`[GeminiApiKeyManager] Request queued (position: ${queuePosition})`);
      }

      // Set a timeout to prevent indefinite waiting (5 minutes max)
      const timeout = setTimeout(() => {
        const index = this.waitQueue.findIndex((item) => item.resolve === resolve);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
          reject(new Error('Timeout waiting for available API key'));
        }
      }, 5 * 60 * 1000);

      // Clean up timeout if resolved
      const originalResolve = resolve;
      const wrappedResolve = (key: string) => {
        clearTimeout(timeout);
        originalResolve(key);
      };
      this.waitQueue[this.waitQueue.length - 1].resolve = wrappedResolve;

      // Try to process the queue immediately
      this.processWaitQueue();
    });
  }

  /**
   * Try to get an available key immediately (non-blocking)
   */
  private tryGetAvailableKey(): string | null {
    const now = Date.now();
    const startIndex = this.currentKeyIndex;

    // Try each key in round-robin fashion
    for (let i = 0; i < this.apiKeys.length; i++) {
      const keyIndex = (startIndex + i) % this.apiKeys.length;
      const key = this.apiKeys[keyIndex];
      const state = this.keyStates.get(key)!;

      // Reset request count if window has passed
      if (now - state.windowStart >= this.MINUTE_MS) {
        console.log(
          `[GeminiApiKeyManager] Reset rate limit window for key ${keyIndex + 1}/${this.apiKeys.length}`
        );
        state.requestCount = 0;
        state.windowStart = now;
      }

      // Check if key is available (concurrency + rate limit + burst protection)
      const concurrentAvailable = state.concurrentCount < this.MAX_CONCURRENT_PER_KEY;
      const rateAvailable = state.requestCount < this.MAX_REQUESTS_PER_MINUTE;
      const timeSinceLastRequest = now - state.lastRequestTime;
      const burstAvailable = timeSinceLastRequest >= this.MIN_REQUEST_INTERVAL_MS;

      if (concurrentAvailable && rateAvailable && burstAvailable) {
        // Mark key as in use BEFORE returning
        state.concurrentCount++;
        state.requestCount++;
        state.lastRequestTime = now;

        // Move to next key for round-robin
        this.currentKeyIndex = (keyIndex + 1) % this.apiKeys.length;

        console.log(
          `[GeminiApiKeyManager] Acquired key ${keyIndex + 1}/${this.apiKeys.length} ` +
          `(concurrent: ${state.concurrentCount}/${this.MAX_CONCURRENT_PER_KEY}, ` +
          `requests: ${state.requestCount}/${this.MAX_REQUESTS_PER_MINUTE}, ` +
          `last request: ${timeSinceLastRequest}ms ago)`
        );

        return key;
      } else if (!burstAvailable && concurrentAvailable && rateAvailable) {
        console.log(
          `[GeminiApiKeyManager] Key ${keyIndex + 1}/${this.apiKeys.length} skipped - ` +
          `burst protection (last request ${timeSinceLastRequest}ms ago, min ${this.MIN_REQUEST_INTERVAL_MS}ms)`
        );
      }
    }

    return null;
  }

  /**
   * Release a key back to the pool
   */
  public releaseKey(key: string): void {
    const state = this.keyStates.get(key);
    if (!state) {
      console.error('[GeminiApiKeyManager] Attempted to release unknown key');
      return;
    }

    // Decrement concurrent count
    state.concurrentCount = Math.max(0, state.concurrentCount - 1);

    console.log(
      `[GeminiApiKeyManager] Released key (concurrent: ${state.concurrentCount}/${this.MAX_CONCURRENT_PER_KEY})`
    );

    // Process wait queue
    this.processWaitQueue();
  }

  /**
   * Process waiting requests when a key becomes available
   */
  private processWaitQueue(): void {
    // Prevent concurrent processing of the queue (avoid race conditions)
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Process requests from the queue while keys are available
      while (this.waitQueue.length > 0) {
        const availableKey = this.tryGetAvailableKey();
        if (!availableKey) {
          const stats = this.getStats();
          console.log(
            `[GeminiApiKeyManager] No keys available. Active: ${stats.activeRequests}, Queued: ${stats.queuedRequests}`
          );
          break; // No keys available, stop processing queue
        }

        const waiter = this.waitQueue.shift();
        if (waiter) {
          // Resolve the promise synchronously
          // This ensures the counter increment in tryGetAvailableKey() and
          // the promise resolution happen in the same synchronous block
          waiter.resolve(availableKey);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute a function with an acquired API key
   * Automatically handles key acquisition and release
   */
  public async withKey<T>(fn: (apiKey: string) => Promise<T>): Promise<T> {
    const apiKey = await this.acquireKey();
    try {
      return await fn(apiKey);
    } finally {
      this.releaseKey(apiKey);
    }
  }

  /**
   * Get statistics about key usage
   */
  public getStats(): {
    totalKeys: number;
    activeRequests: number;
    queuedRequests: number;
    keyDetails: Array<{
      index: number;
      concurrentCount: number;
      requestCount: number;
      available: boolean;
    }>;
  } {
    const now = Date.now();
    let activeRequests = 0;
    const keyDetails = this.apiKeys.map((key, index) => {
      const state = this.keyStates.get(key)!;

      // Reset request count if window has passed
      if (now - state.windowStart >= this.MINUTE_MS) {
        state.requestCount = 0;
        state.windowStart = now;
      }

      activeRequests += state.concurrentCount;

      return {
        index: index + 1,
        concurrentCount: state.concurrentCount,
        requestCount: state.requestCount,
        available:
          state.concurrentCount < this.MAX_CONCURRENT_PER_KEY &&
          state.requestCount < this.MAX_REQUESTS_PER_MINUTE,
      };
    });

    return {
      totalKeys: this.apiKeys.length,
      activeRequests,
      queuedRequests: this.waitQueue.length,
      keyDetails,
    };
  }
}

// Export singleton instance
export const geminiApiKeyManager = GeminiApiKeyManager.getInstance();
