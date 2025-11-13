/**
 * Image Utility Module
 * Handles image file operations for question images extracted from exam papers
 */

import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// Base directory for uploads (relative to project root)
const UPLOADS_BASE = path.join(process.cwd(), 'uploads', 'images', 'questions');

/**
 * Ensures the image directory exists for a given question
 * @param questionId The question ID
 * @returns The full directory path
 */
export async function ensureImageDirectory(questionId: string | number): Promise<string> {
  const questionDir = path.join(UPLOADS_BASE, questionId.toString());

  if (!existsSync(questionDir)) {
    await fs.mkdir(questionDir, { recursive: true });
  }

  return questionDir;
}

/**
 * Gets the relative path for an image
 * @param questionId The question ID
 * @param index The image index
 * @param extension The file extension (default: 'png')
 * @returns The relative path from project root
 */
export function getImagePath(
  questionId: string | number,
  index: number,
  extension: string = 'png'
): string {
  return `uploads/images/questions/${questionId}/image_${index}.${extension}`;
}

/**
 * Converts a base64 string to a Buffer and detects the image format
 * @param base64String The base64 encoded image
 * @returns Object containing buffer and detected extension
 */
function decodeBase64Image(base64String: string): { buffer: Buffer; extension: string } {
  // Remove data URI prefix if present (e.g., "data:image/png;base64,")
  const matches = base64String.match(/^data:image\/(\w+);base64,(.+)$/);

  let imageData: string;
  let extension: string;

  if (matches) {
    // Extract format and data from data URI
    extension = matches[1].toLowerCase();
    imageData = matches[2];
  } else {
    // Assume raw base64 string, detect format from magic bytes
    imageData = base64String;
    const buffer = Buffer.from(imageData, 'base64');
    extension = detectImageFormat(buffer);
  }

  const buffer = Buffer.from(imageData, 'base64');

  return { buffer, extension };
}

/**
 * Detects image format from buffer magic bytes
 * @param buffer The image buffer
 * @returns The detected file extension
 */
function detectImageFormat(buffer: Buffer): string {
  // Check magic bytes
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  } else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpg';
  } else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'gif';
  } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'webp';
  }

  // Default to png if unknown
  return 'png';
}

/**
 * Validates that the buffer is a valid image
 * @param buffer The image buffer
 * @returns True if valid image format
 */
function validateImageBuffer(buffer: Buffer): boolean {
  if (buffer.length === 0) {
    return false;
  }

  // Check if it matches any known image format
  const extension = detectImageFormat(buffer);
  return ['png', 'jpg', 'gif', 'webp'].includes(extension);
}

/**
 * Saves a base64 encoded image to the file system
 * @param base64String The base64 encoded image (with or without data URI prefix)
 * @param questionId The question ID
 * @param index The image index (0, 1, 2, ...)
 * @returns The relative path to the saved image
 * @throws Error if the image is invalid or save fails
 */
export async function saveBase64Image(
  base64String: string,
  questionId: string | number,
  index: number
): Promise<string> {
  try {
    // Decode and detect format
    const { buffer, extension } = decodeBase64Image(base64String);

    // Validate image
    if (!validateImageBuffer(buffer)) {
      throw new Error('Invalid image format or corrupted image data');
    }

    // Check file size (warn if > 5MB, reject if > 10MB)
    const sizeMB = buffer.length / (1024 * 1024);
    if (sizeMB > 10) {
      throw new Error(`Image too large (${sizeMB.toFixed(2)}MB). Maximum size is 10MB.`);
    } else if (sizeMB > 5) {
      console.warn(`⚠ Large image detected (${sizeMB.toFixed(2)}MB) for question ${questionId}, image ${index}`);
    }

    // Ensure directory exists
    await ensureImageDirectory(questionId);

    // Get file path
    const relativePath = getImagePath(questionId, index, extension);
    const absolutePath = path.join(process.cwd(), relativePath);

    // Save image
    await fs.writeFile(absolutePath, buffer);

    console.log(`✓ Saved image: ${relativePath} (${sizeMB.toFixed(2)}MB)`);

    return relativePath;
  } catch (error) {
    console.error(`✗ Failed to save image for question ${questionId}, index ${index}:`, error);
    throw error;
  }
}

/**
 * Deletes all images for a given question
 * @param questionId The question ID
 * @returns Number of images deleted
 */
export async function deleteQuestionImages(questionId: string | number): Promise<number> {
  try {
    const questionDir = path.join(UPLOADS_BASE, questionId.toString());

    if (!existsSync(questionDir)) {
      return 0; // No images to delete
    }

    // Read directory contents
    const files = await fs.readdir(questionDir);

    // Delete all image files
    let deletedCount = 0;
    for (const file of files) {
      const filePath = path.join(questionDir, file);
      await fs.unlink(filePath);
      deletedCount++;
    }

    // Remove empty directory
    await fs.rmdir(questionDir);

    console.log(`✓ Deleted ${deletedCount} images for question ${questionId}`);

    return deletedCount;
  } catch (error) {
    console.error(`✗ Failed to delete images for question ${questionId}:`, error);
    throw error;
  }
}

/**
 * Checks if an image file exists
 * @param imagePath The relative path to the image
 * @returns True if the image exists
 */
export function imageExists(imagePath: string): boolean {
  const absolutePath = path.join(process.cwd(), imagePath);
  return existsSync(absolutePath);
}

/**
 * Gets the absolute path for an image
 * @param imagePath The relative path to the image
 * @returns The absolute path
 */
export function getAbsoluteImagePath(imagePath: string): string {
  return path.join(process.cwd(), imagePath);
}

/**
 * Validates multiple base64 images before processing
 * @param images Array of base64 image strings
 * @returns Validation results with errors
 */
export function validateImages(images: string[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!images || images.length === 0) {
    return { valid: true, errors: [] }; // No images is valid
  }

  if (images.length > 20) {
    errors.push(`Too many images (${images.length}). Maximum is 20 per question.`);
  }

  for (let i = 0; i < images.length; i++) {
    try {
      const { buffer } = decodeBase64Image(images[i]);

      if (!validateImageBuffer(buffer)) {
        errors.push(`Image ${i}: Invalid format or corrupted data`);
      }

      const sizeMB = buffer.length / (1024 * 1024);
      if (sizeMB > 10) {
        errors.push(`Image ${i}: Too large (${sizeMB.toFixed(2)}MB). Maximum is 10MB.`);
      }
    } catch (error) {
      errors.push(`Image ${i}: Failed to decode - ${error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
