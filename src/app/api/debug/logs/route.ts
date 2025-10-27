import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import type { User } from '@/lib/db';

// Store for log messages
const logBuffer: string[] = [];
const MAX_BUFFER_SIZE = 100;

// Store active connections
const connections = new Set<ReadableStreamDefaultController>();

// Intercept console.log
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

// Override console methods
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
