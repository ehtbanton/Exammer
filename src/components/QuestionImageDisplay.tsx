'use client';

/**
 * QuestionImageDisplay Component
 *
 * Displays images extracted from exam papers at their correct positions
 * within the question text based on position markers.
 */

import React, { useState } from 'react';
import Image from 'next/image';
import type { QuestionImage } from '@/lib/types';

interface QuestionImageDisplayProps {
  images: QuestionImage[];
  questionText: string;
  className?: string;
}

/**
 * Component to display images at correct positions in a question
 */
export function QuestionImageDisplay({ images, questionText, className = '' }: QuestionImageDisplayProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Handle image load error
  const handleImageError = (imagePath: string) => {
    setImageErrors(prev => new Set(prev).add(imagePath));
    console.error(`Failed to load image: ${imagePath}`);
  };

  // Filter out images that failed to load
  const validImages = images.filter(img => !imageErrors.has(img.imagePath));

  if (validImages.length === 0) {
    return null; // No images to display
  }

  // Group images by position marker
  const imagesByPosition: { [key: string]: QuestionImage[] } = {};
  validImages.forEach(img => {
    const position = img.positionMarker || 'before_question';
    if (!imagesByPosition[position]) {
      imagesByPosition[position] = [];
    }
    imagesByPosition[position].push(img);
  });

  // Sort images within each position by orderIndex
  Object.keys(imagesByPosition).forEach(pos => {
    imagesByPosition[pos].sort((a, b) => a.orderIndex - b.orderIndex);
  });

  // Render a single image
  const renderImage = (img: QuestionImage, index: number) => (
    <div
      key={`${img.id}-${index}`}
      className="my-4 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => setSelectedImage(img.imagePath)}
    >
      <div className="relative w-full" style={{ minHeight: '200px' }}>
        <Image
          src={`/${img.imagePath}`}
          alt={`Question diagram ${img.orderIndex + 1}`}
          width={800}
          height={600}
          className="w-full h-auto object-contain"
          onError={() => handleImageError(img.imagePath)}
          priority={img.orderIndex === 0} // Prioritize first image
        />
      </div>
      <div className="px-3 py-2 bg-gray-50 text-xs text-gray-600 flex justify-between items-center">
        <span>Diagram {img.orderIndex + 1}</span>
        <span className="text-gray-400">{img.positionMarker?.replace(/_/g, ' ')}</span>
      </div>
    </div>
  );

  // Render images for a specific position
  const renderImagesAtPosition = (position: string) => {
    const imgs = imagesByPosition[position];
    if (!imgs || imgs.length === 0) return null;

    return (
      <div className="images-container">
        {imgs.map((img, idx) => renderImage(img, idx))}
      </div>
    );
  };

  return (
    <>
      <div className={`question-images ${className}`}>
        {/* Images before question */}
        {renderImagesAtPosition('before_question')}

        {/* Question text with inline images */}
        <div className="question-text-with-images">
          {/* For now, render all inline images after the text */}
          {/* In a more sophisticated version, we could parse the text and insert images at specific points */}
          {Object.keys(imagesByPosition).map(position => {
            if (position !== 'before_question' && position !== 'after_question') {
              return (
                <div key={position} className="inline-images my-2">
                  {renderImagesAtPosition(position)}
                </div>
              );
            }
            return null;
          })}
        </div>

        {/* Images after question */}
        {renderImagesAtPosition('after_question')}
      </div>

      {/* Full-screen image viewer */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70 transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
            <Image
              src={`/${selectedImage}`}
              alt="Full size diagram"
              width={1600}
              height={1200}
              className="max-w-full max-h-screen object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Simple component to display images without position parsing
 * Use this when you just want to show all images in sequence
 */
export function SimpleImageDisplay({ images, className = '' }: { images: QuestionImage[]; className?: string }) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const validImages = images.filter(img => !imageErrors.has(img.imagePath));

  if (validImages.length === 0) {
    return null;
  }

  return (
    <>
      <div className={`space-y-4 ${className}`}>
        {validImages.map((img, index) => (
          <div
            key={img.id}
            className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedImage(img.imagePath)}
          >
            <div className="relative w-full" style={{ minHeight: '200px' }}>
              <Image
                src={`/${img.imagePath}`}
                alt={`Diagram ${index + 1}`}
                width={800}
                height={600}
                className="w-full h-auto object-contain"
                onError={() => setImageErrors(prev => new Set(prev).add(img.imagePath))}
                priority={index === 0}
              />
            </div>
            <div className="px-3 py-2 bg-gray-50 text-xs text-gray-600">
              Diagram {index + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Full-screen image viewer */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70 transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
            <Image
              src={`/${selectedImage}`}
              alt="Full size diagram"
              width={1600}
              height={1200}
              className="max-w-full max-h-screen object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
