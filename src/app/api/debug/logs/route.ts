import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import type { User } from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Store for log messages (used in non-PM2 mode)
const logBuffer: string[] = [];
const MAX_BUFFER_SIZE = 100;

// Store active connections (used in non-PM2 mode)
const connections = new Set<ReadableStreamDefaultController>();

// Detect if running under PM2
const isRunningUnderPM2 = !!process.env.PM2_HOME || !!process.env.pm_id;

// Intercept console.log (only in non-PM2 mode)
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

function formatLogMessage(type: string, args: any[]): string {
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');

  return type === 'log' ? message : `[${type.toUpperCase()}] ${message}`;
}

function broadcastLog(message: string) {
  // Add to buffer
  logBuffer.push(message);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift();
  }

  // Broadcast to all connected clients
  const encoder = new TextEncoder();
  const data = encoder.encode(`data: ${message}\n\n`);

  connections.forEach(controller => {
    try {
      controller.enqueue(data);
    } catch (error) {
      // Connection closed, will be cleaned up
    }
  });
}

// Override console methods only if NOT running under PM2
if (!isRunningUnderPM2) {
  console.log = function(...args: any[]) {
    originalConsoleLog.apply(console, args);
    broadcastLog(formatLogMessage('log', args));
  };

  console.error = function(...args: any[]) {
    originalConsoleError.apply(console, args);
    broadcastLog(formatLogMessage('error', args));
  };

  console.warn = function(...args: any[]) {
    originalConsoleWarn.apply(console, args);
    broadcastLog(formatLogMessage('warn', args));
  };

  console.info = function(...args: any[]) {
    originalConsoleInfo.apply(console, args);
    broadcastLog(formatLogMessage('info', args));
  };
}

// Get PM2 log file path
async function getPM2LogPath(): Promise<string | null> {
  try {
    // Try to get the current PM2 process info
    const { stdout } = await execAsync('pm2 jlist');
    const processes = JSON.parse(stdout);

    // Find the current process by name
    const currentProcess = processes.find((p: any) =>
      p.name === 'exammer-deploy' || p.pm_id === process.env.pm_id
    );

    if (currentProcess && currentProcess.pm2_env?.pm_out_log_path) {
      return currentProcess.pm2_env.pm_out_log_path;
    }

    // Fallback: try to construct the path manually
    const pm2Home = process.env.PM2_HOME || path.join(process.env.HOME || '~', '.pm2');
    const logPath = path.join(pm2Home, 'logs', 'exammer-deploy-out.log');

    if (fs.existsSync(logPath)) {
      return logPath;
    }

    return null;
  } catch (error) {
    console.error('Error getting PM2 log path:', error);
    return null;
  }
}

// Read last N lines from a file
function readLastLines(filePath: string, n: number): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    return lines.slice(-n);
  } catch (error) {
    console.error('Error reading last lines:', error);
    return [];
  }
}

// Stream PM2 logs with proper cleanup
function createPM2LogStream(
  logPath: string,
  controller: ReadableStreamDefaultController,
  signal: AbortSignal,
  lastN: number = 500
) {
  let watcher: fs.FSWatcher | null = null;
  let lastSize = 0;
  let lineBuffer = '';

  try {
    // Send initial logs
    const initialLines = readLastLines(logPath, lastN);
    const encoder = new TextEncoder();
    initialLines.forEach(line => {
      controller.enqueue(encoder.encode(`data: ${line}\n\n`));
    });

    // Get current file size
    lastSize = fs.statSync(logPath).size;

    // Watch for changes
    watcher = fs.watch(logPath, (eventType) => {
      if (eventType === 'change' && !signal.aborted) {
        try {
          const currentSize = fs.statSync(logPath).size;

          if (currentSize > lastSize) {
            // Read new content
            const stream = fs.createReadStream(logPath, {
              start: lastSize,
              end: currentSize,
              encoding: 'utf8'
            });

            stream.on('data', (chunk: string) => {
              lineBuffer += chunk;
              const lines = lineBuffer.split('\n');
              // Keep the last incomplete line in buffer
              lineBuffer = lines.pop() || '';

              lines.forEach(line => {
                if (line.trim() && !signal.aborted) {
                  controller.enqueue(encoder.encode(`data: ${line}\n\n`));
                }
              });
            });

            stream.on('error', (err) => {
              console.error('Error reading log file:', err);
            });

            lastSize = currentSize;
          }
        } catch (error) {
          console.error('Error processing file change:', error);
        }
      }
    });

    // Cleanup on abort
    signal.addEventListener('abort', () => {
      if (watcher) {
        watcher.close();
      }
      controller.close();
    });

  } catch (error) {
    console.error('Error setting up PM2 log stream:', error);
    controller.close();
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Check user access level
    const user = await db.get<User>(
      'SELECT access_level FROM users WHERE email = ?',
      [session.user.email]
    );

    if (!user || user.access_level !== 3) {
      return new Response('Access denied. Admin access required.', { status: 403 });
    }

    // Create Server-Sent Events stream
    const encoder = new TextEncoder();

    // If running under PM2, read from PM2 logs
    if (isRunningUnderPM2) {
      const logPath = await getPM2LogPath();

      if (!logPath) {
        return new Response(
          'PM2 log file not found. Please ensure PM2 is configured correctly.',
          { status: 500 }
        );
      }

      const stream = new ReadableStream({
        start(controller) {
          // Send initial connection message
          controller.enqueue(encoder.encode(`data: [Connected to PM2 log stream: ${logPath}]\n\n`));

          // Start streaming PM2 logs
          createPM2LogStream(logPath, controller, req.signal, 500);
        },
        cancel() {
          // Cleanup handled by signal abort in createPM2LogStream
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-PM2 mode: use in-memory console interception
    const stream = new ReadableStream({
      start(controller) {
        // Add this connection to the set
        connections.add(controller);

        // Send recent logs from buffer
        logBuffer.forEach(log => {
          controller.enqueue(encoder.encode(`data: ${log}\n\n`));
        });

        // Send initial connection message
        controller.enqueue(encoder.encode(`data: [Connected to log stream]\n\n`));

        // Handle client disconnect
        req.signal.addEventListener('abort', () => {
          connections.delete(controller);
          controller.close();
        });
      },
      cancel() {
        connections.delete(controller);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in log stream:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
