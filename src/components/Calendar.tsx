import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, addDays } from 'date-fns';
import { Calendar as CalendarIcon, Building2, Palmtree } from 'lucide-react';
import type { AttendanceRecord, Holiday } from '../types/attendance';

interface CalendarProps {
  currentDate: Date;
  attendance: AttendanceRecord[];
  holidays: Holiday[];
  onDateClick: (date: Date) => void;
  onHolidayClick: (date: Date) => void;
}

export function Calendar({ currentDate, attendance, holidays, onDateClick, onHolidayClick }: CalendarProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startWeek = getDay(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const paddingDays = Array.from({ length: startWeek }).map((_, index) => 
    addDays(monthStart, -startWeek + index)
  );

  const allDays = [...paddingDays, ...days];

  const getDateStatus = (date: Date) => {
    const record = attendance.find(a => isSameDay(new Date(a.date), date));
    const holiday = holidays.find(h => isSameDay(new Date(h.date), date));
    return { record, holiday };
  };

  const handleDayClick = (date: Date) => {
    const { record, holiday } = getDateStatus(date);
    
    if (record?.present) {
      onHolidayClick(date);
      onDateClick(date);
    } else if (holiday) {
      onHolidayClick(date);
    } else {
      onDateClick(date);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <CalendarIcon className="w-6 h-6" />
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-200"></div>
            <div className="flex items-center gap-1 text-gray-600">
              <Building2 className="w-4 h-4" />
              <span>In Office</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-100 border border-amber-200"></div>
            <div className="flex items-center gap-1 text-gray-600">
              <Palmtree className="w-4 h-4" />
              <span>Holiday</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
        {allDays.map((day) => {
          const { record, holiday } = getDateStatus(day);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isToday = isSameDay(day, new Date());
          
          return (
            <button
              key={day.toString()}
              onClick={() => isCurrentMonth && handleDayClick(day)}
              className={`
                p-3 rounded-lg relative flex flex-col items-center
                transition-all duration-200
                ${!isCurrentMonth ? 'text-gray-300 cursor-default' : 'hover:shadow-md'}
                ${record?.present ? 'bg-green-100 hover:bg-green-200 border border-green-200' : ''}
                ${holiday ? 'bg-amber-100 hover:bg-amber-200 border border-amber-200' : ''}
                ${isToday ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
                ${isCurrentMonth && !record?.present && !holiday ? 'hover:bg-gray-50 border border-gray-200' : ''}
              `}
              title={`Click once for office presence${!record?.present ? ', twice for holiday' : ''}`}
            >
              <span className="text-sm font-medium">{format(day, 'd')}</span>
            </button>
          );
        })}
      </div>

      <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">
        <p className="flex items-center gap-2">
          <span className="font-medium">💡 Tip:</span>
          Click once to mark office presence, click again to mark as holiday
        </p>
      </div>
    </div>
  );
}