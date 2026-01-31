"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, ExternalLink, RefreshCw } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface BrowserWidgetProps {
  defaultPosition?: { x: number; y: number };
  initialUrl?: string;
  onClose: () => void;
}

export function BrowserWidget({
  defaultPosition = { x: 100, y: 100 },
  initialUrl,
  onClose
}: BrowserWidgetProps) {
  const [url, setUrl] = useState(initialUrl || '');
  const [loadedUrl, setLoadedUrl] = useState<string | null>(initialUrl || null);
  const [error, setError] = useState('');

  const handleLoadUrl = () => {
    let urlToLoad = url.trim();
    if (!urlToLoad) {
      setError('Please enter a URL');
      return;
    }

    // Add https:// if no protocol
    if (!urlToLoad.startsWith('http://') && !urlToLoad.startsWith('https://')) {
      urlToLoad = 'https://' + urlToLoad;
    }

    try {
      new URL(urlToLoad); // Validate URL
      setLoadedUrl(urlToLoad);
      setUrl(urlToLoad);
      setError('');
    } catch {
      setError('Invalid URL');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLoadUrl();
    }
  };

  const handleRefresh = () => {
    if (loadedUrl) {
      // Force refresh by temporarily clearing and resetting
      const currentUrl = loadedUrl;
      setLoadedUrl(null);
      setTimeout(() => setLoadedUrl(currentUrl), 100);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <FloatingPanel
        title="Browser"
        icon={<Globe className="h-4 w-4 text-blue-500" />}
        defaultPosition={defaultPosition}
        minWidth={200}
        maxWidth={1200}
        minHeight={150}
        maxHeight={800}
        defaultWidth={500}
        defaultHeight={400}
        resizable={true}
        closable={true}
        onClose={onClose}
        zIndex={109}
        squareMinimize={true}
        minimizedIcon={<Globe className="h-5 w-5 text-blue-500" />}
      >
        <div className="flex flex-col h-full space-y-2">
          {/* URL Bar */}
          <div className="flex gap-2 shrink-0">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter URL (e.g., google.com)"
              className="text-sm h-8 flex-1"
            />
            <Button size="sm" className="h-8" onClick={handleLoadUrl}>
              Go
            </Button>
            {loadedUrl && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                onClick={handleRefresh}
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-500 shrink-0">{error}</p>
          )}

          {/* Browser Frame */}
          <div className="flex-1 min-h-0 bg-white rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            {loadedUrl ? (
              <iframe
                src={loadedUrl}
                className="w-full h-full"
                style={{ border: 'none' }}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer"
                title="Browser content"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-50 dark:bg-gray-800">
                <div className="text-center">
                  <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Enter a URL above to browse</p>
                  <p className="text-xs text-gray-400 mt-1">Some sites may not load due to security restrictions</p>
                </div>
              </div>
            )}
          </div>

          {/* Open Externally */}
          {loadedUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full shrink-0"
              onClick={() => window.open(loadedUrl, '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open in New Tab
            </Button>
          )}
        </div>
      </FloatingPanel>
    </motion.div>
  );
}
