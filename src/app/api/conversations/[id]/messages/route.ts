import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// POST /api/conversations/[id]/messages - Add a message to a conversation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const conversationId = parseInt(id);

    if (isNaN(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
    }

    const { role, content, imageUrl } = await req.json();

    if (!role || !content) {
      return NextResponse.json({ error: 'Role and content are required' }, { status: 400 });
    }

    if (!['user', 'assistant'].includes(role)) {
      return NextResponse.json({ error: 'Role must be "user" or "assistant"' }, { status: 400 });
    }

    // Verify conversation exists and belongs to user
    const conversation = await db.get<{ id: number; user_id: number; ended_at: number | null }>(
      'SELECT id, user_id, ended_at FROM conversations WHERE id = ?',
      [conversationId]
    );

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (conversation.ended_at) {
      return NextResponse.json({ error: 'Conversation has already ended' }, { status: 400 });
    }

    // Insert message
    const result = await db.run(
      `INSERT INTO conversation_messages (conversation_id, role, content, image_url, created_at)
       VALUES (?, ?, ?, ?, unixepoch())`,
      [conversationId, role, content, imageUrl || null]
    );

    return NextResponse.json({
      id: result.lastID,
      conversationId,
      role,
      content,
      imageUrl: imageUrl || null,
      createdAt: Math.floor(Date.now() / 1000),
    });
  } catch (error: any) {
    console.error('Error adding message:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add message' },
      { status: 500 }
    );
  }
}

// GET /api/conversations/[id]/messages - Get messages for a conversation
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const conversationId = parseInt(id);

    if (isNaN(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
    }

    // Verify conversation exists and belongs to user
    const conversation = await db.get<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM conversations WHERE id = ?',
      [conversationId]
    );

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const messages = await db.all(
      `SELECT id, role, content, image_url, created_at
       FROM conversation_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`,
      [conversationId]
    );

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
