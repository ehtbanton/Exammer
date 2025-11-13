import { useState, useCallback } from 'react';
import html2canvas from 'html2canvas';

export interface ScreenshotOptions {
  quality?: number;
  removeElements?: string[]; // CSS selectors of elements to hide
}

export function useScreenshot() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const captureScreenshot = useCallback(async (options: ScreenshotOptions = {}) => {
    setIsCapturing(true);
    setError(null);

    try {
      const { quality = 0.8, removeElements = [] } = options;

      // Store original display values of elements to remove
      const elementsToHide: { element: HTMLElement; originalDisplay: string }[] = [];

      // Hide specified elements
      removeElements.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          elementsToHide.push({
            element: htmlEl,
            originalDisplay: htmlEl.style.display,
          });
          htmlEl.style.display = 'none';
        });
      });

      // Capture screenshot
      const canvas = await html2canvas(document.body, {
        allowTaint: true,
        useCORS: true,
        logging: false,
        scale: 1, // Use device pixel ratio for better quality
        backgroundColor: null, // Transparent background
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });

      // Restore hidden elements
      elementsToHide.forEach(({ element, originalDisplay }) => {
        element.style.display = originalDisplay;
      });

      // Convert canvas to base64 image
      const imageData = canvas.toDataURL('image/png', quality);
      setScreenshot(imageData);

      return imageData;
    } catch (err) {
      console.error('Screenshot capture failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to capture screenshot');
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const clearScreenshot = useCallback(() => {
    setScreenshot(null);
    setError(null);
  }, []);

  return {
    screenshot,
    isCapturing,
    error,
    captureScreenshot,
    clearScreenshot,
  };
}
