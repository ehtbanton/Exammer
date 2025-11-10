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
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      console.log('SSE connection attempt without valid session');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Valid session required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const userId = parseInt(session.user.id);
    console.log(`SSE connection established for user ${userId}`);

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        try {
          // Send initial connection message
          controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));

          // Listen for user changes
          const unsubscribe = onUserChange((affectedUserId) => {
            try {
              // If this user's session was invalidated, notify them
              if (affectedUserId === userId) {
                console.log(`Notifying user ${userId} of session invalidation`);
                controller.enqueue(encoder.encode('data: {"type":"session_invalidated"}\n\n'));
              }
            } catch (error) {
              console.error(`Error notifying user ${userId}:`, error);
            }
          });

          // Clean up on connection close
          req.signal.addEventListener('abort', () => {
            console.log(`User ${userId} disconnected from session events`);
            unsubscribe();
            try {
              controller.close();
            } catch (error) {
              // Controller may already be closed
              console.log(`Controller already closed for user ${userId}`);
            }
          });
        } catch (error) {
          console.error(`Error in SSE stream initialization for user ${userId}:`, error);
          try {
            controller.error(error);
          } catch (e) {
            // Ignore if controller is already closed
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('SSE connection error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: 'Failed to establish SSE connection' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
