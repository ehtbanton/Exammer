"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Youtube, ExternalLink } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { cn } from '@/lib/utils';

interface YouTubeWidgetProps {
  defaultPosition?: { x: number; y: number };
  initialUrl?: string;
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

export function YouTubeWidget({ defaultPosition = { x: 800, y: 70 }, initialUrl, onClose }: YouTubeWidgetProps) {
  const [url, setUrl] = useState(initialUrl || '');
  const [videoId, setVideoId] = useState<string | null>(() => {
    if (initialUrl) {
      return extractYouTubeId(initialUrl);
    }
    return null;
  });
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
        icon={<Youtube className="h-4 w-4 text-[#ff3b30]" />}
        defaultPosition={defaultPosition}
        minWidth={200}
        maxWidth={1200}
        minHeight={150}
        maxHeight={800}
        defaultWidth={400}
        defaultHeight={300}
        resizable={true}
        closable={true}
        onClose={onClose}
        zIndex={110}
        squareMinimize={true}
        minimizedIcon={<Youtube className="h-5 w-5 text-[#ff3b30]" />}
      >
        <div className="flex flex-col h-full gap-2">
          {/* URL Input */}
          <div className="flex gap-2 shrink-0">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste YouTube URL..."
              className="flex-1 h-8 px-3 text-[13px] rounded-lg bg-[var(--s-input-bg)] text-[var(--s-text)] placeholder:text-[var(--s-text-placeholder)] outline-none focus:[box-shadow:var(--s-focus-ring)] transition-shadow"
            />
            <button
              onClick={handleLoadVideo}
              className="h-8 px-3 rounded-lg bg-[var(--s-accent)] text-white text-[12px] font-medium hover:bg-[var(--s-accent-hover)] active:scale-95 transition-all"
            >
              Load
            </button>
          </div>

          {error && (
            <p className="text-[11px] text-[var(--s-danger)] shrink-0">{error}</p>
          )}

          {/* Video Player */}
          <div className="w-full rounded-xl overflow-hidden bg-[var(--s-input-bg)]" style={{ aspectRatio: '16/9' }}>
            {videoId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}&rel=0`}
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[var(--s-text-muted)]">
                <div className="text-center">
                  <Youtube className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-[13px]">Paste a YouTube URL above</p>
                </div>
              </div>
            )}
          </div>

          {/* Open in new tab */}
          {videoId && (
            <button
              onClick={() => window.open(`https://youtube.com/watch?v=${videoId}`, '_blank')}
              className="w-full h-8 flex items-center justify-center gap-1.5 rounded-lg text-[12px] text-[var(--s-text-muted)] hover:bg-[var(--s-hover)] active:scale-[0.98] transition-all shrink-0"
            >
              <ExternalLink className="h-3 w-3" />
              Open in YouTube
            </button>
          )}
        </div>
      </FloatingPanel>
    </motion.div>
  );
}
