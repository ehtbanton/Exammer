"use client";

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import { ReactSketchCanvas, type ReactSketchCanvasRef } from 'react-sketch-canvas';
import { LeftSidebar } from './LeftSidebar';
import { QuestionHeader } from './QuestionHeader';
import { VerticalToolbar, DrawingTool } from './VerticalToolbar';
import { SnippingTool } from './SnippingTool';
import { SnippingMenu } from './SnippingMenu';
import { YouTubeWidget } from './YouTubeWidget';
import { SpotifyWidget } from './SpotifyWidget';
import { FlashcardPanel } from './FlashcardPanel';
import { ResourceViewer, isEmbeddableSite } from './ResourceViewer';
import { WidgetMenu, WidgetType } from './WidgetMenu';
import { overlayVariants, canvasVariants } from './animations';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  // New props for full question page features
  subjectId?: string;
  paperTypeId?: string;
  topicId?: string;
  onFinishQuestion?: () => void;
  currentScore?: number;
  previousScore?: number;
  examQuestionSummary?: string;
  onVoiceMessage?: (role: 'user' | 'assistant', content: string) => void;
  onVoiceEvaluation?: (userAnswer: string) => Promise<void>;
  diagramDescription?: string;
  accessLevel?: number | null;
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
  subjectId,
  paperTypeId,
  topicId,
  onFinishQuestion,
  currentScore = 0,
  previousScore = 0,
  examQuestionSummary = '',
  onVoiceMessage,
  onVoiceEvaluation,
  diagramDescription,
  accessLevel,
}: WhiteboardStudioProps) {
  const canvasRef = useRef<ReactSketchCanvasRef | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSnipping, setIsSnipping] = useState(false);
  const [snipResult, setSnipResult] = useState<{
    imageData: string;
    position: { x: number; y: number };
  } | null>(null);
  const [activeWidgets, setActiveWidgets] = useState<WidgetType[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [showPages, setShowPages] = useState(false);
  const [youtubeInitialUrl, setYoutubeInitialUrl] = useState<string | undefined>();
  const [resourceUrl, setResourceUrl] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawingTool>('draw');
  const [activeColor, setActiveColor] = useState('black');
  const [studioTheme, setStudioTheme] = useState<'light' | 'dark'>('light');
  const { toast } = useToast();

  // Page dimensions (A4 at 96 DPI)
  const PAGE_WIDTH = 794;
  const PAGE_HEIGHT = 1123;

  // Color map for tldraw color names to hex
  const colorMap: Record<string, string> = {
    black: '#000000',
    blue: '#3b82f6',
    red: '#ef4444',
    green: '#22c55e',
    orange: '#f97316',
    violet: '#8b5cf6',
    yellow: '#eab308',
    white: '#ffffff',
    grey: '#6b7280',
  };

  // Export canvas to image
  const exportCanvas = useCallback(async (): Promise<string | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    try {
      const paths = await canvas.exportPaths();
      if (!paths || paths.length === 0) return null;

      const dataUrl = await canvas.exportImage('png');
      if (!dataUrl) return null;

      return dataUrl;
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
      canvasRef.current?.clearCanvas();
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
    canvasRef.current?.clearCanvas();
  }, []);

  // Handle undo/redo
  const handleUndo = useCallback(() => { canvasRef.current?.undo(); }, []);
  const handleRedo = useCallback(() => { canvasRef.current?.redo(); }, []);

  // Handle tool change from vertical toolbar
  const handleToolChange = useCallback((tool: DrawingTool) => {
    setActiveTool(tool);
    if (tool === 'eraser') {
      canvasRef.current?.eraseMode(true);
    } else {
      canvasRef.current?.eraseMode(false);
    }
  }, []);

  // Handle color change from vertical toolbar
  const handleColorChange = useCallback((color: string) => {
    setActiveColor(color);
    setStrokeColor(colorMap[color] || color);
  }, [colorMap]);

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

    try {
      // Export full canvas and crop to selection
      const dataUrl = await canvasRef.current?.exportImage('png');
      if (!dataUrl) {
        toast({ title: "No content to capture", variant: "destructive" });
        return;
      }

      setSnipResult({
        imageData: dataUrl,
        position: { x: bounds.x + bounds.width + 20, y: bounds.y },
      });
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

  // Theme toggle handler
  const handleToggleTheme = useCallback(() => {
    setStudioTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 studio-theme"
        data-theme={studioTheme}
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
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
            onExit={onExit}
            onFinishQuestion={onFinishQuestion}
            currentScore={currentScore}
            previousScore={previousScore}
            examQuestionSummary={examQuestionSummary}
            onVoiceMessage={onVoiceMessage}
            onVoiceEvaluation={onVoiceEvaluation}
            diagramDescription={diagramDescription}
            accessLevel={accessLevel}
            onSubmitCanvas={handleSubmit}
            isSubmittingCanvas={isSubmitting}
          />

          {/* Canvas Area */}
          <main className="flex-1 flex flex-col bg-[var(--s-canvas)]">
            {/* Question Header - Always Visible */}
            <QuestionHeader
              questionText={questionText}
              objectives={objectives}
              completedObjectives={completedObjectives}
              diagramDescription={diagramDescription}
            />

            {/* tldraw Canvas */}
            <div className="flex-1 relative">
              <motion.div
                className="absolute inset-0"
                variants={canvasVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <ReactSketchCanvas
                  ref={canvasRef}
                  strokeWidth={3}
                  strokeColor={strokeColor}
                  canvasColor={studioTheme === 'dark' ? '#2c2c2e' : '#ffffff'}
                  eraserWidth={20}
                  style={{ border: 'none' }}
                  onChange={() => {
                    setCanUndo(true);
                  }}
                />
              </motion.div>

            {/* Grid Overlay */}
            {showGrid && (
              <div
                className="absolute inset-0 pointer-events-none z-[5]"
                style={{
                  backgroundImage: studioTheme === 'dark'
                    ? `linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
                       linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)`
                    : `linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px),
                       linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)`,
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
                <div className="absolute -top-6 left-0 text-xs text-[var(--s-text-muted)] bg-[var(--s-surface-solid)] px-2 py-0.5 rounded">
                  A4 Page
                </div>
              </div>
            )}

            {/* Bottom Canvas Bar: Widgets + Submit */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[10] flex items-center gap-3">
              {/* Widgets Pill */}
              <WidgetMenu onAddWidget={handleAddWidget} activeWidgets={activeWidgets} />

              {/* Submit Answer Button */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5",
                  "bg-[var(--s-accent)] hover:bg-[var(--s-accent-hover)] text-white",
                  "rounded-xl font-medium text-[13px]",
                  "[box-shadow:0_2px_8px_var(--s-accent-glow),0_1px_3px_rgba(0,0,0,0.08)]",
                  "hover:[box-shadow:0_4px_14px_var(--s-accent-glow-hover),0_2px_4px_rgba(0,0,0,0.08)]",
                  "hover:-translate-y-px",
                  "transition-all duration-200",
                  isSubmitting && "opacity-60 cursor-not-allowed hover:translate-y-0"
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
            </div>
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
            studioTheme={studioTheme}
            onToggleTheme={handleToggleTheme}
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
