"use client";

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, User, Send, MessageSquare, Loader2, Youtube, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LatexRenderer } from '@/components/latex-renderer';
import { FloatingPanel } from './FloatingPanel';
import { chatPanelVariants } from './animations';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  defaultPosition?: { x: number; y: number };
  defaultCollapsed?: boolean;
  onOpenYouTube?: (url: string) => void;
  onOpenResource?: (url: string) => void;
}

// Detect URLs in text
function extractUrls(text: string): { youtubeVideoUrls: string[]; youtubeSearchUrls: string[]; articleUrls: string[] } {
  const urlRegex = /https?:\/\/[^\s<>\[\]"']+/g;
  const urls = text.match(urlRegex) || [];

  console.log('extractUrls - found URLs:', urls);

  const youtubeVideoUrls: string[] = [];
  const youtubeSearchUrls: string[] = [];
  const articleUrls: string[] = [];

  for (const url of urls) {
    // Clean up any trailing punctuation
    const cleanUrl = url.replace(/[.,;:!?)]+$/, '');

    if (cleanUrl.includes('youtube.com/results') || cleanUrl.includes('youtube.com/search')) {
      // YouTube search URLs - open in new tab
      youtubeSearchUrls.push(cleanUrl);
    } else if (cleanUrl.includes('youtube.com/watch') || cleanUrl.includes('youtu.be/')) {
      // YouTube video URLs - open in YouTube widget
      youtubeVideoUrls.push(cleanUrl);
    } else {
      articleUrls.push(cleanUrl);
    }
  }

  console.log('extractUrls - categorized:', { youtubeVideoUrls, youtubeSearchUrls, articleUrls });
  return { youtubeVideoUrls, youtubeSearchUrls, articleUrls };
}

// Strip URLs from message text for cleaner display
function stripUrls(text: string): string {
  // Remove URLs and any trailing whitespace/newlines
  return text
    .replace(/https?:\/\/[^\s<>\[\]"']+/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Collapse multiple newlines
    .trim();
}

export function ChatPanel({
  messages,
  onSendMessage,
  isLoading = false,
  defaultPosition,
  defaultCollapsed = false,
  onOpenYouTube,
  onOpenResource,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Position next to the question panel (which is at x: 20, width ~320-450)
  const [panelPosition] = useState(() => {
    if (defaultPosition) return defaultPosition;
    return { x: 500, y: 70 }; // Next to Question panel with gap
  });

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

  return (
    <motion.div
      variants={chatPanelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
      <FloatingPanel
        title="XAM - AI Tutor"
        icon={<Bot className="h-4 w-4" />}
        defaultPosition={panelPosition}
        defaultCollapsed={defaultCollapsed}
        minWidth={320}
        maxWidth={600}
        minHeight={250}
        maxHeight={700}
        defaultWidth={380}
        defaultHeight={420}
        resizable={true}
        zIndex={115}
      >
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          {/* Messages Area */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2 hide-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Start a conversation with XAM</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  // Extract URLs from assistant messages
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
                              ? "bg-primary text-primary-foreground"
                              : "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                          )}
                        >
                          {message.role === 'user' ? (
                            <User className="h-3.5 w-3.5" />
                          ) : (
                            <Bot className="h-3.5 w-3.5" />
                          )}
                        </AvatarFallback>
                      </Avatar>

                      <div className="max-w-[80%] space-y-2">
                        <div
                          className={cn(
                            "rounded-xl px-3 py-2 text-sm",
                            message.role === 'user'
                              ? "bg-primary text-primary-foreground"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
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
                                className="h-7 text-xs gap-1 bg-white dark:bg-gray-900"
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
                                className="h-7 text-xs gap-1 bg-white dark:bg-gray-900"
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
                                className="h-7 text-xs gap-1 bg-white dark:bg-gray-900"
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
                })
              )}

              {isLoading && (
                <div className="flex gap-2">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs">
                      <Bot className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  </div>
                </div>
              )}
              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask XAM anything..."
              className="flex-1 text-sm h-9"
              disabled={isLoading}
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="h-9 px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </FloatingPanel>
    </motion.div>
  );
}
