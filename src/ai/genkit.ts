import {genkit, Genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {geminiApiKeyManager} from './gemini-api-key-manager';

// Default AI instance using the first available key
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});

/**
 * Create a Genkit instance for a specific API key
 * This is used internally by flows that need to use the global key manager
 */
export function createGenkitInstance(apiKey: string): Genkit {
  return genkit({
    plugins: [googleAI({apiKey})],
    model: 'googleai/gemini-2.5-flash',
  });
}

/**
 * Execute a Genkit flow with automatic API key management
 * This wraps the key acquisition/release logic
 */
export async function executeWithManagedKey<TInput, TOutput>(
  flowFn: (ai: Genkit, input: TInput) => Promise<TOutput>,
  input: TInput
): Promise<TOutput> {
  return geminiApiKeyManager.withKey(async (apiKey) => {
    const aiInstance = createGenkitInstance(apiKey);
    return flowFn(aiInstance, input);
  });
}

// Export the manager for direct use if needed
export {geminiApiKeyManager};
