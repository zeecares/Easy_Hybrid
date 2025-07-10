// React import removed - using JSX transform
import { format, isWithinInterval, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, isSameDay, isAfter, isBefore } from 'date-fns';
import { BarChart3, Calendar as CalendarIcon, Target } from 'lucide-react';
import type { AttendanceRecord, Holiday, QuarterInfo, Period } from '../types/attendance';

interface QuarterlyStatsProps {
  attendance: AttendanceRecord[];
  holidays: Holiday[];
  quarters: QuarterInfo[];
  currentDate: Date;
  targetRate: number;
  selectedPeriod: Period;
  onTargetChange: (rate: number) => void;
}

const getQuarterDates = (date: Date) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  
  // Q4 spans across years (Nov-Jan)
  if (month === 11 || month === 12) {
    return {
      start: new Date(year, 10, 1), // November
      end: new Date(year + 1, 0, 31) // January next year
    };
  } else if (month === 1) {
    return {
      start: new Date(year - 1, 10, 1), // November previous year
      end: new Date(year, 0, 31) // January current year
    };
  }
  
  // For other quarters
  const quarterIndex = Math.floor((month - 2) / 3);
  if (quarterIndex >= 0 && quarterIndex < 3) {
    const startMonth = quarterIndex * 3 + 1;
    return {
      start: new Date(year, startMonth, 1),
      end: new Date(year, startMonth + 2, 31)
    };
  }
  
  return null;
};

export function QuarterlyStats({ 
  attendance, 
  holidays, 
  quarters, 
  currentDate,
  targetRate,
  selectedPeriod,
  onTargetChange
}: QuarterlyStatsProps) {
  // Calculate quarter-to-date percentage up to last month
  const calculateUpToLastMonth = () => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    
    // Get the previous month
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? today.getFullYear() - 1 : today.getFullYear();
    
    // Get quarter dates for current date
    const quarterDates = getQuarterDates(currentDate);
    if (!quarterDates) return null;
    
    // Calculate end of last month
    const lastDayOfLastMonth = new Date(lastMonthYear, lastMonth, 0);
    
    // Only calculate if last month is within the current quarter
    if (lastDayOfLastMonth < quarterDates.start) {
      return null; // Last month is before current quarter started
    }
    
    const periodEnd = lastDayOfLastMonth < quarterDates.end ? lastDayOfLastMonth : quarterDates.end;
    
    // Calculate workdays from quarter start to end of last month
    const allDays = eachDayOfInterval({ start: quarterDates.start, end: periodEnd });
    const workdays = allDays.filter(date => {
      const isHoliday = holidays.some(h => isSameDay(new Date(h.date), date));
      const isSat = format(date, 'E') === 'Sat';
      const isSun = format(date, 'E') === 'Sun';
      return !isHoliday && !isSat && !isSun;
    });
    
    // Calculate office days in this period
    const officeDays = attendance.filter(record => {
      const recordDate = new Date(record.date);
      return record.present && 
             isWithinInterval(recordDate, { start: quarterDates.start, end: periodEnd });
    }).length;
    
    const percentage = workdays.length > 0 ? (officeDays / workdays.length) * 100 : 0;
    
    return {
      monthName: format(new Date(lastMonthYear, lastMonth - 1, 1), 'MMMM'),
      year: lastMonthYear,
      percentage,
      officeDays,
      workdays: workdays.length
    };
  };
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
      default: {
        const quarterDates = getQuarterDates(currentDate);
        if (!quarterDates) {
          start = startOfMonth(currentDate);
          end = endOfMonth(currentDate);
        } else {
          start = quarterDates.start;
          end = quarterDates.end;
        }
      }
    }
    
    const allDays = eachDayOfInterval({ start, end });
    
    const totalWorkdays = allDays.filter(date => {
      const isHoliday = holidays.some(h => isSameDay(new Date(h.date), date));
      const isSat = format(date, 'E') === 'Sat';
      const isSun = format(date, 'E') === 'Sun';
      return !isHoliday && !isSat && !isSun;
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
      presentDays
    };
  };

  const calculateCurrentProgress = () => {
    let start: Date;
    let end: Date;
    const today = new Date();
    
    switch (selectedPeriod) {
      case 'monthly':
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
        break;
      case 'yearly':
        start = startOfYear(currentDate);
        end = endOfYear(currentDate);
        break;
      case 'quarterly':
      default: {
        const quarterDates = getQuarterDates(currentDate);
        if (!quarterDates) {
          start = startOfMonth(currentDate);
          end = endOfMonth(currentDate);
        } else {
          start = quarterDates.start;
          end = quarterDates.end;
        }
      }
    }

    const daysUntilToday = eachDayOfInterval({ 
      start, 
      end: isBefore(today, end) ? today : end 
    });
    
    const workdaysUntilToday = daysUntilToday.filter(date => {
      const isHoliday = holidays.some(h => isSameDay(new Date(h.date), date));
      const isSat = format(date, 'E') === 'Sat';
      const isSun = format(date, 'E') === 'Sun';
      return !isHoliday && !isSat && !isSun;
    }).length;

    const presentDays = attendance.filter(record => {
      const date = new Date(record.date);
      return record.present && 
             isWithinInterval(date, { start, end }) &&
             !isAfter(date, today);
    }).length;

    return {
      workdaysUntilToday,
      presentDays,
      rate: workdaysUntilToday ? (presentDays / workdaysUntilToday) * 100 : 0
    };
  };

  const isCurrentPeriod = () => {
    const today = new Date();
    switch (selectedPeriod) {
      case 'monthly':
        return today.getMonth() === currentDate.getMonth() && 
               today.getFullYear() === currentDate.getFullYear();
      case 'yearly':
        return today.getFullYear() === currentDate.getFullYear();
      case 'quarterly': {
        const quarterDates = getQuarterDates(currentDate);
        if (!quarterDates) return false;
        return isWithinInterval(today, { start: quarterDates.start, end: quarterDates.end });
      }
      default:
        return false;
    }
  };

  const getPeriodText = () => {
    switch (selectedPeriod) {
      case 'monthly':
        return 'month';
      case 'yearly':
        return 'year';
      default:
        return 'quarter';
    }
  };

  const stats = calculateStats(selectedPeriod);
  const currentProgress = calculateCurrentProgress();
  const showCurrentProgress = isCurrentPeriod();
  const targetMet = stats.presentDays >= stats.requiredDays;
  const currentQuarter = quarters.find(q => q.months.includes(currentDate.getMonth() + 1));
  const periodLabel = selectedPeriod === 'monthly' ? format(currentDate, 'MMMM') : 
                     selectedPeriod === 'yearly' ? format(currentDate, 'yyyy') :
                     currentQuarter?.name || 'Q1';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-6 h-6 text-indigo-600" />
        <h2 className="text-2xl font-semibold">Quarterly Statistics</h2>
      </div>
      
      <div className="space-y-6">
        {/* Main Current Progress - Top Focus */}
        {showCurrentProgress && (
          <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-xl border border-indigo-100">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xl font-semibold text-indigo-900">Progress So Far</span>
              <span className="text-4xl font-bold text-indigo-600">
                {currentProgress.rate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-white rounded-full h-4 mb-3">
              <div 
                className="bg-indigo-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(currentProgress.rate, 100)}%` }}
              />
            </div>
            <div className="text-sm text-indigo-700">
              {currentProgress.presentDays} days in office out of {currentProgress.workdaysUntilToday} workdays so far
            </div>
            <div className="text-xs text-indigo-600 mt-1">
              Total workdays this quarter: {stats.totalWorkdays} (excluding weekends & holidays)
            </div>
          </div>
        )}

        {/* Q2 Progress Section */}
        <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-xl border border-indigo-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              <span className="font-medium text-indigo-900">Target Rate</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={targetRate}
                onChange={(e) => onTargetChange(Math.min(100, Math.max(1, Number(e.target.value))))}
                className="w-16 px-2 py-1 text-sm border rounded bg-white"
              />
              <span className="text-sm text-indigo-600">%</span>
            </div>
          </div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="text-lg font-medium text-indigo-900">{periodLabel} Progress</span>
              {selectedPeriod === 'quarterly' && currentQuarter && (
                <span className="text-sm text-gray-500 block">{currentQuarter.label}</span>
              )}
            </div>
            <span className="text-2xl font-bold text-indigo-600">
              {stats.presentDays} out of {stats.requiredDays} days
            </span>
          </div>
          
          <div className="w-full bg-white rounded-full h-3 mb-3">
            <div 
              className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((stats.presentDays / stats.requiredDays) * 100, 100)}%` }}
            />
          </div>
        </div>
        
        {/* Up to Last Month Section */}
        {(() => {
          const upToLastMonthData = calculateUpToLastMonth();
          return upToLastMonthData ? (
            <div className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-xl border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-medium text-gray-900">
                  Up to {upToLastMonthData.monthName} {upToLastMonthData.year}
                </span>
                <span className="text-2xl font-bold text-gray-700">
                  {upToLastMonthData.percentage.toFixed(1)}%
                </span>
              </div>
              
              <div className="w-full bg-white rounded-full h-2 mb-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    upToLastMonthData.percentage >= targetRate ? 'bg-green-500' : 'bg-gray-500'
                  }`}
                  style={{ width: `${Math.min(upToLastMonthData.percentage, 100)}%` }}
                />
              </div>
              
              <div className="text-xs text-gray-600">
                {upToLastMonthData.officeDays} days in office of {upToLastMonthData.workdays} workdays
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Compare with your company monthly report
              </div>
            </div>
          ) : null;
        })()}
        


        {targetMet ? (
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg font-medium text-green-900">🎉 Target Achieved!</span>
            </div>
            <div className="text-sm text-green-800">
              Congratulations! You've met your {targetRate}% target for this {getPeriodText()}.
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CalendarIcon className="w-5 h-5 text-amber-600" />
              <span className="text-lg font-medium text-amber-900">Days Needed</span>
            </div>
            <div className="text-3xl font-bold text-amber-600 mb-1">
              {Math.max(0, stats.requiredDays - stats.presentDays)}
            </div>
            <div className="text-sm text-amber-800">
              more days needed this {getPeriodText()} to reach your {targetRate}% target
            </div>
          </div>
        )}

      </div>
    </div>
  );
}