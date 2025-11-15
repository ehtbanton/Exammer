'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Terminal, Trash2, Pause, Play } from 'lucide-react';

interface LogEntry {
  message: string;
  timestamp: Date;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Connect to log stream
  useEffect(() => {
    const eventSource = new EventSource('/api/debug/logs');

    eventSource.onmessage = (event) => {
      if (isPaused) return;

      const logEntry: LogEntry = {
        message: event.data,
        timestamp: new Date(),
      };

      setLogs(prev => {
        const newLogs = [...prev, logEntry];
        // Keep only last 500 logs to prevent memory issues
        if (newLogs.length > 500) {
          return newLogs.slice(-500);
        }
        return newLogs;
      });
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isPaused]);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (autoScroll && !isPaused) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isPaused]);

  // Detect manual scroll to disable auto-scroll
  useEffect(() => {
    const container = logContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isAtBottom =
        container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
      setAutoScroll(isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const clearLogs = () => {
    setLogs([]);
  };

  const togglePause = () => {
    setIsPaused(prev => !prev);
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-6xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-6 w-6" />
            Server Logs
            <span className="text-sm font-normal text-muted-foreground ml-2">
              Admin Access Only
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex gap-2 items-center">
            <Button
              onClick={togglePause}
              variant={isPaused ? "default" : "outline"}
              size="sm"
            >
              {isPaused ? (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </>
              )}
            </Button>
            <Button
              onClick={clearLogs}
              variant="outline"
              size="sm"
              disabled={logs.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <div className="text-xs text-muted-foreground ml-auto">
              {logs.length} logs {isPaused && '(Paused)'}
              {!autoScroll && !isPaused && ' (Scroll to bottom for auto-scroll)'}
            </div>
          </div>

          {/* Log Output */}
          <div
            ref={logContainerRef}
            className="bg-black text-gray-300 font-mono text-sm p-4 rounded-lg h-[600px] overflow-y-auto"
          >
            {logs.length === 0 ? (
              <div className="text-gray-500">
                Waiting for server logs... (Live stream active)
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1 flex gap-2">
                  <span className="text-gray-600 text-xs whitespace-nowrap">
                    [{log.timestamp.toLocaleTimeString()}]
                  </span>
                  <span className="whitespace-pre-wrap break-all">
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={terminalEndRef} />
          </div>

          {/* Info Text */}
          <div className="text-xs text-muted-foreground">
            <p>This page displays live server logs from the Next.js application. Logs are limited to the last 500 entries.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
