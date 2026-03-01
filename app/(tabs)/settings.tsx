import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';

const PROFILE = {
  name: 'Ron',
  email: 'ron@tizi.app',
  plan: 'PPL — 6 days/week',
  goal: 'Strength & Hypertrophy',
};

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  last = false,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {onPress ? <Text style={styles.rowChevron}>›</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
  last = false,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={Colors.text}
        ios_backgroundColor={Colors.border}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [metric, setMetric] = useState(true);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Settings</Text>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>R</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{PROFILE.name}</Text>
            <Text style={styles.profileEmail}>{PROFILE.email}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <SettingsSection title="TRAINING">
          <SettingsRow label="Current Plan" value={PROFILE.plan} onPress={() => {}} />
          <SettingsRow label="Goal" value={PROFILE.goal} onPress={() => {}} />
          <SettingsRow label="Rest Timer" value="90 sec" onPress={() => {}} last />
        </SettingsSection>

        <SettingsSection title="PREFERENCES">
          <ToggleRow
            label="Push Notifications"
            value={notifications}
            onToggle={() => setNotifications((v) => !v)}
          />
          <ToggleRow
            label="Workout Reminders"
            value={reminders}
            onToggle={() => setReminders((v) => !v)}
          />
          <ToggleRow
            label="Haptic Feedback"
            value={haptics}
            onToggle={() => setHaptics((v) => !v)}
          />
          <ToggleRow
            label="Use Metric (kg)"
            value={metric}
            onToggle={() => setMetric((v) => !v)}
            last
          />
        </SettingsSection>

        <SettingsSection title="DATA">
          <SettingsRow label="Export Data" onPress={() => {}} />
          <SettingsRow label="Backup to Cloud" value="On" onPress={() => {}} />
          <SettingsRow label="Clear All Data" onPress={() => {}} last />
        </SettingsSection>

        <SettingsSection title="ABOUT">
          <SettingsRow label="Version" value="1.0.0" />
          <SettingsRow label="Privacy Policy" onPress={() => {}} />
          <SettingsRow label="Terms of Service" onPress={() => {}} last />
        </SettingsSection>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { padding: Spacing.md },

  pageTitle: {
    fontSize: Typography.xxl,
    color: Colors.text,
    fontWeight: Typography.black,
    letterSpacing: Typography.tight,
    marginBottom: Spacing.lg,
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { fontSize: Typography.xl, fontWeight: Typography.black, color: Colors.background },
  profileInfo: { flex: 1 },
  profileName: { fontSize: Typography.lg, color: Colors.text, fontWeight: Typography.bold },
  profileEmail: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  editBtn: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  editBtnText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },

  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wider,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowLabel: { fontSize: Typography.md, color: Colors.text, fontWeight: Typography.regular },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  rowValue: { fontSize: Typography.sm, color: Colors.textSecondary },
  rowChevron: { fontSize: Typography.xl, color: Colors.textMuted },

  signOutBtn: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  signOutText: {
    color: Colors.secondary,
    fontWeight: Typography.semibold,
    fontSize: Typography.md,
  },
});
