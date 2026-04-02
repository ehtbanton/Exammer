"use client";

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, User, Send, Loader2, Youtube, Globe,
  ChevronLeft, ChevronRight as ChevronRightIcon,
  ArrowRight, Search, BookOpen, CheckCircle,
  MessageSquare, Mic, PenTool, ArrowLeft,
  Flag,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LatexRenderer } from '@/components/latex-renderer';
import { ActionCard } from './ActionCard';
import { VoiceInputPanel } from './VoiceInputPanel';
import { sidebarVariants } from './animations';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

type InputMode = 'text' | 'voice' | 'canvas';

interface LeftSidebarProps {
  questionText: string;
  objectives: string[];
  completedObjectives: number[];
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  onOpenYouTube?: (url: string) => void;
  onOpenResource?: (url: string) => void;
  onNextStep: () => void;
  onFind: () => void;
  onExplain: () => void;
  onCheck: () => void;
  hasIncompleteObjectives: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onExit: () => void;
  // New props for full question page features
  onFinishQuestion?: () => void;
  currentScore?: number;
  previousScore?: number;
  examQuestionSummary?: string;
  onVoiceMessage?: (role: 'user' | 'assistant', content: string) => void;
  onVoiceEvaluation?: (userAnswer: string) => Promise<void>;
  diagramDescription?: string;
  accessLevel?: number | null;
  onSubmitCanvas?: () => void;
  isSubmittingCanvas?: boolean;
}

function extractUrls(text: string): { youtubeVideoUrls: string[]; youtubeSearchUrls: string[]; articleUrls: string[] } {
  const urlRegex = /https?:\/\/[^\s<>\[\]"']+/g;
  const urls = text.match(urlRegex) || [];
  const youtubeVideoUrls: string[] = [];
  const youtubeSearchUrls: string[] = [];
  const articleUrls: string[] = [];
  for (const url of urls) {
    const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
    if (cleanUrl.includes('youtube.com/results') || cleanUrl.includes('youtube.com/search')) {
      youtubeSearchUrls.push(cleanUrl);
    } else if (cleanUrl.includes('youtube.com/watch') || cleanUrl.includes('youtu.be/')) {
      youtubeVideoUrls.push(cleanUrl);
    } else {
      articleUrls.push(cleanUrl);
    }
  }
  return { youtubeVideoUrls, youtubeSearchUrls, articleUrls };
}

function stripUrls(text: string): string {
  return text
    .replace(/https?:\/\/[^\s<>\[\]"']+/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

export function LeftSidebar({
  questionText,
  objectives,
  completedObjectives,
  messages,
  onSendMessage,
  isLoading,
  onOpenYouTube,
  onOpenResource,
  onNextStep,
  onFind,
  onExplain,
  onCheck,
  hasIncompleteObjectives,
  isCollapsed,
  onToggleCollapse,
  onExit,
  onFinishQuestion,
  currentScore = 0,
  previousScore = 0,
  examQuestionSummary = '',
  onVoiceMessage,
  onVoiceEvaluation,
  diagramDescription,
  accessLevel,
  onSubmitCanvas,
  isSubmittingCanvas = false,
}: LeftSidebarProps) {
  const [inputValue, setInputValue] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const completedCount = completedObjectives.length;
  const totalCount = objectives.length;

  // Calculate score colors for finish button
  const newScorePercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const getFinishButtonColor = () => {
    if (newScorePercent > previousScore) return 'bg-[var(--s-success)] hover:bg-[var(--s-success)]/90';
    if (newScorePercent < previousScore) return 'bg-[var(--s-danger)] hover:bg-[var(--s-danger)]/90';
    return 'bg-[#ff9500] hover:bg-[#ff9500]/90'; // Amber for unchanged
  };

  const isCompleted = completedCount === totalCount && totalCount > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Collapsed state
  if (isCollapsed) {
    return (
      <motion.div
        initial={{ width: 56 }}
        animate={{ width: 56 }}
        className="h-full bg-[var(--s-surface)] backdrop-blur-xl flex flex-col items-center py-4 gap-2 shrink-0"
      >
        <button
          onClick={onToggleCollapse}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--s-hover)] active:scale-95 transition-all duration-200 text-[var(--s-text-muted)]"
          title="Expand sidebar"
        >
          <ChevronRightIcon className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={onToggleCollapse}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--s-hover)] active:scale-95 transition-all duration-200 text-[var(--s-text-muted)]"
          title="Chat"
        >
          <MessageSquare className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={onToggleCollapse}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--s-hover)] active:scale-95 transition-all duration-200 text-[var(--s-text-muted)]"
          title="Question"
        >
          <BookOpen className="h-[18px] w-[18px]" />
        </button>
        <div className="flex-1" />
        {onFinishQuestion && (
          <button
            onClick={onFinishQuestion}
            disabled={messages.length <= 1}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all duration-200 text-white",
              getFinishButtonColor(),
              messages.length <= 1 && "opacity-50 cursor-not-allowed"
            )}
            title="Finish Question"
          >
            <Flag className="h-[18px] w-[18px]" />
          </button>
        )}
        <button
          onClick={onExit}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--s-hover)] active:scale-95 transition-all duration-200 text-[var(--s-text-muted)]"
          title="Back to Topic"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.aside
      variants={sidebarVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-[360px] h-full bg-[var(--s-surface)] backdrop-blur-xl flex flex-col shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-[13px] text-[var(--s-text-muted)] hover:text-[var(--s-text)] active:scale-95 transition-all duration-200"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Topic</span>
        </button>
        <button
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--s-hover)] active:scale-95 transition-all duration-200 text-[var(--s-text-muted)]"
          title="Collapse sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Finish Question Button */}
      {onFinishQuestion && (
        <div className="px-5 pb-3 shrink-0">
          <button
            onClick={onFinishQuestion}
            disabled={messages.length <= 1}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl",
              "text-[13px] font-semibold text-white transition-all duration-200",
              "[box-shadow:0_2px_8px_rgba(0,0,0,0.15)]",
              getFinishButtonColor(),
              messages.length <= 1 && "opacity-50 cursor-not-allowed"
            )}
          >
            <Flag className="h-4 w-4" />
            Finish Question
          </button>
        </div>
      )}

      {/* AI Greeting (when no messages) */}
      {messages.length === 0 && (
        <div className="px-5 pb-2">
          <div className="bg-[var(--s-card)] backdrop-blur-sm rounded-2xl p-4 [box-shadow:var(--s-shadow-sm)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-[var(--s-surface-solid)] flex items-center justify-center">
                <Bot className="h-4 w-4 text-[var(--s-text-secondary)]" />
              </div>
              <span className="font-headline font-semibold text-[13px] text-[var(--s-text)]">XAM</span>
            </div>
            <p className="text-[13px] text-[var(--s-text-secondary)] leading-relaxed">
              Hi there, how can I assist you today?
            </p>
          </div>
        </div>
      )}

      {/* Action Cards - 2x2 grid */}
      <div className="px-5 py-3 shrink-0">
        <div className="grid grid-cols-2 gap-2.5">
          <ActionCard
            icon={<ArrowRight className="h-4 w-4 text-[var(--s-icon-blue)]" />}
            iconBgColor="bg-[var(--s-icon-blue-bg)]"
            title="Next"
            description="Play the next steps from here"
            onClick={onNextStep}
            disabled={!hasIncompleteObjectives}
          />
          <ActionCard
            icon={<Search className="h-4 w-4 text-[var(--s-danger)]" />}
            iconBgColor="bg-[var(--s-icon-red-bg)]"
            title="Find"
            description="Locate references or similar ideas"
            onClick={onFind}
          />
          <ActionCard
            icon={<BookOpen className="h-4 w-4 text-[#ff9500]" />}
            iconBgColor="bg-[var(--s-icon-orange-bg)]"
            title="Explain"
            description="Break the selection down for me"
            onClick={onExplain}
          />
          <ActionCard
            icon={<CheckCircle className="h-4 w-4 text-[var(--s-success)]" />}
            iconBgColor="bg-[var(--s-icon-green-bg)]"
            title="Check"
            description="Verify the work for me"
            onClick={onCheck}
          />
        </div>
      </div>

      {/* Chat Messages (scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 py-3 studio-scrollbar-hide">
        <div className="space-y-4">
          {messages.map((message, index) => {
            const { youtubeVideoUrls, youtubeSearchUrls, articleUrls } = message.role === 'assistant'
              ? extractUrls(message.content)
              : { youtubeVideoUrls: [], youtubeSearchUrls: [], articleUrls: [] };

            return (
              <div
                key={index}
                className={cn(
                  "flex gap-2.5",
                  message.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-xs",
                      message.role === 'user'
                        ? "bg-[var(--s-accent)] text-white"
                        : "bg-[var(--s-surface-solid)] text-[var(--s-text-secondary)]"
                    )}
                  >
                    {message.role === 'user' ? (
                      <User className="h-3.5 w-3.5" />
                    ) : (
                      <Bot className="h-3.5 w-3.5" />
                    )}
                  </AvatarFallback>
                </Avatar>

                <div className="max-w-[85%] space-y-2">
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                      message.role === 'user'
                        ? "bg-[var(--s-accent)] text-white"
                        : "bg-[var(--s-card)] backdrop-blur-sm text-[var(--s-text-secondary)] [box-shadow:var(--s-shadow-sm)]"
                    )}
                  >
                    {message.imageUrl && (
                      <img
                        src={message.imageUrl}
                        alt="Whiteboard"
                        className="max-w-full rounded-xl mb-2"
                      />
                    )}
                    <LatexRenderer>{message.role === 'assistant' ? stripUrls(message.content) : message.content}</LatexRenderer>
                  </div>

                  {/* URL Action Buttons */}
                  {(youtubeVideoUrls.length > 0 || youtubeSearchUrls.length > 0 || articleUrls.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {youtubeVideoUrls.map((ytUrl, i) => (
                        <button
                          key={`yt-${i}`}
                          className="h-7 px-2.5 text-[11px] gap-1.5 bg-[var(--s-card)] backdrop-blur-sm [box-shadow:var(--s-shadow-sm)] rounded-lg flex items-center text-[var(--s-text-secondary)] hover:bg-[var(--s-card-hover)] hover:[box-shadow:var(--s-shadow-md)] active:scale-95 transition-all duration-200"
                          onClick={() => onOpenYouTube?.(ytUrl)}
                        >
                          <Youtube className="h-3 w-3 text-[var(--s-danger)]" />
                          Video {youtubeVideoUrls.length > 1 ? i + 1 : ''}
                        </button>
                      ))}
                      {youtubeSearchUrls.map((searchUrl, i) => (
                        <button
                          key={`yts-${i}`}
                          className="h-7 px-2.5 text-[11px] gap-1.5 bg-[var(--s-card)] backdrop-blur-sm [box-shadow:var(--s-shadow-sm)] rounded-lg flex items-center text-[var(--s-text-secondary)] hover:bg-[var(--s-card-hover)] hover:[box-shadow:var(--s-shadow-md)] active:scale-95 transition-all duration-200"
                          onClick={() => window.open(searchUrl, '_blank')}
                        >
                          <Youtube className="h-3 w-3 text-[var(--s-danger)]" />
                          Search {youtubeSearchUrls.length > 1 ? i + 1 : ''}
                        </button>
                      ))}
                      {articleUrls.map((artUrl, i) => (
                        <button
                          key={`art-${i}`}
                          className="h-7 px-2.5 text-[11px] gap-1.5 bg-[var(--s-card)] backdrop-blur-sm [box-shadow:var(--s-shadow-sm)] rounded-lg flex items-center text-[var(--s-text-secondary)] hover:bg-[var(--s-card-hover)] hover:[box-shadow:var(--s-shadow-md)] active:scale-95 transition-all duration-200"
                          onClick={() => onOpenResource?.(artUrl)}
                        >
                          <Globe className="h-3 w-3 text-[var(--s-icon-blue)]" />
                          Link {articleUrls.length > 1 ? i + 1 : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-2.5">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-[var(--s-surface-solid)] text-[var(--s-text-secondary)] text-xs">
                  <Bot className="h-3.5 w-3.5" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-[var(--s-card)] backdrop-blur-sm [box-shadow:var(--s-shadow-sm)] rounded-2xl px-3.5 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--s-text-muted)]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Mode Tabs */}
      <div className="px-5 py-4 shrink-0 space-y-3">
        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-[var(--s-card)] p-1 [box-shadow:var(--s-shadow-sm)]">
          <button
            onClick={() => setInputMode('text')}
            disabled={isLoading || isCompleted}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-all duration-200",
              inputMode === 'text'
                ? "bg-[var(--s-surface-solid)] text-[var(--s-text)] [box-shadow:var(--s-shadow-sm)]"
                : "text-[var(--s-text-muted)] hover:text-[var(--s-text)]",
              (isLoading || isCompleted) && "opacity-50 cursor-not-allowed"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Text
          </button>
          <button
            onClick={() => setInputMode('voice')}
            disabled={isLoading || isCompleted || !onVoiceMessage || !onVoiceEvaluation}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-all duration-200",
              inputMode === 'voice'
                ? "bg-[var(--s-surface-solid)] text-[var(--s-text)] [box-shadow:var(--s-shadow-sm)]"
                : "text-[var(--s-text-muted)] hover:text-[var(--s-text)]",
              (isLoading || isCompleted || !onVoiceMessage) && "opacity-50 cursor-not-allowed"
            )}
          >
            <Mic className="h-3.5 w-3.5" />
            Voice
          </button>
          <button
            onClick={() => setInputMode('canvas')}
            disabled={isLoading || isCompleted}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-all duration-200",
              inputMode === 'canvas'
                ? "bg-[var(--s-surface-solid)] text-[var(--s-text)] [box-shadow:var(--s-shadow-sm)]"
                : "text-[var(--s-text-muted)] hover:text-[var(--s-text)]",
              (isLoading || isCompleted) && "opacity-50 cursor-not-allowed"
            )}
          >
            <PenTool className="h-3.5 w-3.5" />
            Canvas
          </button>
        </div>

        {/* Input Content based on mode */}
        {inputMode === 'text' && (
          <div className="flex gap-2.5">
            <div className="flex-1">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                className="text-[13px] h-10 bg-[var(--s-card)] backdrop-blur-sm border-0 [box-shadow:var(--s-shadow-sm)] rounded-xl focus-visible:[box-shadow:var(--s-focus-ring)] focus-visible:ring-0 placeholder:text-[var(--s-text-placeholder)] text-[var(--s-text)]"
                disabled={isLoading || isCompleted}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading || isCompleted}
              className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200",
                "bg-[var(--s-accent)] text-white",
                "[box-shadow:0_1px_3px_var(--s-accent-glow),0_0.5px_1px_rgba(0,0,0,0.08)]",
                "hover:bg-[var(--s-accent-hover)] hover:[box-shadow:0_2px_8px_var(--s-accent-glow-hover)] active:scale-95",
                "disabled:opacity-25 disabled:active:scale-100"
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}

        {inputMode === 'voice' && onVoiceMessage && onVoiceEvaluation && (
          <VoiceInputPanel
            question={questionText}
            solutionObjectives={objectives}
            subsection={examQuestionSummary}
            onAddMessage={onVoiceMessage}
            onEvaluateAnswer={onVoiceEvaluation}
            disabled={isCompleted}
          />
        )}

        {inputMode === 'canvas' && (
          <div className="space-y-2">
            <button
              onClick={onSubmitCanvas}
              disabled={isSubmittingCanvas || isLoading || isCompleted}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
                "text-[13px] font-medium transition-all duration-200",
                "bg-[var(--s-accent)] text-white",
                "[box-shadow:0_2px_8px_var(--s-accent-glow)]",
                "hover:bg-[var(--s-accent-hover)] hover:[box-shadow:0_4px_14px_var(--s-accent-glow-hover)]",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <Send className="h-4 w-4" />
              {isSubmittingCanvas ? 'Submitting...' : 'Submit Canvas'}
            </button>
            <p className="text-[11px] text-[var(--s-text-placeholder)] text-center">
              Draw on the canvas, then submit for XAM to analyze
            </p>
          </div>
        )}
      </div>

    </motion.aside>
  );
}
