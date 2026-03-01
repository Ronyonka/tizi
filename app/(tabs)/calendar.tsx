import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { getLogs, getRoutines } from '@/services/firestore';

// ─── Types ─────────────────────────────────────────────────────────────────

type DayStatus = 'completed' | 'missed' | 'rest' | 'future' | 'today-rest' | 'today-scheduled';

interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  status: DayStatus;
  isToday: boolean;
  isCurrentMonth: boolean;
}

interface StreakStats {
  current: number;
  longest: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COL_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Returns a YYYY-MM-DD string for a given Date, in local time. */
function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalise any log date string to YYYY-MM-DD.
 * Supports:
 *   ISO-8601:  2026-03-01T... or 2026-03-01
 *   DD/MM/YYYY: 01/03/2026
 */
function normaliseDateString(raw: string): string {
  if (!raw) return '';

  // If it's an ISO string (2026-03-01T22:13:03.000Z), take the first 10 chars
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    return raw.substring(0, 10);
  }

  const trimmed = raw.trim().split(' ')[0]; // drop time portion

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m}-${d}`;
  }

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Fallback
  try {
    const dt = new Date(raw);
    if (!isNaN(dt.getTime())) return toDateKey(dt);
  } catch {
    // ignore
  }
  return trimmed;
}

/**
 * Compute streak stats from the beginning of time to today.
 * Rest days don't break the streak; missed scheduled days do.
 */
function computeStreaks(
  scheduledDays: Set<string>,    // day-of-week names that have routines
  loggedDates: Set<string>,      // YYYY-MM-DD dates that have logs
  earliestDate: Date,
  today: Date
): StreakStats {
  let current = 0;
  let longest = 0;

  const cursor = new Date(earliestDate);
  cursor.setHours(0, 0, 0, 0);
  const todayNorm = new Date(today);
  todayNorm.setHours(0, 0, 0, 0);

  while (cursor <= todayNorm) {
    const dayName = DAY_NAMES[cursor.getDay()];
    const dateKey = toDateKey(cursor);
    const isScheduled = scheduledDays.has(dayName);
    const isLogged = loggedDates.has(dateKey);
    const isPast = cursor < todayNorm;

    if (isLogged) {
      // Completed — streak continues
      current += 1;
    } else if (isPast && isScheduled) {
      // Scheduled but not logged and in the past — missed, reset
      current = 0;
    }
    // Rest days (not scheduled) and current-day-not-yet-logged have NO IMPACT.
    // They don't increment and don't reset.

    if (current > longest) longest = current;
    cursor.setDate(cursor.getDate() + 1);
  }

  return { current, longest };
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const [loading, setLoading] = useState(true);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth()); // 0-based
  const [scheduledDays, setScheduledDays] = useState<Set<string>>(new Set());
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
  const [streaks, setStreaks] = useState<StreakStats>({ current: 0, longest: 0 });

  // ── Fetch data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [routines, rawLogs] = await Promise.all([
        getRoutines(),
        getLogs(),
      ]);

      // Build scheduled-days set (day-of-week names)
      const scheduled = new Set<string>(
        routines.map((r) => r.day_of_week.trim())
      );

      // Build logged-dates set (YYYY-MM-DD)
      const logged = new Set<string>(
        rawLogs.map((l) => normaliseDateString(l.date)).filter(Boolean)
      );

      setScheduledDays(scheduled);
      setLoggedDates(logged);

      // Determine earliest meaningful date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let earliest = new Date(today);
      // Look back at most 3 months for streak calc
      earliest.setMonth(earliest.getMonth() - 3);

      if (logged.size > 0) {
        const sortedDates = Array.from(logged).sort();
        const firstLog = new Date(sortedDates[0]);
        if (!isNaN(firstLog.getTime()) && firstLog < earliest) {
          earliest = firstLog;
        }
      }

      const stats = computeStreaks(scheduled, logged, earliest, today);
      setStreaks(stats);
    } catch (error) {
      console.error('[CalendarScreen] Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Calendar grid builder ────────────────────────────────────────────────
  const buildCalendarDays = (): CalendarDay[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);

    // Monday-first grid: figure out how many leading blanks
    // getDay(): 0=Sun,1=Mon...6=Sat → convert to Mon-first: Mon=0...Sun=6
    const firstDow = (firstOfMonth.getDay() + 6) % 7; // Mon=0

    const days: CalendarDay[] = [];

    // Leading days from previous month
    for (let i = 0; i < firstDow; i++) {
      const d = new Date(firstOfMonth);
      d.setDate(d.getDate() - (firstDow - i));
      days.push(buildDay(d, today, scheduledDays, loggedDates, false));
    }

    // Days of current month
    for (let i = 1; i <= lastOfMonth.getDate(); i++) {
      const d = new Date(viewYear, viewMonth, i);
      days.push(buildDay(d, today, scheduledDays, loggedDates, true));
    }

    // Trailing days to fill 6-row grid (42 cells)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(lastOfMonth);
      d.setDate(d.getDate() + i);
      days.push(buildDay(d, today, scheduledDays, loggedDates, false));
    }

    return days;
  };

  const buildDay = (
    date: Date,
    today: Date,
    scheduled: Set<string>,
    logged: Set<string>,
    isCurrentMonth: boolean
  ): CalendarDay => {
    const isToday = toDateKey(date) === toDateKey(today);
    const isPast = date < today;
    const dayName = DAY_NAMES[date.getDay()];
    const dateKey = toDateKey(date);
    const isScheduled = scheduled.has(dayName);
    const isLogged = logged.has(dateKey);

    let status: DayStatus;
    if (isToday) {
      status = isScheduled ? 'today-scheduled' : 'today-rest';
    } else if (!isCurrentMonth || !isPast) {
      status = 'future';
    } else if (!isScheduled) {
      status = 'rest';
    } else if (isLogged) {
      status = 'completed';
    } else {
      status = 'missed';
    }

    return {
      date,
      dayOfMonth: date.getDate(),
      status,
      isToday,
      isCurrentMonth,
    };
  };

  // ── Month navigation ──────────────────────────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  // ── Status → color ───────────────────────────────────────────────────────
  const statusDotColor = (status: DayStatus): string => {
    switch (status) {
      case 'completed':       return Colors.success;
      case 'missed':          return Colors.secondary;
      case 'rest':            return Colors.surfaceAlt;
      case 'today-scheduled': return Colors.primary;
      case 'today-rest':      return Colors.surfaceAlt;
      default:                return 'transparent';
    }
  };

  const calendarDays = buildCalendarDays();

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const weeksCount = calendarDays.length / 7;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Page header */}
        <Text style={styles.pageTitle}>Calendar</Text>

        {/* Streak stat cards */}
        <View style={styles.streakRow}>
          <View style={[styles.streakCard, styles.streakCardLeft]}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakCount}>{streaks.current}</Text>
            <Text style={styles.streakLabel}>Current Streak</Text>
            <Text style={styles.streakSub}>days</Text>
          </View>
          <View style={[styles.streakCard, styles.streakCardRight]}>
            <Text style={styles.streakEmoji}>🏆</Text>
            <Text style={styles.streakCount}>{streaks.longest}</Text>
            <Text style={styles.streakLabel}>All-time Best</Text>
            <Text style={styles.streakSub}>days</Text>
          </View>
        </View>

        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar grid */}
        <View style={styles.calendarCard}>
          {/* Day-of-week headers */}
          <View style={styles.colHeaders}>
            {COL_HEADERS.map((h) => (
              <View key={h} style={styles.colHeaderCell}>
                <Text style={styles.colHeaderText}>{h}</Text>
              </View>
            ))}
          </View>

          {/* Week rows */}
          {Array.from({ length: weeksCount }).map((_, wi) => (
            <View key={wi} style={styles.weekRow}>
              {calendarDays.slice(wi * 7, wi * 7 + 7).map((day, di) => {
                const dotColor = statusDotColor(day.status);
                const isToday = day.isToday;
                const dim = !day.isCurrentMonth;

                return (
                  <View
                    key={di}
                    style={[
                      styles.dayCell,
                      isToday && styles.dayCellToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        dim && styles.dayNumberDim,
                        isToday && styles.dayNumberToday,
                      ]}
                    >
                      {day.dayOfMonth}
                    </Text>

                    {/* Status dot — only show for current month */}
                    {day.isCurrentMonth && day.status !== 'future' ? (
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: dotColor },
                          day.status === 'rest' && styles.statusDotRest,
                          day.status === 'today-rest' && styles.statusDotRest,
                        ]}
                      />
                    ) : (
                      <View style={styles.statusDotPlaceholder} />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <LegendItem color={Colors.success} label="Completed" />
          <LegendItem color={Colors.secondary} label="Missed" />
          <LegendItem color={Colors.surfaceAlt} label="Rest" borderColor={Colors.border} />
          <LegendItem color={Colors.primary} label="Today" />
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function LegendItem({
  color,
  label,
  borderColor,
}: {
  color: string;
  label: string;
  borderColor?: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          { backgroundColor: color },
          borderColor ? { borderWidth: 1, borderColor } : undefined,
        ]}
      />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { padding: Spacing.md },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Page title
  pageTitle: {
    fontSize: Typography.xxl,
    color: Colors.text,
    fontWeight: Typography.black,
    letterSpacing: Typography.tight,
    marginBottom: Spacing.md,
  },

  // Streak cards
  streakRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  streakCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  streakCardLeft: {
    borderTopColor: Colors.primary,
    borderTopWidth: 2,
  },
  streakCardRight: {
    borderTopColor: Colors.warning,
    borderTopWidth: 2,
  },
  streakEmoji: { fontSize: 22, marginBottom: 4 },
  streakCount: {
    fontSize: Typography.display,
    color: Colors.text,
    fontWeight: Typography.black,
    lineHeight: Typography.display,
  },
  streakLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    letterSpacing: Typography.wider,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  streakSub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },

  // Month nav
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  navBtn: {
    width: 36,
    height: 36,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navArrow: {
    fontSize: 22,
    color: Colors.textSecondary,
    lineHeight: 26,
  },
  monthLabel: {
    fontSize: Typography.lg,
    color: Colors.text,
    fontWeight: Typography.semibold,
  },

  // Calendar card
  calendarCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },

  // Column headers
  colHeaders: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  colHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  colHeaderText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
  },

  // Week rows
  weekRow: {
    flexDirection: 'row',
  },

  // Day cells
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: Radii.sm,
    marginHorizontal: 1,
    marginVertical: 2,
  },
  dayCellToday: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  dayNumber: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: Typography.medium,
  },
  dayNumberDim: {
    color: Colors.textMuted,
    opacity: 0.4,
  },
  dayNumberToday: {
    color: Colors.primary,
    fontWeight: Typography.bold,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: Radii.full,
    marginTop: 3,
  },
  statusDotRest: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  statusDotPlaceholder: {
    width: 6,
    height: 6,
    marginTop: 3,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 3,
  },
  legendText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
});
