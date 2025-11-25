import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generatePathway } from '@/ai/flows/generate-pathway';

// POST - Generate new pathway
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID
    const user = await db.get<{ id: number }>(
      'SELECT id FROM users WHERE email = ?',
      [session.user.email]
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { sessionId, replanReason, replanReasonType } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required field: sessionId' },
        { status: 400 }
      );
    }

    // Verify user owns this session
    const careerSession = await db.get<{
      user_id: number;
      current_year_group: string | null;
      current_school: string | null;
      target_application_year: number | null;
      use_exammer_data: number;
      cv_parsed_data: string | null;
    }>(
      'SELECT user_id, current_year_group, current_school, target_application_year, use_exammer_data, cv_parsed_data FROM career_sessions WHERE id = ?',
      [sessionId]
    );

    if (!careerSession || careerSession.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Session not found or unauthorized' },
        { status: 403 }
      );
    }

    // Get goal
    const goal = await db.get<{
      id: number;
      university_name: string;
      course_name: string;
      entry_requirements: string | null;
      required_subjects: string | null;
    }>(
      'SELECT id, university_name, course_name, entry_requirements, required_subjects FROM career_goals WHERE session_id = ?',
      [sessionId]
    );

    if (!goal) {
      return NextResponse.json(
        { error: 'No goal set for this session' },
        { status: 400 }
      );
    }

    // Parse required subjects
    let requiredSubjects: string[] = [];
    if (goal.required_subjects) {
      try {
        requiredSubjects = JSON.parse(goal.required_subjects);
      } catch (e) {
        requiredSubjects = [];
      }
    }

    // Parse CV data
    let cvData;
    if (careerSession.cv_parsed_data) {
      try {
        cvData = JSON.parse(careerSession.cv_parsed_data);
      } catch (e) {
        cvData = undefined;
      }
    }

    // Get weak topics if Exammer data is enabled
    let weakTopics;
    if (careerSession.use_exammer_data) {
      try {
        const performanceResponse = await fetch(
          `${process.env.NEXTAUTH_URL}/api/careers/performance?sessionId=${sessionId}`,
          {
            headers: {
              Cookie: req.headers.get('cookie') || '',
            },
          }
        );
        if (performanceResponse.ok) {
          const performanceData = await performanceResponse.json();
          weakTopics = performanceData.weakTopics;
        }
      } catch (e) {
        console.error('Error fetching performance data:', e);
      }
    }

    // Get interests from brainstorming
    let interests: string[] = [];
    const brainstormNodes = await db.all<{ label: string; is_root: number }>(
      'SELECT label, is_root FROM brainstorm_nodes WHERE session_id = ?',
      [sessionId]
    );
    if (brainstormNodes.length > 0) {
      interests = brainstormNodes
        .filter(n => n.is_root === 0)
        .map(n => n.label);
    }

    // Generate pathway with AI
    const pathway = await generatePathway({
      universityName: goal.university_name,
      courseName: goal.course_name,
      entryRequirements: goal.entry_requirements || undefined,
      requiredSubjects,
      currentYearGroup: careerSession.current_year_group || undefined,
      currentSchool: careerSession.current_school || undefined,
      targetApplicationYear: careerSession.target_application_year || new Date().getFullYear() + 2,
      weakTopics,
      cvData,
      interests: interests.length > 0 ? interests : undefined,
    });

    // Store pathway in database
    const pathwayResult = await db.run(
      `INSERT INTO pathways (
        goal_id,
        title,
        overview_summary,
        application_timeline,
        created_at
      ) VALUES (?, ?, ?, ?, unixepoch())`,
      [
        goal.id,
        pathway.pathwayTitle,
        pathway.overviewSummary,
        JSON.stringify(pathway.applicationTimeline),
      ]
    );

    const pathwayId = pathwayResult.lastID;

    // Store milestones
    for (const milestone of pathway.milestones) {
      await db.run(
        `INSERT INTO pathway_milestones (
          pathway_id,
          month,
          title,
          description,
          category,
          priority,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [
          pathwayId,
          milestone.month,
          milestone.title,
          milestone.description,
          milestone.category,
          milestone.priority,
        ]
      );
    }

    // Store subject grade targets
    for (const target of pathway.subjectGradeTargets) {
      await db.run(
        `INSERT INTO subject_grade_targets (
          pathway_id,
          subject_name,
          current_level,
          target_grade,
          key_focus_areas
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          pathwayId,
          target.subjectName,
          target.currentLevel || null,
          target.targetGrade,
          JSON.stringify(target.keyFocusAreas),
        ]
      );
    }

    // Store extracurricular recommendations as special milestones
    for (const activity of pathway.extracurriculars) {
      await db.run(
        `INSERT INTO pathway_milestones (
          pathway_id,
          month,
          title,
          description,
          category,
          priority,
          status
        ) VALUES (?, ?, ?, ?, 'extracurricular', ?, 'pending')`,
        [
          pathwayId,
          'Ongoing',
          activity.activity,
          `${activity.reasoning}\nTime commitment: ${activity.timeCommitment}`,
          activity.priority === 'high' ? 'essential' : activity.priority === 'medium' ? 'important' : 'optional',
        ]
      );
    }

    // Store replanning history if this is a replan
    if (replanReason) {
      await db.run(
        `INSERT INTO pathway_regeneration_history (
          goal_id,
          old_pathway_id,
          new_pathway_id,
          reason,
          reason_type,
          regenerated_at
        ) VALUES (?, ?, ?, ?, ?, unixepoch())`,
        [
          goal.id,
          null, // We don't track old pathway ID in this simple implementation
          pathwayId,
          replanReason,
          replanReasonType || 'other',
        ]
      );
    }

    return NextResponse.json({
      pathwayId,
      pathway,
      message: replanReason ? 'Pathway replanned successfully' : 'Pathway generated successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error generating pathway:', error);
    return NextResponse.json(
      { error: 'Failed to generate pathway' },
      { status: 500 }
    );
  }
}

// GET - Retrieve pathway for a goal
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID
    const user = await db.get<{ id: number }>(
      'SELECT id FROM users WHERE email = ?',
      [session.user.email]
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required parameter: sessionId' },
        { status: 400 }
      );
    }

    // Verify user owns this session
    const careerSession = await db.get<{ user_id: number }>(
      'SELECT user_id FROM career_sessions WHERE id = ?',
      [sessionId]
    );

    if (!careerSession || careerSession.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Session not found or unauthorized' },
        { status: 403 }
      );
    }

    // Get goal
    const goal = await db.get<{ id: number }>(
      'SELECT id FROM career_goals WHERE session_id = ?',
      [sessionId]
    );

    if (!goal) {
      return NextResponse.json({ pathway: null });
    }

    // Get pathway
    const pathway = await db.get(
      `SELECT
        id,
        title,
        overview_summary,
        application_timeline,
        created_at
      FROM pathways
      WHERE goal_id = ?
      ORDER BY created_at DESC
      LIMIT 1`,
      [goal.id]
    );

    if (!pathway) {
      return NextResponse.json({ pathway: null });
    }

    // Get milestones
    const milestones = await db.all(
      `SELECT
        id,
        month,
        title,
        description,
        category,
        priority,
        status,
        completed_at
      FROM pathway_milestones
      WHERE pathway_id = ?
      ORDER BY
        CASE
          WHEN month = 'Ongoing' THEN 1
          ELSE 0
        END,
        id ASC`,
      [pathway.id]
    );

    // Get subject grade targets
    const subjectTargets = await db.all(
      `SELECT
        id,
        subject_name,
        current_level,
        target_grade,
        key_focus_areas
      FROM subject_grade_targets
      WHERE pathway_id = ?`,
      [pathway.id]
    );

    return NextResponse.json({
      pathway: {
        ...pathway,
        milestones,
        subjectTargets,
      },
    });
  } catch (error) {
    console.error('Error fetching pathway:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pathway' },
      { status: 500 }
    );
  }
}
