import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { analyzeBreakthroughConnection } from '@/ai/flows/analyze-breakthrough-connection';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { subjectId, breakthroughTitle, breakthroughSummary, breakthroughSource } = body;

    if (!subjectId || !breakthroughTitle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get subject info
    const subject = await db.get<{
      id: number;
      name: string;
      field_classification: string | null;
    }>('SELECT id, name, field_classification FROM subjects WHERE id = ?', [subjectId]);

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // Parse field classification
    let field = 'General';
    let subfield = 'General';
    let level = 'Undergraduate';

    if (subject.field_classification) {
      try {
        const classification = JSON.parse(subject.field_classification);
        field = classification.field || field;
        subfield = classification.subfield || subfield;
        level = classification.level || level;
      } catch {
        // Use defaults
      }
    }

    // Get topics for this subject
    const topics = await db.all<{ name: string; description: string | null }[]>(`
      SELECT DISTINCT t.name, t.description
      FROM topics t
      JOIN paper_types pt ON t.paper_type_id = pt.id
      WHERE pt.subject_id = ?
    `, [subjectId]);

    const topicNames = topics.map(t => t.name);
    const topicDescriptions = topics.map(t => ({
      name: t.name,
      description: t.description || undefined,
    }));

    // Analyze the connection
    const analysis = await analyzeBreakthroughConnection({
      breakthroughTitle,
      breakthroughSummary,
      breakthroughSource,
      field,
      subfield,
      level,
      topicNames,
      topicDescriptions,
    });

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error analyzing breakthrough connection:', error);
    return NextResponse.json(
      { error: 'Failed to analyze connection' },
      { status: 500 }
    );
  }
}
