"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ExternalLink, Copy, Check } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { Button } from '@/components/ui/button';

interface ResourceViewerProps {
  defaultPosition?: { x: number; y: number };
  url: string;
  title?: string;
  onClose: () => void;
}

// Sites that allow iframe embedding
const ALLOWED_SITES = [
  { pattern: /wikipedia\.org/, name: 'Wikipedia' },
  { pattern: /khanacademy\.org/, name: 'Khan Academy' },
  { pattern: /bbc\.co\.uk/, name: 'BBC Bitesize' },
  { pattern: /wolframalpha\.com/, name: 'Wolfram Alpha' },
  { pattern: /desmos\.com/, name: 'Desmos' },
  { pattern: /geogebra\.org/, name: 'GeoGebra' },
  { pattern: /mathway\.com/, name: 'Mathway' },
  { pattern: /stackexchange\.com/, name: 'Stack Exchange' },
  { pattern: /stackoverflow\.com/, name: 'Stack Overflow' },
  { pattern: /w3schools\.com/, name: 'W3Schools' },
  { pattern: /mdn\.io|developer\.mozilla\.org/, name: 'MDN' },
];

function getSiteName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    for (const site of ALLOWED_SITES) {
      if (site.pattern.test(hostname)) {
        return site.name;
      }
    }
    return hostname;
  } catch {
    return 'Resource';
  }
}

export function isEmbeddableSite(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const result = ALLOWED_SITES.some(site => site.pattern.test(hostname));
    console.log('isEmbeddableSite check:', { url, hostname, result });
    return result;
  } catch (e) {
    console.log('isEmbeddableSite error:', e);
    return false;
  }
}

export function ResourceViewer({
  defaultPosition = { x: 100, y: 100 },
  url,
  title,
  onClose
}: ResourceViewerProps) {
  const [copied, setCopied] = useState(false);
  const siteName = title || getSiteName(url);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleOpenExternal = () => {
    window.open(url, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <FloatingPanel
        title={siteName}
        icon={<BookOpen className="h-4 w-4 text-emerald-500" />}
        defaultPosition={defaultPosition}
        minWidth={300}
        maxWidth={1200}
        minHeight={200}
        maxHeight={800}
        defaultWidth={600}
        defaultHeight={500}
        resizable={true}
        closable={true}
        onClose={onClose}
        zIndex={109}
        squareMinimize={true}
        minimizedIcon={<BookOpen className="h-5 w-5 text-emerald-500" />}
      >
        <div className="flex flex-col h-full space-y-2">
          {/* Action Bar */}
          <div className="flex items-center justify-between gap-2 shrink-0 px-1">
            <p className="text-xs text-gray-500 truncate flex-1" title={url}>
              {url}
            </p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={handleCopy}
                title="Copy URL"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={handleOpenExternal}
                title="Open in New Tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Content Frame */}
          <div className="flex-1 min-h-0 bg-white rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <iframe
              src={url}
              className="w-full h-full"
              style={{ border: 'none' }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              referrerPolicy="no-referrer"
              title={siteName}
            />
          </div>
        </div>
      </FloatingPanel>
    </motion.div>
  );
}
