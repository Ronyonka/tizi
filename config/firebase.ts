/**
 * Firestore collection name constants.
 * Import these wherever you need to reference a collection
 * to avoid typos and make refactoring easier.
 */
export const COLLECTIONS = {
  exercises: 'exercises',
  routines: 'routines',
  routineExercises: 'routine_exercises',
  logs: 'logs',
  settings: 'settings',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
