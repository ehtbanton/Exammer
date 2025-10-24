import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import type { User } from '@/lib/db';

// Disable caching for this route - we need fresh data every time
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/auth/access-level
 * Returns the current user's access level
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user's access level from database
    const user = await db.get<User>(
      'SELECT access_level FROM users WHERE id = ?',
      [session.user.id]
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        accessLevel: user.access_level,
        userId: session.user.id,
        timestamp: Date.now() // Add timestamp to prevent any caching
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  } catch (error) {
    console.error('Error fetching access level:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
