"use client";

import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DailyActivity {
  date: string;
  count: number;
}

interface ActivityHeatmapProps {
  activity: DailyActivity[];
}

export function ActivityHeatmap({ activity }: ActivityHeatmapProps) {
  const { weeks, maxCount, totalContributions } = useMemo(() => {
    // Create a map for quick lookup
    const activityMap = new Map<string, number>();
    let total = 0;
    let max = 0;

    for (const a of activity) {
      activityMap.set(a.date, a.count);
      total += a.count;
      max = Math.max(max, a.count);
    }

    // Generate the last 365 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weeks: Array<Array<{ date: Date; count: number; dateStr: string }>> = [];
    let currentWeek: Array<{ date: Date; count: number; dateStr: string }> = [];

    // Start from 364 days ago
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);

    // Adjust to start from a Sunday
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDay);

    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const count = activityMap.get(dateStr) || 0;

      currentWeek.push({
        date: new Date(d),
        count,
        dateStr,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Push remaining days
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return { weeks, maxCount: max, totalContributions: total };
  }, [activity]);

  const getColorClass = (count: number) => {
    if (count === 0) return "bg-muted";
    if (maxCount === 0) return "bg-muted";

    const intensity = count / maxCount;
    if (intensity <= 0.25) return "bg-green-200 dark:bg-green-900";
    if (intensity <= 0.5) return "bg-green-400 dark:bg-green-700";
    if (intensity <= 0.75) return "bg-green-500 dark:bg-green-600";
    return "bg-green-600 dark:bg-green-500";
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const months = useMemo(() => {
    const monthLabels: Array<{ label: string; weekIndex: number }> = [];
    let lastMonth = -1;

    weeks.forEach((week, weekIndex) => {
      const firstDay = week[0];
      if (firstDay) {
        const month = firstDay.date.getMonth();
        if (month !== lastMonth) {
          monthLabels.push({
            label: firstDay.date.toLocaleDateString("en-GB", { month: "short" }),
            weekIndex,
          });
          lastMonth = month;
        }
      }
    });

    return monthLabels;
  }, [weeks]);

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Activity</h2>
        <span className="text-sm text-muted-foreground">
          {totalContributions} contributions in the last year
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Month labels */}
          <div className="flex mb-1 text-xs text-muted-foreground">
            <div className="w-8" /> {/* Spacer for day labels */}
            {months.map((m, i) => (
              <div
                key={i}
                className="text-left"
                style={{
                  position: "relative",
                  left: `${m.weekIndex * 14}px`,
                  marginRight: i < months.length - 1 ? "-14px" : 0,
                }}
              >
                {m.label}
              </div>
            ))}
          </div>

          <div className="flex">
            {/* Day labels */}
            <div className="flex flex-col justify-around text-xs text-muted-foreground pr-2 py-0.5">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>

            {/* Grid */}
            <TooltipProvider delayDuration={100}>
              <div className="flex gap-0.5">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-0.5">
                    {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                      const day = week[dayIndex];
                      if (!day) {
                        return (
                          <div
                            key={dayIndex}
                            className="w-3 h-3 rounded-sm bg-transparent"
                          />
                        );
                      }

                      return (
                        <Tooltip key={dayIndex}>
                          <TooltipTrigger asChild>
                            <div
                              className={`w-3 h-3 rounded-sm cursor-pointer transition-colors ${getColorClass(
                                day.count
                              )}`}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">
                              {day.count} question{day.count !== 1 ? "s" : ""} on{" "}
                              {formatDate(day.date)}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </TooltipProvider>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-1 mt-2 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="w-3 h-3 rounded-sm bg-muted" />
            <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900" />
            <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700" />
            <div className="w-3 h-3 rounded-sm bg-green-500 dark:bg-green-600" />
            <div className="w-3 h-3 rounded-sm bg-green-600 dark:bg-green-500" />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
