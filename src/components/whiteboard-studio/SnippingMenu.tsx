"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Download, MessageSquare, X, Send } from 'lucide-react';
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
          "fixed z-[250] rounded-xl overflow-hidden",
          "bg-[var(--s-card-solid)] backdrop-blur-xl",
          "[box-shadow:var(--s-shadow-lg)]"
        )}
        style={{
          left: Math.min(position.x, window.innerWidth - 320),
          top: Math.min(position.y, window.innerHeight - 300),
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Preview */}
        <div className="p-3 border-b border-[var(--s-divider)]">
          <div className="relative">
            <img
              src={imageData}
              alt="Selection preview"
              className="max-w-[280px] max-h-[200px] rounded-lg object-contain mx-auto"
            />
            <button
              className="absolute top-1 right-1 h-6 w-6 rounded-md flex items-center justify-center bg-black/50 hover:bg-black/70 text-white transition-colors"
              onClick={onClose}
            >
              <X className="h-3 w-3" />
            </button>
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
                <div className="flex gap-2 p-2 bg-[var(--s-input-bg)] rounded-lg mb-2">
                  <input
                    value={askMessage}
                    onChange={(e) => setAskMessage(e.target.value)}
                    placeholder="Ask XAM about this image..."
                    className="flex-1 text-sm h-8 px-3 rounded-lg bg-[var(--s-card)] text-[var(--s-text)] placeholder:text-[var(--s-text-placeholder)] outline-none focus:[box-shadow:var(--s-focus-ring)] transition-shadow"
                    autoFocus
                  />
                  <button
                    className="h-8 px-3 rounded-lg bg-[var(--s-accent)] text-white hover:bg-[var(--s-accent-hover)] active:scale-95 transition-all"
                    onClick={handleAskXam}
                  >
                    <Send className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              className="flex-1 h-8 flex items-center justify-center gap-1 rounded-lg text-[12px] font-medium text-[var(--s-text-secondary)] bg-[var(--s-hover)] hover:bg-[var(--s-hover-strong)] active:scale-95 transition-all"
              onClick={handleCopy}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
            <button
              className="flex-1 h-8 flex items-center justify-center gap-1 rounded-lg text-[12px] font-medium text-[var(--s-text-secondary)] bg-[var(--s-hover)] hover:bg-[var(--s-hover-strong)] active:scale-95 transition-all"
              onClick={handleDownload}
            >
              <Download className="h-3.5 w-3.5" />
              Save
            </button>
            <button
              className="flex-1 h-8 flex items-center justify-center gap-1 rounded-lg text-[12px] font-medium bg-[var(--s-accent)] text-white hover:bg-[var(--s-accent-hover)] active:scale-95 transition-all"
              onClick={handleAskXam}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Ask XAM
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
