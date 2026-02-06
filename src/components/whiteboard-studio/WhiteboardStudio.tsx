"use client";

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { Editor } from 'tldraw';
import { LeftSidebar } from './LeftSidebar';
import { VerticalToolbar, DrawingTool } from './VerticalToolbar';
import { SnippingTool } from './SnippingTool';
import { SnippingMenu } from './SnippingMenu';
import { YouTubeWidget } from './YouTubeWidget';
import { SpotifyWidget } from './SpotifyWidget';
import { FlashcardPanel } from './FlashcardPanel';
import { ResourceViewer, isEmbeddableSite } from './ResourceViewer';
import { WidgetType } from './WidgetMenu';
import { overlayVariants, canvasVariants } from './animations';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Dynamically import tldraw to avoid SSR issues
const Tldraw = dynamic(
  () => import('tldraw').then((mod) => mod.Tldraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-50">
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
  const [showGrid, setShowGrid] = useState(false);
  const [showPages, setShowPages] = useState(false);
  const [youtubeInitialUrl, setYoutubeInitialUrl] = useState<string | undefined>();
  const [resourceUrl, setResourceUrl] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawingTool>('draw');
  const [activeColor, setActiveColor] = useState('black');
  const { toast } = useToast();

  // Page dimensions (A4 at 96 DPI)
  const PAGE_WIDTH = 794;
  const PAGE_HEIGHT = 1123;

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

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const tryCompress = (quality: number) => {
          canvas.toBlob(
            (compressedBlob) => {
              if (!compressedBlob) {
                reject(new Error('Compression failed'));
                return;
              }
              const sizeKB = compressedBlob.size / 1024;
              if (sizeKB <= targetSizeKB || quality <= 0.4) {
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
      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0) return null;

      const result = await editor.toImage([...shapeIds], {
        format: 'jpeg',
        quality: 0.85,
        scale: 1,
        background: true,
        padding: 10,
      });

      if (!result?.blob) return null;

      let finalBlob = result.blob;
      const initialSizeKB = finalBlob.size / 1024;

      if (initialSizeKB > 500) {
        finalBlob = await compressImageBlob(finalBlob, 500);
      }

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
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
  const handleUndo = useCallback(() => { editorRef.current?.undo(); }, []);
  const handleRedo = useCallback(() => { editorRef.current?.redo(); }, []);

  // Handle tool change from vertical toolbar
  const handleToolChange = useCallback((tool: DrawingTool) => {
    const editor = editorRef.current;
    if (!editor) return;

    setActiveTool(tool);
    editor.setCurrentTool(tool);
  }, []);

  // Handle color change from vertical toolbar
  const handleColorChange = useCallback((color: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    setActiveColor(color);
    // tldraw uses DefaultColorStyle for setting drawing color
    try {
      const { DefaultColorStyle } = require('tldraw');
      editor.setStyleForNextShapes(DefaultColorStyle, color);
    } catch {
      // Fallback if import fails
      console.warn('Could not set color style');
    }
  }, []);

  // Handle chat message from sidebar
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
      const allShapes = editor.getCurrentPageShapes();
      const selectedShapeIds = allShapes
        .filter(shape => {
          const shapeBounds = editor.getShapePageBounds(shape.id);
          if (!shapeBounds) return false;
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

      const result = await editor.toImage(selectedShapeIds, {
        format: 'png',
        quality: 1,
        scale: 2,
        background: true,
        padding: 10,
      });

      if (!result?.blob) {
        toast({ title: "Failed to capture", variant: "destructive" });
        return;
      }

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
      toast({ title: "Snip failed", variant: "destructive" });
    }
  }, [toast]);

  const handleSnipMenuClose = useCallback(() => { setSnipResult(null); }, []);

  const handleAskXamWithSnip = useCallback(async (message: string, imageData: string) => {
    setSnipResult(null);
    toast({ title: "Sending to XAM", description: "XAM is analyzing your selection..." });
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
    if (type === 'youtube') setYoutubeInitialUrl(undefined);
  }, []);

  const handleOpenYouTube = useCallback((url: string) => {
    setYoutubeInitialUrl(url);
    if (!activeWidgets.includes('youtube')) {
      setActiveWidgets(prev => [...prev, 'youtube']);
    }
    toast({ title: "Opening in YouTube widget" });
  }, [activeWidgets, toast]);

  const handleOpenResource = useCallback((url: string) => {
    if (isEmbeddableSite(url)) {
      setResourceUrl(url);
      toast({ title: "Opening resource" });
    } else {
      window.open(url, '_blank');
      toast({ title: "Opening in new tab" });
    }
  }, [toast]);

  const handleCloseResource = useCallback(() => { setResourceUrl(null); }, []);

  const handleToggleGrid = useCallback(() => { setShowGrid(prev => !prev); }, []);
  const handleTogglePages = useCallback(() => { setShowPages(prev => !prev); }, []);

  // Handle Next Step
  const handleNextStep = useCallback(() => {
    const incompleteIndex = objectives.findIndex(
      (_, idx) => !completedObjectives.includes(idx)
    );
    if (incompleteIndex !== -1) {
      onSendMessage('[NEXT_STEP] Help me with the next step of this question.');
      toast({ title: "Asking XAM for guidance" });
    }
  }, [objectives, completedObjectives, onSendMessage, toast]);

  // Handle Find
  const handleFind = useCallback(() => {
    onSendMessage('Find me some resources, YouTube videos, and articles related to this topic.');
    toast({ title: "Finding resources" });
  }, [onSendMessage, toast]);

  // Handle Explain
  const handleExplain = useCallback(async () => {
    const imageData = await exportCanvas();
    if (imageData) {
      onSendMessage('Explain what I have written so far and help me understand it better.', imageData);
      toast({ title: "Explaining your work" });
    } else {
      onSendMessage('Can you explain the current topic in more detail?');
      toast({ title: "Asking for explanation" });
    }
  }, [exportCanvas, onSendMessage, toast]);

  // Handle Check
  const handleCheck = useCallback(async () => {
    const imageData = await exportCanvas();
    if (imageData) {
      onSendMessage('Check my work and verify if my answer is correct.', imageData);
      toast({ title: "Checking your work" });
    } else {
      toast({
        title: "Nothing to check",
        description: "Draw something on the canvas first",
        variant: "destructive",
      });
    }
  }, [exportCanvas, onSendMessage, toast]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 studio-theme"
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div className="flex h-full">
          {/* Left Sidebar */}
          <LeftSidebar
            questionText={questionText}
            objectives={objectives}
            completedObjectives={completedObjectives}
            messages={chatHistory}
            onSendMessage={handleChatMessage}
            isLoading={isLoading}
            onOpenYouTube={handleOpenYouTube}
            onOpenResource={handleOpenResource}
            onNextStep={handleNextStep}
            onFind={handleFind}
            onExplain={handleExplain}
            onCheck={handleCheck}
            hasIncompleteObjectives={completedObjectives.length < objectives.length}
            onAddWidget={handleAddWidget}
            activeWidgets={activeWidgets}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
            onExit={onExit}
          />

          {/* Canvas Area */}
          <main className="flex-1 relative bg-gray-50">
            {/* tldraw Canvas */}
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
                hideUi
              />
            </motion.div>

            {/* Grid Overlay */}
            {showGrid && (
              <div
                className="absolute inset-0 pointer-events-none z-[5]"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)
                  `,
                  backgroundSize: '25px 25px',
                }}
              />
            )}

            {/* Page Boundary Overlay */}
            {showPages && (
              <div
                className="absolute pointer-events-none z-[6]"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: PAGE_WIDTH,
                  height: PAGE_HEIGHT,
                  border: '2px dashed rgba(100, 100, 100, 0.3)',
                  borderRadius: '4px',
                }}
              >
                <div className="absolute -top-6 left-0 text-xs text-gray-400 bg-white px-2 py-0.5 rounded">
                  A4 Page
                </div>
              </div>
            )}

            {/* Submit Answer Button (bottom center of canvas) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[10]">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5",
                  "bg-blue-600 hover:bg-blue-700 text-white",
                  "rounded-xl shadow-md font-medium text-sm",
                  "transition-colors",
                  isSubmitting && "opacity-70 cursor-not-allowed"
                )}
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? 'Sending...' : 'Submit Answer'}
              </button>
            </div>

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
          </main>

          {/* Right Vertical Toolbar */}
          <VerticalToolbar
            activeTool={activeTool}
            onToolChange={handleToolChange}
            activeColor={activeColor}
            onColorChange={handleColorChange}
            onSnip={handleSnipStart}
            isSnipping={isSnipping}
            onToggleGrid={handleToggleGrid}
            showGrid={showGrid}
            onTogglePages={handleTogglePages}
            showPages={showPages}
            onClear={handleClear}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </div>

        {/* Floating Media Widgets */}
        <AnimatePresence>
          {activeWidgets.includes('youtube') && (
            <YouTubeWidget
              key="youtube"
              defaultPosition={{ x: 500, y: 70 }}
              initialUrl={youtubeInitialUrl}
              onClose={() => handleRemoveWidget('youtube')}
            />
          )}
          {activeWidgets.includes('spotify') && (
            <SpotifyWidget
              key="spotify"
              defaultPosition={{ x: 500, y: 400 }}
              onClose={() => handleRemoveWidget('spotify')}
            />
          )}
          {resourceUrl && (
            <ResourceViewer
              key="resource"
              defaultPosition={{ x: 400, y: 100 }}
              url={resourceUrl}
              onClose={handleCloseResource}
            />
          )}
          {activeWidgets.includes('flashcards') && (
            <FlashcardPanel
              key="flashcards"
              defaultPosition={{ x: 500, y: 70 }}
              onClose={() => handleRemoveWidget('flashcards')}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
