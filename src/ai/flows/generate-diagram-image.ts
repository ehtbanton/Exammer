'use server';

/**
 * @fileOverview Generates diagram images using Gemini 2.5 Flash.
 *
 * - generateDiagramImage - Function that generates an image from a text description
 * - Uses gemini-2.5-flash-preview-image-generation model with generateContent API
 * - Uses the existing Gemini API key manager for consistency
 */

import { GoogleGenAI } from "@google/genai";
import { geminiApiKeyManager } from '@root/gemini-api-key-manager';

export interface GenerateDiagramImageInput {
  description: string;
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
}

export interface GenerateDiagramImageOutput {
  imageDataUri: string; // Base64 data URI
}

/**
 * Generate a diagram image using Gemini 2.5 Flash.
 * Uses the existing Gemini API key manager to ensure rate limiting and key rotation.
 */
export async function generateDiagramImage(
  input: GenerateDiagramImageInput
): Promise<GenerateDiagramImageOutput> {
  const startTime = Date.now();
  console.log('[Gemini Image] Starting diagram generation...');
  console.log(`[Gemini Image] Description: ${input.description.substring(0, 100)}...`);

  // Use the global API key manager
  const result = await geminiApiKeyManager.withKey(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });

    try {
      // Use generateContent API for Gemini image generation
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{
          role: 'user',
          parts: [{ text: `Generate an educational diagram image: ${input.description}. Make it clear, simple, and suitable for exam study materials. Use clean lines and labels.` }]
        }],
        config: {
          responseModalities: ['image', 'text'],
        },
      });

      // Extract image from response parts
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No response candidates from Gemini');
      }

      const parts = response.candidates[0].content?.parts;
      if (!parts) {
        throw new Error('No parts in response');
      }

      // Find the inline_data part containing the image
      for (const part of parts) {
        if (part.inlineData) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          const imageData = part.inlineData.data;

          if (!imageData) {
            continue;
          }

          const imageDataUri = `data:${mimeType};base64,${imageData}`;

          const endTime = Date.now();
          const duration = ((endTime - startTime) / 1000).toFixed(2);
          console.log(`[Gemini Image] Diagram generated successfully in ${duration}s`);

          return { imageDataUri };
        }
      }

      throw new Error('No image data found in response');
    } catch (error: any) {
      console.error('[Gemini Image] Error generating diagram:', error);
      throw new Error(`Failed to generate diagram: ${error.message}`);
    }
  });

  return result;
}
