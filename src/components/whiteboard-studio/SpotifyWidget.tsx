"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Music, ExternalLink, ArrowRight } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { cn } from '@/lib/utils';

interface SpotifyWidgetProps {
  defaultPosition?: { x: number; y: number };
  onClose: () => void;
}

function extractSpotifyEmbed(url: string): { type: string; id: string } | null {
  const patterns = [
    /spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/,
    /open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return { type: match[1], id: match[2] };
  }
  return null;
}

export function SpotifyWidget({ defaultPosition = { x: 800, y: 400 }, onClose }: SpotifyWidgetProps) {
  const [url, setUrl] = useState('');
  const [embed, setEmbed] = useState<{ type: string; id: string } | null>(null);
  const [error, setError] = useState('');

  const handleLoadTrack = () => {
    const result = extractSpotifyEmbed(url);
    if (result) {
      setEmbed(result);
      setError('');
    } else {
      setError('Invalid Spotify URL (track, album, or playlist)');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLoadTrack();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <FloatingPanel
        title="Spotify"
        icon={<Music className="h-4 w-4 text-[#1DB954]" />}
        defaultPosition={defaultPosition}
        minWidth={200}
        maxWidth={800}
        minHeight={150}
        maxHeight={600}
        defaultWidth={320}
        defaultHeight={280}
        resizable={true}
        closable={true}
        onClose={onClose}
        zIndex={108}
        squareMinimize={true}
        minimizedIcon={<Music className="h-5 w-5 text-[#1DB954]" />}
      >
        <div className="flex flex-col h-full gap-3">
          {/* URL Input */}
          <div className="flex gap-2 shrink-0">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste Spotify URL..."
              className="flex-1 h-8 px-3 text-[13px] rounded-lg bg-[var(--s-input-bg)] text-[var(--s-text)] placeholder:text-[var(--s-text-placeholder)] outline-none focus:[box-shadow:var(--s-focus-ring)] transition-shadow"
            />
            <button
              onClick={handleLoadTrack}
              className="h-8 px-3 rounded-lg bg-[var(--s-accent)] text-white text-[12px] font-medium hover:bg-[var(--s-accent-hover)] active:scale-95 transition-all"
            >
              Load
            </button>
          </div>

          {error && (
            <p className="text-[11px] text-[var(--s-danger)]">{error}</p>
          )}

          {/* Spotify Player */}
          <div className="flex-1 min-h-0 rounded-xl overflow-hidden bg-[var(--s-input-bg)]">
            {embed ? (
              <iframe
                src={`https://open.spotify.com/embed/${embed.type}/${embed.id}?theme=0`}
                className="w-full h-full"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[var(--s-text-muted)]">
                <div className="text-center">
                  <Music className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-[13px]">Paste a Spotify URL above</p>
                  <p className="text-[11px] text-[var(--s-text-muted)] mt-0.5">Track, album, or playlist</p>
                </div>
              </div>
            )}
          </div>

          {/* Open in Spotify */}
          {embed && (
            <button
              onClick={() => window.open(`https://open.spotify.com/${embed.type}/${embed.id}`, '_blank')}
              className="w-full h-8 flex items-center justify-center gap-1.5 rounded-lg text-[12px] text-[var(--s-text-muted)] hover:bg-[var(--s-hover)] active:scale-[0.98] transition-all"
            >
              <ExternalLink className="h-3 w-3" />
              Open in Spotify
            </button>
          )}
        </div>
      </FloatingPanel>
    </motion.div>
  );
}
