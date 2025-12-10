/**
 * @fileOverview Generates text embeddings using Google's text-embedding-004 model.
 *
 * - generateEmbedding - Generates embedding for a single text
 * - generateEmbeddings - Generates embeddings for multiple texts (batched)
 *
 * Uses 768-dimensional vectors suitable for semantic search with cosine similarity.
 */

import { GoogleGenAI } from "@google/genai";
import { geminiApiKeyManager } from '@root/gemini-api-key-manager';

const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMENSIONS = 768;

export interface GenerateEmbeddingInput {
  text: string;
}

export interface GenerateEmbeddingOutput {
  embedding: number[];
  dimensions: number;
}

export interface GenerateEmbeddingsInput {
  texts: string[];
}

export interface GenerateEmbeddingsOutput {
  embeddings: number[][];
  dimensions: number;
}

/**
 * Generate an embedding vector for a single text.
 * Uses Google's text-embedding-004 model (768 dimensions).
 */
export async function generateEmbedding(
  input: GenerateEmbeddingInput
): Promise<GenerateEmbeddingOutput> {
  if (!input.text || input.text.trim().length === 0) {
    throw new Error('Text is required for embedding generation');
  }

  const result = await geminiApiKeyManager.withKey(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: input.text,
    });

    if (!response.embeddings || response.embeddings.length === 0) {
      throw new Error('No embedding returned from API');
    }

    const embedding = response.embeddings[0].values;
    if (!embedding || embedding.length === 0) {
      throw new Error('Empty embedding values returned');
    }

    return {
      embedding,
      dimensions: embedding.length,
    };
  });

  return result;
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * More efficient for batch processing.
 */
export async function generateEmbeddings(
  input: GenerateEmbeddingsInput
): Promise<GenerateEmbeddingsOutput> {
  if (!input.texts || input.texts.length === 0) {
    throw new Error('At least one text is required for embedding generation');
  }

  // Filter out empty texts
  const validTexts = input.texts.filter(t => t && t.trim().length > 0);
  if (validTexts.length === 0) {
    throw new Error('All provided texts are empty');
  }

  const result = await geminiApiKeyManager.withKey(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });

    // Process texts in parallel (API may have limits, so we chunk if needed)
    const BATCH_SIZE = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
      const batch = validTexts.slice(i, i + BATCH_SIZE);

      // Generate embeddings for each text in the batch
      const batchPromises = batch.map(async (text) => {
        const response = await ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: text,
        });

        if (!response.embeddings || response.embeddings.length === 0) {
          throw new Error('No embedding returned from API');
        }

        return response.embeddings[0].values;
      });

      const batchResults = await Promise.all(batchPromises);
      allEmbeddings.push(...batchResults);
    }

    return {
      embeddings: allEmbeddings,
      dimensions: EMBEDDING_DIMENSIONS,
    };
  });

  return result;
}

/**
 * Calculate cosine similarity between two embedding vectors.
 * Returns a value between -1 and 1, where 1 means identical.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embedding vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}
