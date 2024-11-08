export interface AttendanceRecord {
  date: string;
  present: boolean;
  type: 'office' | 'remote' | 'absent';
  note?: string;
}

export interface Holiday {
  date: string;
  name: string;
  type: 'public' | 'personal';
}

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type Period = 'monthly' | 'quarterly' | 'yearly';

export interface QuarterInfo {
  name: Quarter;
  months: number[];
  label: string;
}

export const QUARTERS: QuarterInfo[] = [
  { name: 'Q1', months: [2, 3, 4], label: 'February - April' },
  { name: 'Q2', months: [5, 6, 7], label: 'May - July' },
  { name: 'Q3', months: [8, 9, 10], label: 'August - October' },
  { name: 'Q4', months: [11, 12, 1], label: 'November - January' }
];