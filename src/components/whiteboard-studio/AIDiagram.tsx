"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { generateDiagramImage } from '@/ai/flows/generate-diagram-image';

interface AIDiagramProps {
  description: string;
}

export function AIDiagram({ description }: AIDiagramProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const generateImage = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const result = await generateDiagramImage({
          description: description,
          aspectRatio: '4:3',
        });

        setImageUrl(result.imageDataUri);
      } catch (err: any) {
        console.error('Diagram generation error:', err);
        setError(err?.message || 'Failed to generate diagram');
      } finally {
        setIsLoading(false);
      }
    };

    generateImage();
  }, [description]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-6 bg-[var(--s-card)] rounded-xl">
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--s-text-muted)]" />
          <p className="text-[12px] text-[var(--s-text-muted)]">Generating diagram...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-[var(--s-icon-blue-bg)] rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-4 w-4 text-[var(--s-icon-blue)]" />
          <p className="text-[12px] font-semibold text-[var(--s-icon-blue)]">Diagram Description</p>
        </div>
        <p className="text-[12px] text-[var(--s-text-secondary)] whitespace-pre-wrap">{description}</p>
      </div>
    );
  }

  if (!imageUrl) {
    return null;
  }

  return (
    <div className="flex justify-center items-center p-4 bg-[var(--s-card)] rounded-xl">
      <img
        src={imageUrl}
        alt="Generated diagram"
        className="max-w-full h-auto rounded-lg"
      />
    </div>
  );
}
