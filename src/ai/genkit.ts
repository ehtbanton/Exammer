import {genkit, Genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {geminiApiKeyManager} from '@root/gemini-api-key-manager';
import {
  checkAITokenBudget,
  recordAITokenUsage,
  reserveAITokens,
  completeTokenReservation,
  cancelTokenReservation,
  logAdminBypass,
} from '@/lib/rate-limiter';
import {getUserWithAccessLevel} from '@/lib/auth-helpers';

// Default estimated tokens for different flow types
// These are conservative estimates to prevent race conditions
export const ESTIMATED_TOKENS = {
  SIMPLE_QUERY: 1000,      // Simple question/answer
  DOCUMENT_ANALYSIS: 5000, // Analyzing documents
  BATCH_OPERATION: 10000,  // Batch processing
  INTERVIEW: 3000,         // Interview generation
  SIMILAR_QUESTION: 2000,  // Generate similar questions
} as const;

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
 * @param estimatedTokens - Estimated tokens for this operation (used for pessimistic locking)
 */
export async function executeWithManagedKey<TInput, TOutput>(
  flowFn: (ai: Genkit, input: TInput) => Promise<TOutput>,
  input: TInput,
  userId?: string,
  estimatedTokens: number = ESTIMATED_TOKENS.SIMPLE_QUERY
): Promise<TOutput> {
  // Check if user is admin (level 3) - admins bypass rate limits
  let isAdmin = false;
  if (userId) {
    const user = await getUserWithAccessLevel(userId);
    isAdmin = user?.access_level === 3;

    if (isAdmin) {
      // Log admin bypass for audit purposes
      logAdminBypass(userId, 'AI_TOKEN_LIMIT', {
        estimatedTokens,
        flowType: 'executeWithManagedKey',
      });
    }
  }

  let reservationId: string | undefined;

  // Reserve tokens before executing (if userId provided and not admin)
  if (userId && !isAdmin) {
    const reservation = reserveAITokens(userId, estimatedTokens);

    if (!reservation.success) {
      const retryAfter = Math.max(0, reservation.resetAt - Math.floor(Date.now() / 1000));
      const minutesUntilReset = Math.ceil(retryAfter / 60);
      throw new Error(
        `AI token limit exceeded. ${reservation.error || ''} ` +
        `Please try again in ${minutesUntilReset} minutes.`
      );
    }

    reservationId = reservation.reservationId;
  }

  try {
    let totalTokensUsed = 0;

    const result = await geminiApiKeyManager.withKey(async (apiKey) => {
      const aiInstance = createGenkitInstance(apiKey);

      // Create a wrapped AI instance that tracks token usage
      const wrappedAi = createTokenTrackingWrapper(aiInstance, userId, (tokens) => {
        totalTokensUsed += tokens;
      });

      return await flowFn(wrappedAi, input);
    });

    // Complete the reservation with actual usage
    if (reservationId) {
      completeTokenReservation(reservationId, totalTokensUsed);
    } else if (userId && isAdmin && totalTokensUsed > 0) {
      // Still record admin usage for monitoring (but don't count against limit)
      recordAITokenUsage(userId, totalTokensUsed);
    }

    return result;
  } catch (error) {
    // Cancel reservation if execution fails
    if (reservationId) {
      cancelTokenReservation(reservationId);
    }
    throw error;
  }
}

/**
 * Create a wrapper around Genkit that tracks token usage
 */
function createTokenTrackingWrapper(
  ai: Genkit,
  userId?: string,
  onTokensUsed?: (tokens: number) => void
): Genkit {
  if (!userId && !onTokensUsed) {
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
        // Call the callback to track tokens
        if (onTokensUsed) {
          onTokensUsed(totalTokens);
        }
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
  userId: string,
  estimatedTokens: number = ESTIMATED_TOKENS.SIMPLE_QUERY
): Promise<TOutput> {
  // Check if user is admin (level 3) - admins bypass rate limits
  const user = await getUserWithAccessLevel(userId);
  const isAdmin = user?.access_level === 3;

  if (isAdmin) {
    // Log admin bypass for audit purposes
    logAdminBypass(userId, 'AI_TOKEN_LIMIT', {
      estimatedTokens,
      flowType: 'executeWithManagedKeyAndTracking',
    });
  }

  let reservationId: string | undefined;
  let totalTokensUsed = 0;

  // Reserve tokens before executing (unless admin)
  if (!isAdmin) {
    const reservation = reserveAITokens(userId, estimatedTokens);

    if (!reservation.success) {
      const retryAfter = Math.max(0, reservation.resetAt - Math.floor(Date.now() / 1000));
      const minutesUntilReset = Math.ceil(retryAfter / 60);
      throw new Error(
        `AI token limit exceeded. ${reservation.error || ''} ` +
        `Please try again in ${minutesUntilReset} minutes.`
      );
    }

    reservationId = reservation.reservationId;
  }

  try {
    const result = await geminiApiKeyManager.withKey(async (apiKey) => {
      const aiInstance = createGenkitInstance(apiKey);

      // Token tracking function
      const trackTokens = (tokens: number) => {
        if (tokens > 0) {
          totalTokensUsed += tokens;
        }
      };

      return flowFn(aiInstance, input, trackTokens);
    });

    // Complete the reservation with actual usage
    if (reservationId) {
      completeTokenReservation(reservationId, totalTokensUsed);
    } else if (isAdmin && totalTokensUsed > 0) {
      // Still record admin usage for monitoring
      recordAITokenUsage(userId, totalTokensUsed);
    }

    return result;
  } catch (error) {
    // Cancel reservation if execution fails
    if (reservationId) {
      cancelTokenReservation(reservationId);
    }
    throw error;
  }
}

// Export the manager for direct use if needed
export {geminiApiKeyManager};
