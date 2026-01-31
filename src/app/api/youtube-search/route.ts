"use server";

import { NextRequest, NextResponse } from 'next/server';

// List of public Invidious instances to try
const INVIDIOUS_INSTANCES = [
  'https://vid.puffyan.us',
  'https://invidious.fdn.fr',
  'https://y.com.sb',
  'https://invidious.nerdvpn.de',
];

interface InvidiousVideo {
  videoId: string;
  title: string;
  author: string;
  lengthSeconds: number;
  viewCount: number;
}

async function searchWithInstance(instance: string, query: string): Promise<InvidiousVideo[]> {
  const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(5000), // 5 second timeout
  });

  if (!response.ok) {
    throw new Error(`Instance ${instance} returned ${response.status}`);
  }

  const data = await response.json();
  return data.filter((item: any) => item.type === 'video').slice(0, 5);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  // Try each instance until one works
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const videos = await searchWithInstance(instance, query);

      // Format the results with YouTube URLs
      const results = videos.map((video: InvidiousVideo) => ({
        videoId: video.videoId,
        title: video.title,
        author: video.author,
        duration: formatDuration(video.lengthSeconds),
        views: formatViews(video.viewCount),
        url: `https://www.youtube.com/watch?v=${video.videoId}`,
      }));

      return NextResponse.json({ results, instance });
    } catch (error) {
      console.log(`Invidious instance ${instance} failed, trying next...`);
      continue;
    }
  }

  return NextResponse.json({ error: 'All Invidious instances failed' }, { status: 503 });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(views: number): string {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M views`;
  } else if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K views`;
  }
  return `${views} views`;
}
