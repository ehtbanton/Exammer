"use client";

import { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import type { DiagramType, DiagramStyle, DiagramDetailedData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { generateDiagramImage } from '@/ai/flows/generate-diagram-image';

interface HybridDiagramRendererProps {
  // Mermaid diagram
  mermaidCode?: string;

  // Imagen diagram
  imageUri?: string;

  // Diagram metadata
  diagramType?: DiagramType | null;
  aspectRatio?: string;
  style?: DiagramStyle;

  // Detailed diagram data for accurate generation
  detailedData?: DiagramDetailedData | null;

  // Fallback options
  enableFallback?: boolean; // If true, will try Imagen if Mermaid fails
  diagramDescription?: string; // Description for Imagen fallback
  subject?: string; // Subject context for better Imagen generation

  // Force Imagen-only mode (skips Mermaid entirely)
  forceImagen?: boolean; // If true, always use Imagen instead of Mermaid

  // Styling
  className?: string;
}

export function HybridDiagramRenderer({
  mermaidCode,
  imageUri,
  diagramType,
  aspectRatio,
  style,
  detailedData,
  enableFallback = true,
  diagramDescription,
  subject,
  forceImagen = false,
  className = '',
}: HybridDiagramRendererProps) {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingFallback, setIsGeneratingFallback] = useState(false);
  const [fallbackImageUri, setFallbackImageUri] = useState<string | null>(null);
  const [renderAttempt, setRenderAttempt] = useState(0);

  // Determine which diagram to render
  // If forceImagen is true, always prefer Imagen
  const shouldRenderMermaid = !forceImagen && (diagramType === 'mermaid' || (!diagramType && mermaidCode));
  const shouldRenderImagen = forceImagen || diagramType === 'imagen' || imageUri || fallbackImageUri;

  // Render Mermaid diagram
  useEffect(() => {
    if (!shouldRenderMermaid || !mermaidCode) return;

    const renderDiagram = async () => {
      if (!mermaidRef.current) return;

      try {
        setError(null);
        // Generate a unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

        // Clear previous content
        mermaidRef.current.innerHTML = '';

        // Render the diagram
        const { svg } = await mermaid.render(id, mermaidCode);
        mermaidRef.current.innerHTML = svg;
      } catch (err: any) {
        console.error('Mermaid rendering error:', err);
        const errorMessage = err?.message || 'Failed to render diagram';
        setError(errorMessage);

        // Attempt fallback to Imagen if enabled
        if (enableFallback && diagramDescription && !fallbackImageUri) {
          console.log('[HybridDiagram] Mermaid failed, attempting Imagen fallback...');
          attemptImagenFallback();
        }
      }
    };

    renderDiagram();
  }, [mermaidCode, shouldRenderMermaid, renderAttempt]);

  // Auto-generate Imagen when forceImagen is true
  useEffect(() => {
    if (forceImagen && diagramDescription && !imageUri && !fallbackImageUri && !isGeneratingFallback) {
      console.log('[HybridDiagram] Force Imagen mode - auto-generating image...');
      attemptImagenFallback();
    }
  }, [forceImagen, diagramDescription, imageUri, fallbackImageUri]);

  // Attempt to generate diagram using Imagen as fallback
  const attemptImagenFallback = async () => {
    if (!diagramDescription && !detailedData) {
      console.warn('[HybridDiagram] Cannot generate fallback - no description or detailed data provided');
      return;
    }

    setIsGeneratingFallback(true);

    try {
      const result = await generateDiagramImage({
        description: diagramDescription || 'Diagram',
        aspectRatio: aspectRatio as any,
        style: style,
        subject: subject,
        detailedData: detailedData, // Pass detailed data for accurate generation
      });

      setFallbackImageUri(result.imageDataUri);
      setError(null);
      console.log('[HybridDiagram] Imagen fallback generated successfully');
    } catch (err: any) {
      console.error('[HybridDiagram] Imagen fallback failed:', err);
      setError(`Both Mermaid and Imagen rendering failed. ${err.message}`);
    } finally {
      setIsGeneratingFallback(false);
    }
  };

  // Retry rendering
  const handleRetry = () => {
    setError(null);
    setFallbackImageUri(null);
    setRenderAttempt(prev => prev + 1);
  };

  // Render error state with retry option
  if (error && !isGeneratingFallback && !fallbackImageUri) {
    return (
      <div className={`p-4 bg-destructive/10 border border-destructive/20 rounded-lg ${className}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive mb-2">
              Diagram rendering failed
            </p>
            <p className="text-xs text-muted-foreground mb-3">{error}</p>
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="h-8"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render loading state for fallback generation
  if (isGeneratingFallback) {
    return (
      <div className={`p-8 bg-muted/30 rounded-lg border ${className}`}>
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">
            Generating diagram using AI...
          </p>
        </div>
      </div>
    );
  }

  // Render Imagen diagram
  if (shouldRenderImagen && (imageUri || fallbackImageUri)) {
    const src = fallbackImageUri || imageUri;
    return (
      <div className={`flex justify-center items-center p-4 bg-muted/30 rounded-lg border ${className}`}>
        <img
          src={src!}
          alt="Question diagram"
          className="max-w-full h-auto rounded"
          style={{ maxHeight: '500px' }}
        />
      </div>
    );
  }

  // Render Mermaid diagram
  if (shouldRenderMermaid && mermaidCode) {
    return (
      <div
        ref={mermaidRef}
        className={`flex justify-center items-center p-4 bg-muted/30 rounded-lg border ${className}`}
      />
    );
  }

  // No diagram to render
  return null;
}
