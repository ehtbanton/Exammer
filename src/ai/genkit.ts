import {genkit, Genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {geminiApiKeyManager} from '@root/gemini-api-key-manager';
import {checkAITokenBudget, recordAITokenUsage} from '@/lib/rate-limiter';
import {getUserWithAccessLevel} from '@/lib/auth-helpers';

// Default AI instance using the first available key
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash-lite',
});

/**
 * Create a Genkit instance for a specific API key
 * This is used internally by flows that need to use the global key manager
 */
export function createGenkitInstance(apiKey: string): Genkit {
  return genkit({
    plugins: [googleAI({apiKey})],
    model: 'googleai/gemini-2.5-flash-lite',
  });
}

/**
 * Token usage tracking context
 */
interface TokenUsageContext {
  userId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
}

/**
 * Execute a Genkit flow with automatic API key management and token-based rate limiting
 * This wraps the key acquisition/release logic and tracks token usage
 *
 * @param flowFn - The flow function to execute
 * @param input - Input to the flow
 * @param userId - User ID for rate limiting (optional - if not provided, no rate limiting applied)
 */
export async function executeWithManagedKey<TInput, TOutput>(
  flowFn: (ai: Genkit, input: TInput) => Promise<TOutput>,
  input: TInput,
  userId?: string
): Promise<TOutput> {
  // Check if user is admin (level 3) - admins bypass rate limits
  let isAdmin = false;
  if (userId) {
    const user = await getUserWithAccessLevel(userId);
    isAdmin = user?.access_level === 3;
  }

  // Check token budget before executing (if userId provided and not admin)
  if (userId && !isAdmin) {
    const budget = checkAITokenBudget(userId);
    if (!budget.allowed) {
      const retryAfter = Math.max(0, budget.resetAt - Math.floor(Date.now() / 1000));
      const minutesUntilReset = Math.ceil(retryAfter / 60);
      throw new Error(
        `AI token limit exceeded. You've used ${budget.limit.toLocaleString()} tokens today. ` +
        `Please try again in ${minutesUntilReset} minutes.`
      );
    }
  }

  return geminiApiKeyManager.withKey(async (apiKey) => {
    const aiInstance = createGenkitInstance(apiKey);

    // Create a wrapped AI instance that tracks token usage (still track for admins for monitoring)
    const wrappedAi = createTokenTrackingWrapper(aiInstance, userId);

    const result = await flowFn(wrappedAi, input);

    return result;
  });
}

/**
 * Create a wrapper around Genkit that tracks token usage
 */
function createTokenTrackingWrapper(ai: Genkit, userId?: string): Genkit {
  if (!userId) {
    return ai; // No tracking needed
  }

  // Create a proxy that intercepts generate calls to track usage
  const originalGenerate = ai.generate.bind(ai);

  const wrappedGenerate = async (...args: Parameters<typeof originalGenerate>) => {
    const response = await originalGenerate(...args);

    // Extract token usage from response
    if (response.usage) {
      const inputTokens = response.usage.inputTokens || 0;
      const outputTokens = response.usage.outputTokens || 0;
      const totalTokens = inputTokens + outputTokens;

      if (totalTokens > 0) {
        recordAITokenUsage(userId, totalTokens);
      }
    }

    return response;
  };

  // Return a new object with the wrapped generate function
  // We need to be careful here to preserve all other Genkit functionality
  return {
    ...ai,
    generate: wrappedGenerate,
  } as Genkit;
}

/**
 * Execute with managed key and explicit token tracking
 * Use this when you need more control over token tracking
 */
export async function executeWithManagedKeyAndTracking<TInput, TOutput>(
  flowFn: (ai: Genkit, input: TInput, trackTokens: (tokens: number) => void) => Promise<TOutput>,
  input: TInput,
  userId: string
): Promise<TOutput> {
  // Check if user is admin (level 3) - admins bypass rate limits
  const user = await getUserWithAccessLevel(userId);
  const isAdmin = user?.access_level === 3;

  // Check token budget before executing (unless admin)
  if (!isAdmin) {
    const budget = checkAITokenBudget(userId);
    if (!budget.allowed) {
      const retryAfter = Math.max(0, budget.resetAt - Math.floor(Date.now() / 1000));
      const minutesUntilReset = Math.ceil(retryAfter / 60);
      throw new Error(
        `AI token limit exceeded. You've used ${budget.limit.toLocaleString()} tokens today. ` +
        `Please try again in ${minutesUntilReset} minutes.`
      );
    }
  }

  return geminiApiKeyManager.withKey(async (apiKey) => {
    const aiInstance = createGenkitInstance(apiKey);

    // Token tracking function
    const trackTokens = (tokens: number) => {
      if (tokens > 0) {
        recordAITokenUsage(userId, tokens);
      }
    };

    return flowFn(aiInstance, input, trackTokens);
  });
}

// Export the manager for direct use if needed
export {geminiApiKeyManager};
