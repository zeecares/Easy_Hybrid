import React, { useState, useEffect } from 'react';
import { format, addMonths, subMonths, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Building2, CalendarCheck2 } from 'lucide-react';
import { Calendar } from './components/Calendar';
import { QuarterlyStats } from './components/QuarterlyStats';
import { QuickActions } from './components/QuickActions';
import { QUARTERS } from './types/attendance';
import { ALL_IRISH_HOLIDAYS } from './data/holidays';
import type { AttendanceRecord, Holiday, Period } from './types/attendance';

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('quarterly');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('attendance');
    return saved ? JSON.parse(saved) : [];
  });
  const [holidays, setHolidays] = useState<Holiday[]>(() => {
    const saved = localStorage.getItem('holidays');
    return saved ? JSON.parse(saved) : ALL_IRISH_HOLIDAYS.map(h => ({ ...h, type: 'public' }));
  });
  const [targetRate, setTargetRate] = useState<number>(() => {
    const saved = localStorage.getItem('targetRate');
    return saved ? parseFloat(saved) : 50;
  });

  useEffect(() => {
    localStorage.setItem('attendance', JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem('holidays', JSON.stringify(holidays));
  }, [holidays]);

  useEffect(() => {
    localStorage.setItem('targetRate', targetRate.toString());
  }, [targetRate]);

  const exportData = () => {
    const data = {
      attendance,
      holidays: holidays.filter(h => h.type === 'personal'),
      targetRate,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-data-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          setAttendance(data.attendance);
          const personalHolidays = data.holidays || [];
          const publicHolidays = ALL_IRISH_HOLIDAYS.map(h => ({ ...h, type: 'public' as const }));
          setHolidays([...publicHolidays, ...personalHolidays]);
          setTargetRate(data.targetRate || 50);
        } catch (error) {
          console.error('Error importing data:', error);
          alert('Error importing data. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = attendance.find(a => isSameDay(new Date(a.date), date));

    if (existing) {
      setAttendance(attendance.filter(a => !isSameDay(new Date(a.date), date)));
    } else {
      setAttendance([...attendance, {
        date: dateStr,
        present: true,
        type: 'office'
      }]);
    }
  };

  const handleHolidayClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = holidays.find(h => isSameDay(new Date(h.date), date));

    if (existing) {
      setHolidays(holidays.filter(h => !isSameDay(new Date(h.date), date)));
    } else {
      setHolidays([...holidays, {
        date: dateStr,
        name: 'Personal Holiday',
        type: 'personal'
      }]);
    }
  };

  const handleQuickAction = (present: boolean) => {
    const today = new Date();
    const dateStr = format(today, 'yyyy-MM-dd');
    const existing = attendance.find(a => isSameDay(new Date(a.date), today));

    if (existing) {
      setAttendance(attendance.map(a => 
        isSameDay(new Date(a.date), today) ? { ...a, present } : a
      ));
    } else {
      setAttendance([...attendance, {
        date: dateStr,
        present,
        type: 'office'
      }]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b border-gray-200 pb-6 mb-6">
        <div className="max-w-7xl mx-auto px-4 pt-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Building2 className="w-6 h-6 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Hybrid Work Planner</h1>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <CalendarCheck2 className="w-5 h-5" />
            <p className="text-lg">Balance your remote and office work schedule</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-semibold">
                  {format(currentDate, 'MMMM yyyy')}
                </h2>
                <button
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
              <Calendar
                currentDate={currentDate}
                attendance={attendance}
                holidays={holidays}
                onDateClick={handleDateClick}
                onHolidayClick={handleHolidayClick}
              />
            </div>
            <QuickActions onMarkAttendance={handleQuickAction} />
            
            <div className="flex gap-4">
              <button
                onClick={exportData}
                className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg p-4 transition-colors"
              >
                Export Data
              </button>
              <label className="flex-1">
                <input
                  type="file"
                  accept=".json"
                  onChange={importData}
                  className="hidden"
                />
                <span className="block bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg p-4 text-center cursor-pointer transition-colors">
                  Import Data
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-8">
            <QuarterlyStats
              attendance={attendance}
              holidays={holidays}
              quarters={QUARTERS}
              currentDate={currentDate}
              targetRate={targetRate}
              onTargetChange={setTargetRate}
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;