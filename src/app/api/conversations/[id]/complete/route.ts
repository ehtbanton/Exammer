import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import { summarizeConversation, createEmbeddingText } from '@/ai/flows/summarize-conversation';
import { generateEmbedding } from '@/ai/flows/generate-embedding';

export const dynamic = 'force-dynamic';

// POST /api/conversations/[id]/complete - End a conversation and generate summary + embedding
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

    const { finalScore, completedObjectives } = await req.json();

    // Verify conversation exists and belongs to user
    const conversation = await db.get<{
      id: number;
      user_id: number;
      question_id: number;
      ended_at: number | null;
    }>(
      'SELECT id, user_id, question_id, ended_at FROM conversations WHERE id = ?',
      [conversationId]
    );

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.user_id !== parseInt(user.id as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (conversation.ended_at) {
      return NextResponse.json({ error: 'Conversation has already ended' }, { status: 400 });
    }

    // Get question details
    const question = await db.get<{
      question_text: string;
      topic_name: string;
      solution_objectives: string;
    }>(
      `SELECT q.question_text, t.name as topic_name, q.solution_objectives
       FROM questions q
       JOIN topics t ON q.topic_id = t.id
       WHERE q.id = ?`,
      [conversation.question_id]
    );

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Get conversation messages
    const messages = await db.all<{ role: string; content: string }>(
      `SELECT role, content FROM conversation_messages
       WHERE conversation_id = ? ORDER BY created_at ASC`,
      [conversationId]
    );

    // If no messages stored, create a minimal message list for summarization
    const messagesForSummary = messages.length > 0
      ? messages
      : [{ role: 'assistant', content: `Interview on: ${question.question_text}` }];

    // completedObjectives is already an array of objective text strings from the client
    const objectivesList: string[] = completedObjectives || [];

    // Generate summary
    let summary = null;
    let embeddingJson = null;

    try {
      const summaryResult = await summarizeConversation({
        questionText: question.question_text,
        questionTopic: question.topic_name,
        messages: messagesForSummary.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        finalScore,
        completedObjectives: objectivesList,
      }, user.id.toString());

      summary = JSON.stringify(summaryResult);

      // Generate embedding from summary
      const embeddingText = createEmbeddingText(
        summaryResult,
        question.topic_name,
        question.question_text
      );

      const embeddingResult = await generateEmbedding({ text: embeddingText });
      embeddingJson = JSON.stringify(embeddingResult.embedding);
    } catch (error) {
      console.error('Error generating summary/embedding:', error);
      // Continue without summary - we can regenerate later
    }

    // Update conversation with end time, score, summary, and embedding
    await db.run(
      `UPDATE conversations
       SET ended_at = unixepoch(), final_score = ?, summary = ?, summary_embedding = ?
       WHERE id = ?`,
      [finalScore || 0, summary, embeddingJson, conversationId]
    );

    return NextResponse.json({
      id: conversationId,
      endedAt: Math.floor(Date.now() / 1000),
      finalScore: finalScore || 0,
      summary: summary ? JSON.parse(summary) : null,
      hasEmbedding: !!embeddingJson,
    });
  } catch (error: any) {
    console.error('Error completing conversation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete conversation' },
      { status: 500 }
    );
  }
}
