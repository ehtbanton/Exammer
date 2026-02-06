"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Music, ExternalLink } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SpotifyWidgetProps {
  defaultPosition?: { x: number; y: number };
  onClose: () => void;
}

function extractSpotifyEmbed(url: string): { type: string; id: string } | null {
  // Match track, album, playlist, or episode
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
        icon={<Music className="h-4 w-4 text-green-500" />}
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
        minimizedIcon={<Music className="h-5 w-5 text-green-500" />}
      >
        <div className="flex flex-col h-full space-y-3">
          {/* URL Input */}
          <div className="flex gap-2 shrink-0">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste Spotify URL..."
              className="text-sm h-8"
            />
            <Button size="sm" className="h-8" onClick={handleLoadTrack}>
              Load
            </Button>
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          {/* Spotify Player */}
          <div className="flex-1 min-h-0 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            {embed ? (
              <iframe
                src={`https://open.spotify.com/embed/${embed.type}/${embed.id}?theme=0`}
                className="w-full h-full"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Music className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Paste a Spotify URL above</p>
                  <p className="text-xs text-gray-600">Track, album, or playlist</p>
                </div>
              </div>
            )}
          </div>

          {/* Open in Spotify */}
          {embed && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => window.open(`https://open.spotify.com/${embed.type}/${embed.id}`, '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open in Spotify
            </Button>
          )}
        </div>
      </FloatingPanel>
    </motion.div>
  );
}
