import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateEmbedding } from '@/ai/flows/generate-embedding';
import { mmrSearch, Document } from '@/lib/search/mmr';

export const dynamic = 'force-dynamic';

interface ConversationRow {
  id: number;
  user_id: number;
  question_id: number;
  started_at: number;
  ended_at: number;
  final_score: number;
  summary: string;
  summary_embedding: string;
  question_summary: string;
  topic_name: string;
  subject_name: string;
}

// POST /api/search - Search conversations using MMR RAG
export async function POST(req: NextRequest) {
  try {
    const { query, userId, limit = 10, lambda = 0.7, threshold = 0.3 } = await req.json();

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Generate embedding for the search query
    const queryEmbeddingResult = await generateEmbedding({ text: query });
    const queryEmbedding = queryEmbeddingResult.embedding;

    // Fetch all conversations with embeddings for the specified user
    const conversations = await db.all<ConversationRow>(
      `SELECT
        c.id,
        c.user_id,
        c.question_id,
        c.started_at,
        c.ended_at,
        c.final_score,
        c.summary,
        c.summary_embedding,
        q.summary as question_summary,
        t.name as topic_name,
        s.name as subject_name
      FROM conversations c
      JOIN questions q ON c.question_id = q.id
      JOIN topics t ON q.topic_id = t.id
      JOIN paper_types pt ON t.paper_type_id = pt.id
      JOIN subjects s ON pt.subject_id = s.id
      WHERE c.user_id = ?
        AND c.ended_at IS NOT NULL
        AND c.summary_embedding IS NOT NULL`,
      [userId]
    );

    if (conversations.length === 0) {
      return NextResponse.json({
        results: [],
        query,
        totalConversations: 0,
      });
    }

    // Convert to Document format for MMR search
    const documents: Document[] = conversations
      .filter(c => c.summary_embedding) // Double-check embedding exists
      .map(c => {
        let embedding: number[];
        try {
          embedding = JSON.parse(c.summary_embedding);
        } catch (e) {
          return null;
        }

        // Parse summary for content display
        let summaryContent = '';
        try {
          const summaryObj = JSON.parse(c.summary);
          summaryContent = summaryObj.summary || '';
        } catch (e) {
          summaryContent = c.summary || '';
        }

        return {
          id: c.id,
          embedding,
          content: summaryContent,
          metadata: {
            questionId: c.question_id,
            questionSummary: c.question_summary,
            topicName: c.topic_name,
            subjectName: c.subject_name,
            finalScore: c.final_score,
            startedAt: c.started_at,
            endedAt: c.ended_at,
          },
        };
      })
      .filter((d): d is Document => d !== null);

    // Perform MMR search
    const searchResults = mmrSearch(
      queryEmbedding,
      documents,
      Math.min(limit, 20), // Cap at 20 results
      lambda,
      threshold
    );

    // Format results for response
    const results = searchResults.map(result => ({
      conversationId: result.id,
      summary: result.content,
      relevanceScore: Math.round(result.relevance * 100) / 100,
      mmrScore: Math.round(result.score * 100) / 100,
      ...result.metadata,
    }));

    return NextResponse.json({
      results,
      query,
      totalConversations: conversations.length,
      searchParams: { limit, lambda, threshold },
    });
  } catch (error: any) {
    console.error('Error performing search:', error);
    return NextResponse.json(
      { error: error.message || 'Search failed' },
      { status: 500 }
    );
  }
}
