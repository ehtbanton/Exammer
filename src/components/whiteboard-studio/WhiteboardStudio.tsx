"use client";

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import type { Editor } from 'tldraw';
import { QuestionPanel } from './QuestionPanel';
import { ChatPanel } from './ChatPanel';
import { StudioToolbar } from './StudioToolbar';
import { SnippingTool } from './SnippingTool';
import { SnippingMenu } from './SnippingMenu';
import { YouTubeWidget } from './YouTubeWidget';
import { SpotifyWidget } from './SpotifyWidget';
import { FlashcardPanel } from './FlashcardPanel';
import { WidgetType } from './WidgetMenu';
import { overlayVariants, canvasVariants } from './animations';
import { useToast } from '@/hooks/use-toast';

// Dynamically import tldraw to avoid SSR issues
const Tldraw = dynamic(
  () => import('tldraw').then((mod) => mod.Tldraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-950">
        <div className="text-gray-400">Loading canvas...</div>
      </div>
    ),
  }
);

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

interface WhiteboardStudioProps {
  questionId: string;
  questionText: string;
  objectives: string[];
  chatHistory: ChatMessage[];
  completedObjectives: number[];
  onSendMessage: (content: string, imageData?: string) => Promise<void>;
  onExit: () => void;
  isLoading?: boolean;
}

export function WhiteboardStudio({
  questionId,
  questionText,
  objectives,
  chatHistory,
  completedObjectives,
  onSendMessage,
  onExit,
  isLoading = false,
}: WhiteboardStudioProps) {
  const editorRef = useRef<Editor | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSnipping, setIsSnipping] = useState(false);
  const [snipResult, setSnipResult] = useState<{
    imageData: string;
    position: { x: number; y: number };
  } | null>(null);
  const [activeWidgets, setActiveWidgets] = useState<WidgetType[]>([]);
  const { toast } = useToast();

  // Handle editor mount
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Set initial tool to draw
    editor.setCurrentTool('draw');

    // Update undo/redo state
    const updateState = () => {
      setCanUndo(editor.getCanUndo());
      setCanRedo(editor.getCanRedo());
    };

    editor.store.listen(updateState);
    updateState();
  }, []);

  // Helper function to compress image blob if too large
  const compressImageBlob = useCallback(async (blob: Blob, targetSizeKB: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');

        // Calculate scaled dimensions if needed (max 1024px)
        let { width, height } = img;
        const maxDim = 1024;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // White background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Try progressively lower quality until under target size
        const tryCompress = (quality: number) => {
          canvas.toBlob(
            (compressedBlob) => {
              if (!compressedBlob) {
                reject(new Error('Compression failed'));
                return;
              }

              const sizeKB = compressedBlob.size / 1024;
              if (sizeKB <= targetSizeKB || quality <= 0.4) {
                console.log(`Compressed to ${sizeKB.toFixed(0)}KB at quality ${quality}`);
                resolve(compressedBlob);
              } else {
                tryCompress(quality - 0.1);
              }
            },
            'image/jpeg',
            quality
          );
        };

        tryCompress(0.8);
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = URL.createObjectURL(blob);
    });
  }, []);

  // Export canvas to image
  const exportCanvas = useCallback(async (): Promise<string | null> => {
    const editor = editorRef.current;
    if (!editor) return null;

    try {
      // Get all shape IDs on the canvas
      const shapeIds = editor.getCurrentPageShapeIds();

      if (shapeIds.size === 0) {
        return null; // No shapes to export
      }

      // Optimized export settings for smaller file size
      const result = await editor.toImage([...shapeIds], {
        format: 'jpeg',      // Lossy format = much smaller
        quality: 0.85,       // Good quality/size balance
        scale: 1,            // 1x scale is sufficient for AI analysis
        background: true,
        padding: 10,
      });

      if (!result?.blob) return null;

      let finalBlob = result.blob;
      const initialSizeKB = finalBlob.size / 1024;
      console.log(`Initial export size: ${initialSizeKB.toFixed(0)}KB`);

      // If still too large (>500KB), compress further
      if (initialSizeKB > 500) {
        console.log(`Image too large, compressing...`);
        finalBlob = await compressImageBlob(finalBlob, 500);
      }

      // Convert blob to base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(finalBlob);
      });
    } catch (error) {
      console.error('Error exporting canvas:', error);
      return null;
    }
  }, [compressImageBlob]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const imageData = await exportCanvas();
      if (!imageData) {
        toast({
          title: "Nothing to submit",
          description: "Draw something on the canvas first",
          variant: "destructive",
        });
        return;
      }

      await onSendMessage('', imageData);
      toast({
        title: "Answer submitted",
        description: "XAM is analyzing your work...",
      });
      // Clear canvas after successful submit
      editorRef.current?.selectAll();
      editorRef.current?.deleteShapes(editorRef.current.getSelectedShapeIds());
    } catch (error) {
      toast({
        title: "Submission failed",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [exportCanvas, onSendMessage, toast]);

  // Handle clear
  const handleClear = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.selectAll();
      editor.deleteShapes(editor.getSelectedShapeIds());
    }
  }, []);

  // Handle undo/redo
  const handleUndo = useCallback(() => {
    editorRef.current?.undo();
  }, []);

  const handleRedo = useCallback(() => {
    editorRef.current?.redo();
  }, []);

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    editorRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    editorRef.current?.zoomOut();
  }, []);

  const handleResetZoom = useCallback(() => {
    editorRef.current?.resetZoom();
  }, []);

  // Handle label image - switches to text tool so user can add a label
  const handleLabelImage = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Switch to text tool so user can click to add text
    editor.setCurrentTool('text');

    toast({
      title: "Text tool selected",
      description: "Click anywhere to add a label, then select both and group with Ctrl+G",
    });
  }, [toast]);

  // Handle chat message from panel
  const handleChatMessage = useCallback((content: string) => {
    onSendMessage(content);
  }, [onSendMessage]);

  // Handle snipping tool
  const handleSnipStart = useCallback(() => {
    setIsSnipping(true);
  }, []);

  const handleSnipCancel = useCallback(() => {
    setIsSnipping(false);
  }, []);

  const handleSnipComplete = useCallback(async (bounds: { x: number; y: number; width: number; height: number }) => {
    setIsSnipping(false);
    const editor = editorRef.current;
    if (!editor) return;

    try {
      // Get all shapes that intersect with the selection bounds
      const allShapes = editor.getCurrentPageShapes();
      const selectedShapeIds = allShapes
        .filter(shape => {
          const shapeBounds = editor.getShapePageBounds(shape.id);
          if (!shapeBounds) return false;
          // Check if shape intersects with selection
          return (
            shapeBounds.x < bounds.x + bounds.width &&
            shapeBounds.x + shapeBounds.width > bounds.x &&
            shapeBounds.y < bounds.y + bounds.height &&
            shapeBounds.y + shapeBounds.height > bounds.y
          );
        })
        .map(shape => shape.id);

      if (selectedShapeIds.length === 0) {
        toast({
          title: "No content selected",
          description: "Draw something first, then snip it",
          variant: "destructive",
        });
        return;
      }

      // Export the selected area
      const result = await editor.toImage(selectedShapeIds, {
        format: 'png',
        quality: 1,
        scale: 2,
        background: true,
        padding: 10,
      });

      if (!result?.blob) {
        toast({
          title: "Failed to capture",
          description: "Could not capture selection",
          variant: "destructive",
        });
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setSnipResult({
          imageData: reader.result as string,
          position: { x: bounds.x + bounds.width + 20, y: bounds.y },
        });
      };
      reader.readAsDataURL(result.blob);
    } catch (error) {
      console.error('Snip error:', error);
      toast({
        title: "Snip failed",
        description: "Could not capture selection",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleSnipMenuClose = useCallback(() => {
    setSnipResult(null);
  }, []);

  const handleAskXamWithSnip = useCallback(async (message: string, imageData: string) => {
    setSnipResult(null);
    toast({
      title: "Sending to XAM",
      description: "XAM is analyzing your selection...",
    });
    await onSendMessage(message, imageData);
  }, [onSendMessage, toast]);

  // Handle widget add/remove
  const handleAddWidget = useCallback((type: WidgetType) => {
    if (!activeWidgets.includes(type)) {
      setActiveWidgets(prev => [...prev, type]);
    }
  }, [activeWidgets]);

  const handleRemoveWidget = useCallback((type: WidgetType) => {
    setActiveWidgets(prev => prev.filter(w => w !== type));
  }, []);

  // Prevent body scroll and boost tldraw menu z-index
  useEffect(() => {
    document.body.style.overflow = 'hidden';

    // Add style to make tldraw menus appear above floating panels
    const style = document.createElement('style');
    style.id = 'whiteboard-studio-styles';
    style.textContent = `
      /* Boost all tldraw UI elements above floating panels */
      .tl-container [data-radix-popper-content-wrapper],
      .tl-container [data-radix-menu-content],
      [data-radix-popper-content-wrapper],
      [data-radix-menu-content],
      .tlui-popover,
      .tlui-menu,
      .tlui-dialog,
      .tlui-dropdown,
      .tlui-menu__content,
      .tlui-popover__content {
        z-index: 9999 !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.body.style.overflow = '';
      const existingStyle = document.getElementById('whiteboard-studio-styles');
      if (existingStyle) existingStyle.remove();
    };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50"
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Background */}
        <div className="absolute inset-0 bg-gray-50 dark:bg-gray-950" />

        {/* Canvas Container */}
        <motion.div
          className="absolute inset-0"
          variants={canvasVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <Tldraw
            onMount={handleMount}
            persistenceKey={`whiteboard-${questionId}`}
            autoFocus
          />
        </motion.div>

        {/* Question Panel (top-left) */}
        <QuestionPanel
          questionText={questionText}
          objectives={objectives}
          completedObjectives={completedObjectives}
          defaultPosition={{ x: 20, y: 70 }}
        />

        {/* Chat Panel (top-right) */}
        <ChatPanel
          messages={chatHistory}
          onSendMessage={handleChatMessage}
          isLoading={isLoading}
        />

        {/* Bottom Toolbar */}
        <StudioToolbar
          onExit={onExit}
          onSubmit={handleSubmit}
          onClear={handleClear}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onLabelImage={handleLabelImage}
          onSnip={handleSnipStart}
          onAddWidget={handleAddWidget}
          activeWidgets={activeWidgets}
          isSubmitting={isSubmitting}
          isSnipping={isSnipping}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        {/* Snipping Tool Overlay */}
        <AnimatePresence>
          {isSnipping && (
            <SnippingTool
              isActive={isSnipping}
              onSelectionComplete={handleSnipComplete}
              onCancel={handleSnipCancel}
            />
          )}
        </AnimatePresence>

        {/* Snipping Menu */}
        <SnippingMenu
          isOpen={!!snipResult}
          imageData={snipResult?.imageData || null}
          position={snipResult?.position || { x: 0, y: 0 }}
          onClose={handleSnipMenuClose}
          onAskXam={handleAskXamWithSnip}
        />

        {/* Media Widgets */}
        <AnimatePresence>
          {activeWidgets.includes('youtube') && (
            <YouTubeWidget
              key="youtube"
              defaultPosition={{ x: 800, y: 70 }}
              onClose={() => handleRemoveWidget('youtube')}
            />
          )}
          {activeWidgets.includes('spotify') && (
            <SpotifyWidget
              key="spotify"
              defaultPosition={{ x: 800, y: 400 }}
              onClose={() => handleRemoveWidget('spotify')}
            />
          )}
          {activeWidgets.includes('flashcards') && (
            <FlashcardPanel
              key="flashcards"
              defaultPosition={{ x: 420, y: 70 }}
              onClose={() => handleRemoveWidget('flashcards')}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
