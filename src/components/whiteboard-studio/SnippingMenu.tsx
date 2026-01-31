"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Download, MessageSquare, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface SnippingMenuProps {
  isOpen: boolean;
  imageData: string | null;
  position: { x: number; y: number };
  onClose: () => void;
  onAskXam: (message: string, imageData: string) => void;
}

export function SnippingMenu({ isOpen, imageData, position, onClose, onAskXam }: SnippingMenuProps) {
  const [showAskInput, setShowAskInput] = useState(false);
  const [askMessage, setAskMessage] = useState('');
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!imageData) return;

    try {
      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();

      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);

      toast({
        title: "Copied!",
        description: "Image copied to clipboard",
      });
      onClose();
    } catch (error) {
      // Fallback: copy as data URL
      try {
        await navigator.clipboard.writeText(imageData);
        toast({
          title: "Copied!",
          description: "Image data copied to clipboard",
        });
        onClose();
      } catch {
        toast({
          title: "Failed to copy",
          description: "Could not copy image to clipboard",
          variant: "destructive",
        });
      }
    }
  };

  const handleDownload = () => {
    if (!imageData) return;

    const link = document.createElement('a');
    link.href = imageData;
    link.download = `snip-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Downloaded!",
      description: "Image saved to downloads",
    });
    onClose();
  };

  const handleAskXam = () => {
    if (!imageData) return;

    if (!showAskInput) {
      setShowAskInput(true);
      return;
    }

    onAskXam(askMessage || "What do you see in this image?", imageData);
    setAskMessage('');
    setShowAskInput(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && showAskInput) {
      handleAskXam();
    } else if (e.key === 'Escape') {
      if (showAskInput) {
        setShowAskInput(false);
      } else {
        onClose();
      }
    }
  };

  if (!isOpen || !imageData) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={cn(
          "fixed z-[250] bg-white dark:bg-gray-900 rounded-xl shadow-2xl",
          "border border-gray-200 dark:border-gray-700",
          "overflow-hidden"
        )}
        style={{
          left: Math.min(position.x, window.innerWidth - 320),
          top: Math.min(position.y, window.innerHeight - 300),
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Preview */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <img
              src={imageData}
              alt="Selection preview"
              className="max-w-[280px] max-h-[200px] rounded-lg object-contain mx-auto"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 bg-black/50 hover:bg-black/70 text-white"
              onClick={onClose}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="p-2 space-y-2">
          {/* Ask XAM Input */}
          <AnimatePresence>
            {showAskInput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2">
                  <Input
                    value={askMessage}
                    onChange={(e) => setAskMessage(e.target.value)}
                    placeholder="Ask XAM about this image..."
                    className="text-sm h-8"
                    autoFocus
                  />
                  <Button size="sm" className="h-8 px-2" onClick={handleAskXam}>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleCopy}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button
              size="sm"
              className={cn(
                "flex-1",
                showAskInput
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              )}
              onClick={handleAskXam}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Ask XAM
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
