/**
 * Tizi App — Dark gym-style theme constants.
 */

export const Colors = {
  // Gym-style dark palette
  background: '#0A0A0F',       // near-black background
  surface: '#13131A',          // card / panel surface
  surfaceAlt: '#1C1C27',       // slightly lighter surface
  border: '#2A2A3A',           // subtle borders
  primary: '#E8FF3D',          // electric lime — primary accent
  primaryDark: '#C4D900',      // darker lime for pressed states
  secondary: '#FF4D4D',        // red accent for alerts / active states
  text: '#FFFFFF',             // primary text
  textSecondary: '#9B9BAA',    // muted text
  textMuted: '#5A5A72',        // very muted text
  tabBar: '#0F0F18',           // bottom tab bar background
  tabActive: '#E8FF3D',        // active tab icon/label
  tabInactive: '#4A4A60',      // inactive tab icon/label
  headerBg: '#0A0A0F',         // screen header background
  success: '#4CFF91',          // green success
  warning: '#FFA940',          // amber warning
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radii = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  full: 9999,
};

export const Typography = {
  // Font sizes
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 36,

  // Font weights (as string literals for RN compatibility)
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  black: '900' as const,

  // Letter spacing
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
};
