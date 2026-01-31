"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Youtube, ExternalLink } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface YouTubeWidgetProps {
  defaultPosition?: { x: number; y: number };
  onClose: () => void;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function YouTubeWidget({ defaultPosition = { x: 800, y: 70 }, onClose }: YouTubeWidgetProps) {
  const [url, setUrl] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleLoadVideo = () => {
    const id = extractYouTubeId(url);
    if (id) {
      setVideoId(id);
      setError('');
    } else {
      setError('Invalid YouTube URL');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLoadVideo();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <FloatingPanel
        title="YouTube"
        icon={<Youtube className="h-4 w-4 text-red-500" />}
        defaultPosition={defaultPosition}
        minWidth={320}
        maxWidth={640}
        minHeight={200}
        maxHeight={500}
        defaultWidth={400}
        defaultHeight={320}
        resizable={true}
        closable={true}
        onClose={onClose}
        zIndex={110}
      >
        <div className="flex flex-col h-full space-y-3">
          {/* URL Input */}
          <div className="flex gap-2 shrink-0">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste YouTube URL..."
              className="text-sm h-8"
            />
            <Button size="sm" className="h-8" onClick={handleLoadVideo}>
              Load
            </Button>
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          {/* Video Player */}
          <div className="flex-1 bg-black rounded-lg overflow-hidden">
            {videoId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}&rel=0`}
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Youtube className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Paste a YouTube URL above</p>
                </div>
              </div>
            )}
          </div>

          {/* Open in new tab */}
          {videoId && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => window.open(`https://youtube.com/watch?v=${videoId}`, '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open in YouTube
            </Button>
          )}
        </div>
      </FloatingPanel>
    </motion.div>
  );
}
