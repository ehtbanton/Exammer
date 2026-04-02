"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Target, BookOpen, Flame, Calendar, TrendingUp } from "lucide-react";
import { getScoreColorClass } from "@/lib/utils";

interface SummaryCardsProps {
  summary: {
    questionsAttempted: number;
    questionsMastered: number;
    avgScore: number | null;
    subjectsCount: number;
    totalStudyDays: number;
    currentStreak: number;
    longestStreak: number;
  };
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const masteryRate = summary.questionsAttempted > 0
    ? Math.round((summary.questionsMastered / summary.questionsAttempted) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Dominadas</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {summary.questionsMastered}
          </div>
          <p className="text-xs text-muted-foreground">
            preguntas (80%+)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Intentadas</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {summary.questionsAttempted}
          </div>
          <p className="text-xs text-muted-foreground">
            preguntas totales
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Promedio</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.avgScore !== null ? (
              <span className={`inline-block px-2 py-0.5 rounded ${getScoreColorClass(summary.avgScore)}`}>
                {summary.avgScore}%
              </span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {masteryRate}% tasa de dominio
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cursos</CardTitle>
          <BookOpen className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {summary.subjectsCount}
          </div>
          <p className="text-xs text-muted-foreground">
            inscritos
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Racha</CardTitle>
          <Flame className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {summary.currentStreak}
          </div>
          <p className="text-xs text-muted-foreground">
            días (mejor: {summary.longestStreak})
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Días de Estudio</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {summary.totalStudyDays}
          </div>
          <p className="text-xs text-muted-foreground">
            días activos en total
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
