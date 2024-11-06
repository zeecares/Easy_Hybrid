import React from 'react';
import { format, isWithinInterval, startOfQuarter, endOfQuarter, startOfMonth, endOfMonth, startOfYear, endOfYear, isWeekend, eachDayOfInterval, isSameDay } from 'date-fns';
import { BarChart3, Calendar as CalendarIcon, Settings } from 'lucide-react';
import type { AttendanceRecord, Holiday, QuarterInfo, Period } from '../types/attendance';

interface QuarterlyStatsProps {
  attendance: AttendanceRecord[];
  holidays: Holiday[];
  quarters: QuarterInfo[];
  currentDate: Date;
  targetRate: number;
  selectedPeriod: Period;
  onTargetChange: (rate: number) => void;
  onPeriodChange: (period: Period) => void;
}

export function QuarterlyStats({ 
  attendance, 
  holidays, 
  quarters, 
  currentDate,
  targetRate,
  selectedPeriod,
  onTargetChange,
  onPeriodChange
}: QuarterlyStatsProps) {
  const calculateStats = (period: Period) => {
    let start: Date;
    let end: Date;
    
    switch (period) {
      case 'monthly':
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
        break;
      case 'yearly':
        start = startOfYear(currentDate);
        end = endOfYear(currentDate);
        break;
      case 'quarterly':
      default:
        start = startOfQuarter(currentDate);
        end = endOfQuarter(currentDate);
    }
    
    const allDays = eachDayOfInterval({ start, end });
    
    const totalWorkdays = allDays.filter(date => {
      const isHoliday = holidays.some(h => isSameDay(new Date(h.date), date));
      const isSat = format(date, 'E') === 'Sat';
      const isSun = format(date, 'E') === 'Sun';
      return !isSameDay(date, new Date()) && !isHoliday && !isSat && !isSun;
    }).length;

    const presentDays = attendance.filter(record => {
      const date = new Date(record.date);
      return record.present && 
             isWithinInterval(date, { start, end });
    }).length;

    const requiredDays = Math.ceil(totalWorkdays * (targetRate / 100));

    return {
      totalWorkdays,
      requiredDays,
      presentDays,
      rate: totalWorkdays ? (presentDays / requiredDays) * 100 : 0
    };
  };

  const stats = calculateStats(selectedPeriod);
  const periodLabel = selectedPeriod === 'monthly' ? format(currentDate, 'MMMM') : 
                     selectedPeriod === 'yearly' ? format(currentDate, 'yyyy') :
                     quarters.find(q => q.months.includes(currentDate.getMonth() + 1))?.name || 'Q1';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          <h2 className="text-2xl font-semibold">Statistics</h2>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedPeriod}
            onChange={(e) => onPeriodChange(e.target.value as Period)}
            className="text-sm border rounded-md px-2 py-1"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" />
            <input
              type="number"
              min="1"
              max="100"
              value={targetRate}
              onChange={(e) => onTargetChange(Math.min(100, Math.max(1, Number(e.target.value))))}
              className="w-16 px-2 py-1 text-sm border rounded"
            />
            <span className="text-sm text-gray-500">% target</span>
          </div>
        </div>
      </div>
      
      <div className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-medium">{periodLabel} Progress</span>
            <span className="text-2xl font-bold text-indigo-600">
              {stats.rate.toFixed(1)}%
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(stats.rate, 100)}%` }}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Days Present</div>
            <div className="text-xl font-semibold">{stats.presentDays}</div>
            <div className="text-xs text-gray-400 mt-1">of {stats.requiredDays} required</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Total Workdays</div>
            <div className="text-xl font-semibold">{stats.totalWorkdays}</div>
            <div className="text-xs text-gray-400 mt-1">excluding weekends & holidays</div>
          </div>
        </div>

        <div className="bg-indigo-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CalendarIcon className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-600">{periodLabel} Target</span>
          </div>
          <div className="text-sm text-indigo-800">
            Target: {targetRate}% of workdays in office
          </div>
          <div className="text-xs text-indigo-600 mt-1">
            {Math.max(0, stats.requiredDays - stats.presentDays)} more days needed this {selectedPeriod.slice(0, -2)}
          </div>
        </div>
      </div>
    </div>
  );
}