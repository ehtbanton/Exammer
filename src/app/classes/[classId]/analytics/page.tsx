"use client";

import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Users, Target, TrendingUp, Award } from 'lucide-react';
import { toast } from 'sonner';
import { getScoreColorClass } from '@/lib/utils';

interface AnalyticsData {
  students: StudentStats[];
  topicAverages: TopicAverage[];
  overallStats: OverallStats;
}

interface StudentStats {
  user_id: number;
  name: string;
  email: string;
  averageScore: number;
  questionsAttempted: number;
  totalQuestions: number;
  completionRate: number;
}

interface TopicAverage {
  subject_id: number;
  subject_name: string;
  paper_type_id: number;
  paper_type_name: string;
  topic_id: number;
  topic_name: string;
  average_score: number;
  attempts_count: number;
  total_students: number;
}

interface OverallStats {
  totalStudents: number;
  averageScore: number;
  totalQuestions: number;
  completionRate: number;
}

export default function ClassAnalyticsPage({ params }: { params: Promise<{ classId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const classId = parseInt(resolvedParams.classId);

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [classId]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/classes/${classId}/analytics`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else if (response.status === 403) {
        toast.error('You do not have access to this class analytics');
        router.push('/classes');
      } else {
        toast.error('Failed to load analytics');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Analytics not available</h1>
          <Button className="mt-4" onClick={() => router.push(`/classes/${classId}`)}>
            Back to Class
          </Button>
        </div>
      </div>
    );
  }

  // Group topics by subject and paper type
  const groupedTopics = analytics.topicAverages.reduce((acc, topic) => {
    const key = `${topic.subject_id}-${topic.paper_type_id}`;
    if (!acc[key]) {
      acc[key] = {
        subject_name: topic.subject_name,
        paper_type_name: topic.paper_type_name,
        topics: []
      };
    }
    acc[key].topics.push(topic);
    return acc;
  }, {} as Record<string, { subject_name: string; paper_type_name: string; topics: TopicAverage[] }>);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push(`/classes/${classId}`)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Class
        </Button>

        <h1 className="text-3xl font-bold mb-2">Class Analytics</h1>
        <p className="text-muted-foreground">
          Performance metrics and insights for your class
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overallStats.totalStudents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.overallStats.averageScore.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overallStats.totalQuestions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.overallStats.completionRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Performance Table */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Student Performance</CardTitle>
          <CardDescription>Individual student statistics and progress</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No student data available yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Average Score</TableHead>
                  <TableHead className="text-right">Questions Attempted</TableHead>
                  <TableHead className="text-right">Total Questions</TableHead>
                  <TableHead className="text-right">Completion Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.students
                  .sort((a, b) => b.averageScore - a.averageScore)
                  .map((student) => (
                    <TableRow key={student.user_id}>
                      <TableCell className="font-medium">
                        {student.name || 'Unnamed User'}
                      </TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell className="text-right">
                        <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${getScoreColorClass(student.averageScore)}`}>
                          {student.averageScore.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{student.questionsAttempted}</TableCell>
                      <TableCell className="text-right">{student.totalQuestions}</TableCell>
                      <TableCell className="text-right">
                        {student.completionRate.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Topic Averages */}
      <Card>
        <CardHeader>
          <CardTitle>Topic Performance</CardTitle>
          <CardDescription>Average scores across topics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.keys(groupedTopics).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No topic data available yet
            </div>
          ) : (
            Object.values(groupedTopics).map((group, idx) => (
              <div key={idx}>
                <h3 className="font-semibold mb-3">
                  {group.subject_name} - {group.paper_type_name}
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead className="text-right">Average Score</TableHead>
                      <TableHead className="text-right">Students Attempted</TableHead>
                      <TableHead className="text-right">Participation Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.topics.map((topic) => (
                      <TableRow key={topic.topic_id}>
                        <TableCell className="font-medium">{topic.topic_name}</TableCell>
                        <TableCell className="text-right">
                          <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${getScoreColorClass(topic.average_score)}`}>
                            {topic.average_score.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {topic.attempts_count} / {topic.total_students}
                        </TableCell>
                        <TableCell className="text-right">
                          {((topic.attempts_count / topic.total_students) * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
