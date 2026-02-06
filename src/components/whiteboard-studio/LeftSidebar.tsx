"use client";

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, User, Send, Loader2, Youtube, Globe,
  X, ChevronLeft, ChevronRight as ChevronRightIcon,
  ArrowRight, Search, BookOpen, CheckCircle,
  Check, Circle, Plus, ChevronDown, ChevronUp,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { LatexRenderer } from '@/components/latex-renderer';
import { ActionCard } from './ActionCard';
import { WidgetMenu, WidgetType } from './WidgetMenu';
import { sidebarVariants, collapseVariants } from './animations';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

interface LeftSidebarProps {
  // Question
  questionText: string;
  objectives: string[];
  completedObjectives: number[];
  // Chat
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  onOpenYouTube?: (url: string) => void;
  onOpenResource?: (url: string) => void;
  // Action cards
  onNextStep: () => void;
  onFind: () => void;
  onExplain: () => void;
  onCheck: () => void;
  hasIncompleteObjectives: boolean;
  // Widgets
  onAddWidget: (type: WidgetType) => void;
  activeWidgets: WidgetType[];
  // Sidebar
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onExit: () => void;
}

// Detect URLs in text
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
  onAddWidget,
  activeWidgets,
  isCollapsed,
  onToggleCollapse,
  onExit,
}: LeftSidebarProps) {
  const [inputValue, setInputValue] = useState('');
  const [questionExpanded, setQuestionExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const completedCount = completedObjectives.length;
  const totalCount = objectives.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Auto-scroll to bottom on new messages
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

  // Collapsed state - thin icon strip
  if (isCollapsed) {
    return (
      <motion.div
        initial={{ width: 52 }}
        animate={{ width: 52 }}
        className="h-full bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-3 shrink-0"
      >
        <button
          onClick={onToggleCollapse}
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600"
          title="Expand sidebar"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleCollapse}
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600"
          title="Chat"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleCollapse}
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600"
          title="Question"
        >
          <BookOpen className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <button
          onClick={onExit}
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors text-gray-500 hover:text-red-600"
          title="Exit"
        >
          <X className="h-4 w-4" />
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
      className="w-[360px] h-full bg-white border-r border-gray-200 flex flex-col shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <X className="h-4 w-4" />
          <span>Exit</span>
        </button>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          title="Collapse sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* AI Greeting (when no messages) */}
      {messages.length === 0 && (
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot className="h-4 w-4 text-blue-600" />
            </div>
            <span className="font-headline font-semibold text-sm text-gray-900">XAM</span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Hi there, how can I assist you today?
          </p>
        </div>
      )}

      {/* Action Cards - 2x2 grid */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <ActionCard
            icon={<ArrowRight className="h-4 w-4 text-blue-600" />}
            iconBgColor="bg-blue-100"
            title="Next"
            description="Play the next steps from here"
            onClick={onNextStep}
            disabled={!hasIncompleteObjectives}
          />
          <ActionCard
            icon={<Search className="h-4 w-4 text-red-600" />}
            iconBgColor="bg-red-100"
            title="Find"
            description="Locate references or similar ideas"
            onClick={onFind}
          />
          <ActionCard
            icon={<BookOpen className="h-4 w-4 text-orange-600" />}
            iconBgColor="bg-orange-100"
            title="Explain"
            description="Break the selection down for me"
            onClick={onExplain}
          />
          <ActionCard
            icon={<CheckCircle className="h-4 w-4 text-green-600" />}
            iconBgColor="bg-green-100"
            title="Check"
            description="Verify the work for me"
            onClick={onCheck}
          />
        </div>
      </div>

      {/* Question & Progress (collapsible) */}
      <div className="border-b border-gray-100 shrink-0">
        <button
          onClick={() => setQuestionExpanded(!questionExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Progress
            </span>
            <span className="text-xs font-medium text-gray-700">
              {completedCount}/{totalCount}
            </span>
          </div>
          {questionExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          )}
        </button>

        <AnimatePresence initial={false}>
          {questionExpanded && (
            <motion.div
              variants={collapseVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 space-y-3">
                <Progress value={progressPercent} className="h-1.5" />

                {/* Question Text */}
                <div className="text-sm text-gray-700 leading-relaxed">
                  <LatexRenderer>{questionText}</LatexRenderer>
                </div>

                {/* Objectives */}
                {objectives.length > 0 && (
                  <ul className="space-y-1.5">
                    {objectives.map((objective, index) => {
                      const isCompleted = completedObjectives.includes(index);
                      return (
                        <li
                          key={index}
                          className={cn(
                            "flex items-start gap-2 text-xs p-2 rounded-lg transition-colors",
                            isCompleted
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-50 text-gray-600"
                          )}
                        >
                          {isCompleted ? (
                            <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-500" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
                          )}
                          <span className="line-clamp-2">{objective}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Messages (scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3 studio-scrollbar-hide">
        <div className="space-y-3">
          {messages.map((message, index) => {
            const { youtubeVideoUrls, youtubeSearchUrls, articleUrls } = message.role === 'assistant'
              ? extractUrls(message.content)
              : { youtubeVideoUrls: [], youtubeSearchUrls: [], articleUrls: [] };

            return (
              <div
                key={index}
                className={cn(
                  "flex gap-2",
                  message.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-xs",
                      message.role === 'user'
                        ? "bg-gray-900 text-white"
                        : "bg-blue-100 text-blue-700"
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
                      "rounded-xl px-3 py-2 text-sm",
                      message.role === 'user'
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-800"
                    )}
                  >
                    {message.imageUrl && (
                      <img
                        src={message.imageUrl}
                        alt="Whiteboard"
                        className="max-w-full rounded-lg mb-2"
                      />
                    )}
                    <LatexRenderer>{message.role === 'assistant' ? stripUrls(message.content) : message.content}</LatexRenderer>
                  </div>

                  {/* URL Action Buttons */}
                  {(youtubeVideoUrls.length > 0 || youtubeSearchUrls.length > 0 || articleUrls.length > 0) && (
                    <div className="flex flex-wrap gap-1">
                      {youtubeVideoUrls.map((ytUrl, i) => (
                        <Button
                          key={`yt-${i}`}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 bg-white"
                          onClick={() => onOpenYouTube?.(ytUrl)}
                        >
                          <Youtube className="h-3 w-3 text-red-500" />
                          Video {youtubeVideoUrls.length > 1 ? i + 1 : ''}
                        </Button>
                      ))}
                      {youtubeSearchUrls.map((searchUrl, i) => (
                        <Button
                          key={`yts-${i}`}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 bg-white"
                          onClick={() => window.open(searchUrl, '_blank')}
                        >
                          <Youtube className="h-3 w-3 text-red-500" />
                          Search {youtubeSearchUrls.length > 1 ? i + 1 : ''}
                        </Button>
                      ))}
                      {articleUrls.map((artUrl, i) => (
                        <Button
                          key={`art-${i}`}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 bg-white"
                          onClick={() => onOpenResource?.(artUrl)}
                        >
                          <Globe className="h-3 w-3 text-blue-500" />
                          Link {articleUrls.length > 1 ? i + 1 : ''}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                  <Bot className="h-3.5 w-3.5" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-gray-100 rounded-xl px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat Input */}
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="flex-1 text-sm h-9 bg-gray-50 border-gray-200"
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="h-9 w-9 p-0 bg-gray-900 hover:bg-gray-800 text-white"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas Context / Widgets */}
      <div className="px-4 py-2.5 border-t border-gray-100 shrink-0">
        <WidgetMenu onAddWidget={onAddWidget} activeWidgets={activeWidgets} />
      </div>
    </motion.aside>
  );
}
