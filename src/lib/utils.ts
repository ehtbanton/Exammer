import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Gets background color class for a score (0-100%)
 * Red-amber-green scale changing smoothly every 10%
 */
export function getScoreColorClass(score: number): string {
  const clampedScore = Math.max(0, Math.min(100, score));

  // Using inline styles instead of classes for dynamic colors
  if (clampedScore === 0) return 'bg-red-100 border-red-300';
  if (clampedScore <= 10) return 'bg-red-50 border-red-200';
  if (clampedScore <= 20) return 'bg-orange-50 border-orange-200';
  if (clampedScore <= 30) return 'bg-orange-100 border-orange-300';
  if (clampedScore <= 40) return 'bg-amber-50 border-amber-200';
  if (clampedScore <= 50) return 'bg-amber-100 border-amber-300';
  if (clampedScore <= 60) return 'bg-yellow-50 border-yellow-200';
  if (clampedScore <= 70) return 'bg-lime-50 border-lime-200';
  if (clampedScore <= 80) return 'bg-lime-100 border-lime-300';
  if (clampedScore <= 90) return 'bg-green-50 border-green-200';
  return 'bg-green-100 border-green-300';
}

/**
 * Gets inline style for a score (0-100%)
 * Red-amber-green scale changing smoothly
 */
export function getScoreColorStyle(score: number): React.CSSProperties {
  const clampedScore = Math.max(0, Math.min(100, score));

  if (clampedScore === 0) {
    return { backgroundColor: 'rgb(254, 226, 226)', borderColor: 'rgb(252, 165, 165)' }; // red-100, red-300
  } else if (clampedScore <= 10) {
    return { backgroundColor: 'rgb(254, 242, 242)', borderColor: 'rgb(254, 202, 202)' }; // red-50, red-200
  } else if (clampedScore <= 20) {
    return { backgroundColor: 'rgb(255, 247, 237)', borderColor: 'rgb(254, 215, 170)' }; // orange-50, orange-200
  } else if (clampedScore <= 30) {
    return { backgroundColor: 'rgb(255, 237, 213)', borderColor: 'rgb(253, 186, 116)' }; // orange-100, orange-300
  } else if (clampedScore <= 40) {
    return { backgroundColor: 'rgb(255, 251, 235)', borderColor: 'rgb(253, 230, 138)' }; // amber-50, amber-200
  } else if (clampedScore <= 50) {
    return { backgroundColor: 'rgb(254, 243, 199)', borderColor: 'rgb(252, 211, 77)' }; // amber-100, amber-300
  } else if (clampedScore <= 60) {
    return { backgroundColor: 'rgb(254, 252, 232)', borderColor: 'rgb(254, 240, 138)' }; // yellow-50, yellow-200
  } else if (clampedScore <= 70) {
    return { backgroundColor: 'rgb(247, 254, 231)', borderColor: 'rgb(217, 249, 157)' }; // lime-50, lime-200
  } else if (clampedScore <= 80) {
    return { backgroundColor: 'rgb(236, 252, 203)', borderColor: 'rgb(190, 242, 100)' }; // lime-100, lime-300
  } else if (clampedScore <= 90) {
    return { backgroundColor: 'rgb(240, 253, 244)', borderColor: 'rgb(187, 247, 208)' }; // green-50, green-200
  }
  return { backgroundColor: 'rgb(220, 252, 231)', borderColor: 'rgb(134, 239, 172)' }; // green-100, green-300
}
