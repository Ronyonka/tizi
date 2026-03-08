/**
 * Shared muscle group colour palette.
 * Imported by workouts.tsx and the session detail screen.
 */

import { Colors } from '@/constants/theme';

export const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Legs', 'Quads', 'Hamstrings', 'Glutes', 'Calves',
  'Core', 'Abs', 'Cardio', 'Full Body', 'Other',
];

export const MUSCLE_COLORS: Record<string, string> = {
  Chest: '#FF6B6B',
  Back: '#4ECDC4',
  Shoulders: '#45B7D1',
  Biceps: '#96CEB4',
  Triceps: '#88D8B0',
  Legs: '#FFEAA7',
  Quads: '#DDA0DD',
  Hamstrings: '#F0E68C',
  Glutes: '#FFB347',
  Calves: '#87CEEB',
  Core: '#98FB98',
  Abs: '#7DCEA0',
  Cardio: '#FF4D4D',
  'Full Body': Colors.primary,
  Other: Colors.textSecondary,
};

export function getMuscleColor(group: string): string {
  return MUSCLE_COLORS[group] ?? Colors.textSecondary;
}
