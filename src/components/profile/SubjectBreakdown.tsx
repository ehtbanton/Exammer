"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getScoreColorClass } from "@/lib/utils";

interface Topic {
  id: number;
  name: string;
  questionsAttempted: number;
  questionsMastered: number;
  totalQuestions: number;
  avgScore: number | null;
}

interface PaperType {
  id: number;
  name: string;
  topics: Topic[];
}

interface Subject {
  id: number;
  name: string;
  questionsAttempted: number;
  questionsMastered: number;
  totalQuestions: number;
  avgScore: number | null;
  masteryPercent: number;
  paperTypes: PaperType[];
}

interface SubjectBreakdownProps {
  subjects: Subject[];
}

export function SubjectBreakdown({ subjects }: SubjectBreakdownProps) {
  if (subjects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No subjects enrolled yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground mb-4">Subject Breakdown</h2>

      <Accordion type="multiple" className="w-full">
        {subjects.map((subject) => (
          <AccordionItem key={subject.id} value={`subject-${subject.id}`}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">{subject.name}</span>
                  {subject.avgScore !== null && (
                    <Badge className={getScoreColorClass(subject.avgScore)}>
                      {subject.avgScore}%
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{subject.questionsMastered}/{subject.totalQuestions} mastered</span>
                  <span className="font-medium">{subject.masteryPercent}%</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pl-4">
                {subject.paperTypes.map((paperType) => (
                  <div key={paperType.id} className="space-y-3">
                    <h4 className="font-medium text-foreground border-b pb-1">
                      {paperType.name}
                    </h4>
                    <div className="space-y-2">
                      {paperType.topics.map((topic) => {
                        const masteryPercent = topic.totalQuestions > 0
                          ? Math.round((topic.questionsMastered / topic.totalQuestions) * 100)
                          : 0;

                        return (
                          <div key={topic.id} className="flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium truncate text-foreground">
                                  {topic.name}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>
                                    {topic.questionsMastered}/{topic.totalQuestions}
                                  </span>
                                  {topic.avgScore !== null && (
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${getScoreColorClass(topic.avgScore)}`}
                                    >
                                      {topic.avgScore}%
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Progress value={masteryPercent} className="h-2" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
