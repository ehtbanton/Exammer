import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Gets background color class for a score (0-100%)
 * Bold traffic-light color scale (Red -> Amber -> Green) with black text
 */
export function getScoreColorClass(score: number): string {
  const clampedScore = Math.max(0, Math.min(100, score));

  // Bold red for low scores (0-33%)
  if (clampedScore <= 10) return 'bg-red-500 border-red-700 text-black';
  if (clampedScore <= 20) return 'bg-red-400 border-red-600 text-black';
  if (clampedScore <= 33) return 'bg-red-300 border-red-500 text-black';

  // Bold amber/yellow for medium scores (34-66%)
  if (clampedScore <= 44) return 'bg-orange-400 border-orange-600 text-black';
  if (clampedScore <= 55) return 'bg-amber-400 border-amber-600 text-black';
  if (clampedScore <= 66) return 'bg-yellow-400 border-yellow-600 text-black';

  // Bold green for high scores (67-100%)
  if (clampedScore <= 77) return 'bg-lime-500 border-lime-700 text-black';
  if (clampedScore <= 88) return 'bg-green-400 border-green-600 text-black';
  return 'bg-green-500 border-green-700 text-black';
}

/**
 * Gets default darker grey class for boxes without any questions
 */
export function getDefaultBoxClass(): string {
  return 'bg-gray-400 border-gray-500 text-black';
}

/**
 * Gets inviting light grey class for unattempted questions/topics/papers
 */
export function getUnattemptedBoxClass(): string {
  return 'bg-gray-100 border-gray-300 text-black';
}

/**
 * Gets inline style for a score (0-100%)
 * Bold traffic-light color scale (Red -> Amber -> Green)
 */
export function getScoreColorStyle(score: number): React.CSSProperties {
  const clampedScore = Math.max(0, Math.min(100, score));

  // Bold red for low scores (0-33%)
  if (clampedScore <= 10) {
    return { backgroundColor: 'rgb(239, 68, 68)', borderColor: 'rgb(185, 28, 28)', color: 'rgb(0, 0, 0)' }; // red-500, red-700
  } else if (clampedScore <= 20) {
    return { backgroundColor: 'rgb(248, 113, 113)', borderColor: 'rgb(220, 38, 38)', color: 'rgb(0, 0, 0)' }; // red-400, red-600
  } else if (clampedScore <= 33) {
    return { backgroundColor: 'rgb(252, 165, 165)', borderColor: 'rgb(239, 68, 68)', color: 'rgb(0, 0, 0)' }; // red-300, red-500
  }
  // Bold amber/yellow for medium scores (34-66%)
  else if (clampedScore <= 44) {
    return { backgroundColor: 'rgb(251, 146, 60)', borderColor: 'rgb(234, 88, 12)', color: 'rgb(0, 0, 0)' }; // orange-400, orange-600
  } else if (clampedScore <= 55) {
    return { backgroundColor: 'rgb(251, 191, 36)', borderColor: 'rgb(217, 119, 6)', color: 'rgb(0, 0, 0)' }; // amber-400, amber-600
  } else if (clampedScore <= 66) {
    return { backgroundColor: 'rgb(250, 204, 21)', borderColor: 'rgb(202, 138, 4)', color: 'rgb(0, 0, 0)' }; // yellow-400, yellow-600
  }
  // Bold green for high scores (67-100%)
  else if (clampedScore <= 77) {
    return { backgroundColor: 'rgb(132, 204, 22)', borderColor: 'rgb(77, 124, 15)', color: 'rgb(0, 0, 0)' }; // lime-500, lime-700
  } else if (clampedScore <= 88) {
    return { backgroundColor: 'rgb(74, 222, 128)', borderColor: 'rgb(22, 163, 74)', color: 'rgb(0, 0, 0)' }; // green-400, green-600
  } else {
    return { backgroundColor: 'rgb(34, 197, 94)', borderColor: 'rgb(21, 128, 61)', color: 'rgb(0, 0, 0)' }; // green-500, green-700
  }
}

/**
 * Gets default darker grey style for boxes without any questions
 */
export function getDefaultBoxStyle(): React.CSSProperties {
  return { backgroundColor: 'rgb(156, 163, 175)', borderColor: 'rgb(107, 114, 128)', color: 'rgb(0, 0, 0)' }; // gray-400, gray-500
}

/**
 * Gets inviting light grey style for unattempted questions/topics/papers
 */
export function getUnattemptedBoxStyle(): React.CSSProperties {
  return { backgroundColor: 'rgb(243, 244, 246)', borderColor: 'rgb(209, 213, 219)', color: 'rgb(0, 0, 0)' }; // gray-100, gray-300
}

/**
 * Generates a random 6-character classroom code
 * Uses only uppercase letters and numbers, excluding easily confused characters (0, O, I, 1, l)
 * Example: ABC2D3, XYZ4K8, etc.
 */
export function generateClassroomCode(): string {
  // Exclude easily confused characters: 0, O, I, 1
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  return code;
}
