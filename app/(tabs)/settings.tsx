import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { NotificationService } from '@/services/notifications';
import { Storage } from '@/services/storage';

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
  showChevron = true,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  showChevron?: boolean;
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
        {onPress && showChevron ? <Text style={styles.rowChevron}>›</Text> : null}
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
  onToggle: (v: boolean) => void;
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
  const [reminderTime, setReminderTime] = useState('08:00');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const enabled = await Storage.getNotificationsEnabled();
    const time = await Storage.getReminderTime();
    const sid = await Storage.getSpreadsheetId();
    setNotifications(enabled);
    setReminderTime(time);
    setSpreadsheetId(sid || '');
  };

  const syncNotifications = async (enabled: boolean, time: string) => {
    if (!enabled) {
      await NotificationService.cancelAll();
      return;
    }

    const hasPermission = await NotificationService.requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Please enable notifications in your phone settings.');
      setNotifications(false);
      await Storage.setNotificationsEnabled(false);
      return;
    }

    try {
      // Fetch routines to schedule (using current spreadsheetId if any)
      const res = await fetch('/api/routines', {
        headers: spreadsheetId ? { 'x-spreadsheet-id': spreadsheetId } : {},
      });
      const routines = await res.json();
      
      if (Array.isArray(routines)) {
        await NotificationService.scheduleWorkoutReminder(time, routines);
      }
    } catch (error) {
      console.error('Failed to sync notifications:', error);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    setNotifications(value);
    await Storage.setNotificationsEnabled(value);
    await syncNotifications(value, reminderTime);
  };

  const handleTimeChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      setReminderTime(timeString);
      Storage.setReminderTime(timeString);
      syncNotifications(notifications, timeString);
    }
  };

  const handleSpreadsheetIdChange = (text: string) => {
    const cleanId = text.trim();
    setSpreadsheetId(cleanId);
    Storage.setSpreadsheetId(cleanId || null);
  };

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/test-sheets', {
        headers: spreadsheetId ? { 'x-spreadsheet-id': spreadsheetId } : {},
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Connection to Google Sheets successful!');
      } else {
        Alert.alert('Failed', data.message || 'Could not connect to Google Sheets.');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while testing connection.');
    } finally {
      setIsTesting(false);
    }
  };

  const pickerDate = new Date();
  const [hStr, mStr] = reminderTime.split(':');
  pickerDate.setHours(parseInt(hStr, 10), parseInt(mStr, 10));

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
        </View>

        <SettingsSection title="NOTIFICATIONS">
          <ToggleRow
            label="Daily Reminders"
            value={notifications}
            onToggle={handleToggleNotifications}
          />
          <SettingsRow 
            label="Reminder Time" 
            value={reminderTime} 
            onPress={() => setShowTimePicker(true)}
            last 
          />
          {showTimePicker && (
            <DateTimePicker
              value={pickerDate}
              mode="time"
              is24Hour={true}
              onChange={handleTimeChange}
            />
          )}
        </SettingsSection>

        <SettingsSection title="GOOGLE SHEETS CONFIG">
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Spreadsheet ID</Text>
            <TextInput
              style={styles.input}
              value={spreadsheetId}
              onChangeText={handleSpreadsheetIdChange}
              placeholder="Enter Spreadsheet ID"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.inputHint}>
              Leave empty to use the default system spreadsheet.
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.testBtn} 
            onPress={testConnection}
            disabled={isTesting}
          >
            {isTesting ? (
              <ActivityIndicator color={Colors.background} size="small" />
            ) : (
              <Text style={styles.testBtnText}>Test Connection</Text>
            )}
          </TouchableOpacity>
        </SettingsSection>

        <SettingsSection title="ABOUT">
          <SettingsRow label="Version" value="1.0.0" showChevron={false} />
          <SettingsRow label="Privacy Policy" onPress={() => {}} />
          <SettingsRow label="Terms of Service" onPress={() => {}} last />
        </SettingsSection>

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
    paddingBottom: Spacing.xs,
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

  inputContainer: {
    padding: Spacing.md,
  },
  inputLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.bold,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radii.sm,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: Typography.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputHint: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },

  testBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    margin: Spacing.md,
    marginTop: 0,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  testBtnText: {
    color: Colors.background,
    fontWeight: Typography.bold,
    fontSize: Typography.md,
  },
});
