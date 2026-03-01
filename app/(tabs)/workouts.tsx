import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';

const CATEGORIES = ['All', 'Push', 'Pull', 'Legs', 'Core', 'Cardio'];

const WORKOUTS = [
  {
    id: '1',
    name: 'Push Day A',
    category: 'Push',
    exercises: 6,
    duration: '55 min',
    difficulty: 'Hard',
    difficultyColor: Colors.secondary,
  },
  {
    id: '2',
    name: 'Pull Day A',
    category: 'Pull',
    exercises: 7,
    duration: '60 min',
    difficulty: 'Hard',
    difficultyColor: Colors.secondary,
  },
  {
    id: '3',
    name: 'Leg Day',
    category: 'Legs',
    exercises: 8,
    duration: '70 min',
    difficulty: 'Brutal',
    difficultyColor: '#FF2222',
  },
  {
    id: '4',
    name: 'Core Destroyer',
    category: 'Core',
    exercises: 5,
    duration: '30 min',
    difficulty: 'Medium',
    difficultyColor: Colors.warning,
  },
  {
    id: '5',
    name: 'HIIT Cardio',
    category: 'Cardio',
    exercises: 4,
    duration: '25 min',
    difficulty: 'Medium',
    difficultyColor: Colors.warning,
  },
  {
    id: '6',
    name: 'Push Day B',
    category: 'Push',
    exercises: 6,
    duration: '55 min',
    difficulty: 'Medium',
    difficultyColor: Colors.warning,
  },
  {
    id: '7',
    name: 'Pull Day B',
    category: 'Pull',
    exercises: 6,
    duration: '55 min',
    difficulty: 'Hard',
    difficultyColor: Colors.secondary,
  },
];

export default function WorkoutsScreen() {
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered =
    activeCategory === 'All'
      ? WORKOUTS
      : WORKOUTS.filter((w) => w.category === activeCategory);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Page Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Workouts</Text>
        <TouchableOpacity style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.filterChip, activeCategory === cat && styles.filterChipActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeCategory === cat && styles.filterChipTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Workout List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filtered.map((workout) => (
          <TouchableOpacity key={workout.id} style={styles.workoutCard} activeOpacity={0.7}>
            <View style={styles.workoutLeft}>
              <Text style={styles.workoutName}>{workout.name}</Text>
              <View style={styles.workoutMeta}>
                <Text style={styles.metaText}>{workout.exercises} exercises</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{workout.duration}</Text>
              </View>
            </View>
            <View style={styles.workoutRight}>
              <View
                style={[
                  styles.difficultyBadge,
                  { borderColor: workout.difficultyColor },
                ]}
              >
                <Text style={[styles.difficultyText, { color: workout.difficultyColor }]}>
                  {workout.difficulty}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  pageTitle: {
    fontSize: Typography.xxl,
    color: Colors.text,
    fontWeight: Typography.black,
    letterSpacing: Typography.tight,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  addBtnText: {
    color: Colors.background,
    fontWeight: Typography.bold,
    fontSize: Typography.sm,
  },

  filterRow: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  filterChipTextActive: {
    color: Colors.background,
    fontWeight: Typography.bold,
  },

  list: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.md, gap: Spacing.sm },

  workoutCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  workoutLeft: { flex: 1 },
  workoutName: {
    fontSize: Typography.md,
    color: Colors.text,
    fontWeight: Typography.semibold,
    marginBottom: 4,
  },
  workoutMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  metaText: { fontSize: Typography.sm, color: Colors.textSecondary },
  metaDot: { color: Colors.textMuted },

  workoutRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  difficultyBadge: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  difficultyText: { fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 0.3 },
  chevron: { fontSize: Typography.xl, color: Colors.textMuted },
});
