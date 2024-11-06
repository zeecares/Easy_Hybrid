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
}

export const QUARTERS: QuarterInfo[] = [
  { name: 'Q1', months: [1, 2, 3] },
  { name: 'Q2', months: [4, 5, 6] },
  { name: 'Q3', months: [7, 8, 9] },
  { name: 'Q4', months: [10, 11, 12] }
];