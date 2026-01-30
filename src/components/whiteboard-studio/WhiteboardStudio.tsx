"use client";

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import type { Editor } from 'tldraw';
import { QuestionPanel } from './QuestionPanel';
import { ChatPanel } from './ChatPanel';
import { StudioToolbar } from './StudioToolbar';
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
  const { toast } = useToast();

  // Handle editor mount
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Set initial tool to draw
    editor.setCurrentTool('draw');

    // Update undo/redo state on history change
    const updateHistoryState = () => {
      setCanUndo(editor.getCanUndo());
      setCanRedo(editor.getCanRedo());
    };

    editor.store.listen(updateHistoryState);
    updateHistoryState();
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

      // Use editor.toImage() to get the blob (tldraw v4 API)
      const result = await editor.toImage([...shapeIds], {
        format: 'png',
        quality: 1,
        scale: 2,
        background: true,
        padding: 20,
      });

      if (!result?.blob) return null;

      // Convert blob to base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(result.blob);
      });
    } catch (error) {
      console.error('Error exporting canvas:', error);
      return null;
    }
  }, []);

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

  // Handle chat message from panel
  const handleChatMessage = useCallback((content: string) => {
    onSendMessage(content);
  }, [onSendMessage]);

  // Prevent body scroll when studio is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
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
          style={{ zIndex: 1 }}
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
          isSubmitting={isSubmitting}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </motion.div>
    </AnimatePresence>
  );
}
