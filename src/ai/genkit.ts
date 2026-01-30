import {genkit, Genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {geminiApiKeyManager} from '@root/gemini-api-key-manager';

// Default AI instance using the first available key
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-3-flash-preview',
});

/**
 * Create a Genkit instance for a specific API key
 * This is used internally by flows that need to use the global key manager
 */
export function createGenkitInstance(apiKey: string): Genkit {
  return genkit({
    plugins: [googleAI({apiKey})],
    model: 'googleai/gemini-3-flash-preview',
  });
}

/**
 * Execute a Genkit flow with automatic API key management
 * This wraps the key acquisition/release logic
 *
 * @param flowFn - The flow function to execute
 * @param input - Input to the flow
 */
export async function executeWithManagedKey<TInput, TOutput>(
  flowFn: (ai: Genkit, input: TInput) => Promise<TOutput>,
  input: TInput
): Promise<TOutput> {
  const result = await geminiApiKeyManager.withKey(async (apiKey) => {
    const aiInstance = createGenkitInstance(apiKey);
    return await flowFn(aiInstance, input);
  });

  return result;
}

/**
 * Execute with managed key and explicit token tracking
 * Use this when you need more control over token tracking
 */
export async function executeWithManagedKeyAndTracking<TInput, TOutput>(
  flowFn: (ai: Genkit, input: TInput, trackTokens: (tokens: number) => void) => Promise<TOutput>,
  input: TInput
): Promise<TOutput> {
  const result = await geminiApiKeyManager.withKey(async (apiKey) => {
    const aiInstance = createGenkitInstance(apiKey);

    // Token tracking function (no-op)
    const trackTokens = (_tokens: number) => {};

    return flowFn(aiInstance, input, trackTokens);
  });

  return result;
}

// Export the manager for direct use if needed
export {geminiApiKeyManager};
