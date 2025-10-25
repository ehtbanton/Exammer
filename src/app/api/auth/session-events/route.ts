import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { onUserChange } from '@/lib/user-access-sync';

// Disable response caching for SSE
export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events endpoint for real-time session invalidation
 * Clients connect and listen for their session to be invalidated
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = parseInt(session.user.id);

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));

      // Listen for user changes
      const unsubscribe = onUserChange((affectedUserId) => {
        // If this user's session was invalidated, notify them
        if (affectedUserId === userId) {
          console.log(`Notifying user ${userId} of session invalidation`);
          controller.enqueue(encoder.encode('data: {"type":"session_invalidated"}\n\n'));
        }
      });

      // Clean up on connection close
      req.signal.addEventListener('abort', () => {
        console.log(`User ${userId} disconnected from session events`);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
