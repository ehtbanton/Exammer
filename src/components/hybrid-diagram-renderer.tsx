"use client";

import { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import type { DiagramType, DiagramStyle, DiagramDetailedData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { generateDiagramImage } from '@/ai/flows/generate-diagram-image';
import { canRenderAsSVG, renderDiagramAsSVG, svgToDataUri } from '@/lib/diagram-renderer-svg';

interface HybridDiagramRendererProps {
  // Mermaid diagram
  mermaidCode?: string;

  // Original image from PDF (Tier 1 - 100% accurate)
  originalImageUri?: string;

  // Imagen diagram (generated)
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
  originalImageUri,
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
  const [svgDiagramUri, setSvgDiagramUri] = useState<string | null>(null);
  const [renderAttempt, setRenderAttempt] = useState(0);

  // TIERED RENDERING SYSTEM:
  // Tier 1: Original image from PDF (originalImageUri) - 100% accurate, THE ACTUAL DIAGRAM
  // Tier 2: SVG programmatic rendering (detailedData) - Perfect text, mathematically accurate
  // Tier 3: Mermaid (for flowcharts/graphs)
  // Tier 4: Imagen (last resort - poor text rendering)

  // Tier 1: If we have the original image, use it - nothing beats the real thing!
  if (originalImageUri) {
    return (
      <div className={`relative flex justify-center items-center p-4 bg-muted/30 rounded-lg border ${className}`}>
        <img
          src={originalImageUri}
          alt="Original question diagram"
          className="max-w-full h-auto rounded"
          style={{ maxHeight: '500px' }}
        />
        <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
          Original (100%)
        </div>
      </div>
    );
  }

  // Try SVG rendering first if we have detailed data
  useEffect(() => {
    if (detailedData && canRenderAsSVG(detailedData) && !svgDiagramUri) {
      try {
        console.log('[HybridDiagram] Attempting SVG rendering (Tier 2)...');
        const svg = renderDiagramAsSVG(detailedData);
        if (svg) {
          const dataUri = svgToDataUri(svg);
          setSvgDiagramUri(dataUri);
          setError(null);
          console.log('[HybridDiagram] ✓ SVG rendering successful');
        }
      } catch (err: any) {
        console.error('[HybridDiagram] SVG rendering failed:', err);
        // Will fall through to other methods
      }
    }
  }, [detailedData, svgDiagramUri]);

  // Determine which diagram to render
  const shouldRenderSVG = !!svgDiagramUri;
  const shouldRenderMermaid = !shouldRenderSVG && !forceImagen && (diagramType === 'mermaid' || (!diagramType && mermaidCode));
  const shouldRenderImagen = !shouldRenderSVG && (forceImagen || diagramType === 'imagen' || imageUri || fallbackImageUri);

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

  // Auto-generate Imagen when appropriate (Tier 4)
  useEffect(() => {
    // Should auto-generate if:
    // 1. Force Imagen mode is on, OR
    // 2. We have description/data but no other rendering method worked
    const shouldAutoGenerate =
      (forceImagen && diagramDescription) || // Force mode
      (!originalImageUri && !svgDiagramUri && !shouldRenderMermaid && diagramDescription); // Tier 4 fallback

    if (shouldAutoGenerate && !imageUri && !fallbackImageUri && !isGeneratingFallback) {
      console.log('[HybridDiagram] Auto-generating with Imagen (Tier 4)...');
      attemptImagenFallback();
    }
  }, [forceImagen, diagramDescription, imageUri, fallbackImageUri, originalImageUri, svgDiagramUri, shouldRenderMermaid]);

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
    setSvgDiagramUri(null);
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

  // Render SVG diagram (Tier 2 - Perfect text rendering)
  if (shouldRenderSVG && svgDiagramUri) {
    return (
      <div className={`relative flex justify-center items-center p-4 bg-muted/30 rounded-lg border ${className}`}>
        <img
          src={svgDiagramUri}
          alt="Question diagram"
          className="max-w-full h-auto rounded"
          style={{ maxHeight: '500px' }}
        />
      </div>
    );
  }

  // Render Imagen diagram (Tier 4 - Last resort, poor text)
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

  // Render Mermaid diagram (Tier 3 - Good for flowcharts)
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
