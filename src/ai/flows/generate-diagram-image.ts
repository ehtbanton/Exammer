'use server';

/**
 * @fileOverview Generates diagram images using Gemini 3 Pro Image (nano banana pro).
 *
 * - generateDiagramImage - Function that generates an image from a text description
 * - Uses gemini-3-pro-image-preview model with generateContent API
 * - Uses the existing Gemini API key manager for key rotation
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
 * Generate a diagram image using Gemini 3 Pro Image (nano banana pro).
 * Uses the existing Gemini API key manager for key rotation.
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
      // Use generateContent API with Gemini 3 Pro Image (nano banana pro)
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{
          role: 'user',
          parts: [{
            text: `Generate a clear educational diagram: ${input.description}

Requirements:
- Clean, simple lines suitable for exam study materials
- Clear labels and measurements where specified
- Professional appearance like a textbook diagram
- White or light background for readability`
          }]
        }],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
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
