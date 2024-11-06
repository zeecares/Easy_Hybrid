import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface QuickActionsProps {
  onMarkAttendance: (present: boolean) => void;
}

export function QuickActions({ onMarkAttendance }: QuickActionsProps) {
  return (
    <button
      onClick={() => onMarkAttendance(true)}
      className="w-full bg-green-500 hover:bg-green-600 text-white rounded-lg p-4 flex items-center justify-center gap-2 transition-colors"
    >
      <CheckCircle2 className="w-5 h-5" />
      <span>Mark Today's Attendance</span>
    </button>
  );
}