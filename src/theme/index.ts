import { useColorScheme } from 'react-native';

export interface Palette {
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  track: string;
  // Chart colors validated for color-blind separation (blue/orange, violet/amber).
  chart: { income: string; expense: string; fixed: string; variable: string; grid: string; reference: string };
}

const light: Palette = {
  bg: '#F5F6FA',
  card: '#FFFFFF',
  cardAlt: '#EEF0F7',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  primary: '#4338CA',
  primarySoft: '#E0E7FF',
  onPrimary: '#FFFFFF',
  success: '#15803D',
  successSoft: '#DCFCE7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  info: '#0369A1',
  infoSoft: '#E0F2FE',
  track: '#E5E7EB',
  chart: { income: '#2A78D6', expense: '#EB6834', fixed: '#6250D6', variable: '#EDA100', grid: '#E2E8F0', reference: '#94A3B8' },
};

const dark: Palette = {
  bg: '#0B1020',
  card: '#151B2E',
  cardAlt: '#1D2540',
  text: '#F1F5F9',
  muted: '#94A3B8',
  border: '#27304A',
  primary: '#818CF8',
  primarySoft: '#272F5C',
  onPrimary: '#0B1020',
  success: '#4ADE80',
  successSoft: '#123222',
  danger: '#F87171',
  dangerSoft: '#3B1717',
  warning: '#FBBF24',
  warningSoft: '#3A2A0B',
  info: '#38BDF8',
  infoSoft: '#0C2A3B',
  track: '#2A3350',
  chart: { income: '#3987E5', expense: '#D95926', fixed: '#9085E9', variable: '#C98500', grid: '#27304A', reference: '#64748B' },
};

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };
