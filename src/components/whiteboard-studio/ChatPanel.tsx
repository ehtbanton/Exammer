"use client";

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, User, Send, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
}

export function ChatPanel({
  messages,
  onSendMessage,
  isLoading = false,
  defaultPosition,
  defaultCollapsed = false,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate default position based on window size
  const getDefaultPosition = () => {
    if (defaultPosition) return defaultPosition;
    if (typeof window !== 'undefined') {
      return { x: window.innerWidth - 380, y: 20 };
    }
    return { x: 800, y: 20 };
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
      <FloatingPanel
        title="XAM - AI Tutor"
        icon={<Bot className="h-4 w-4" />}
        defaultPosition={getDefaultPosition()}
        defaultCollapsed={defaultCollapsed}
        minWidth={340}
        maxWidth={420}
        zIndex={110}
      >
        <div className="flex flex-col h-[350px]">
          {/* Messages Area */}
          <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Start a conversation with XAM</p>
                </div>
              ) : (
                messages.map((message, index) => (
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

                    <div
                      className={cn(
                        "max-w-[80%] rounded-xl px-3 py-2 text-sm",
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
                      <LatexRenderer>{message.content}</LatexRenderer>
                    </div>
                  </div>
                ))
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
            </div>
          </ScrollArea>

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
