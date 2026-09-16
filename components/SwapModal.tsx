
/**
 * Shift Swap Modal - v1.0.1
 */
import React, { useState } from 'react';
import { ShiftEntry, PersonName } from '../types';
import { validateSwap } from '../utils/scheduler';
import { AlertCircle, Check, X } from 'lucide-react';

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ShiftEntry[];
  currentUser: PersonName;
  staffList: PersonName[];
  onRequest: (date: string, shiftType: 'Day' | 'Night', targetPerson: PersonName) => void;
}

export const SwapModal: React.FC<SwapModalProps> = ({ 
  isOpen, onClose, schedule, currentUser, staffList, onRequest 
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<'Day' | 'Night'>('Day');
  const [targetPerson, setTargetPerson] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = () => {
    setError(null);
    if (!selectedDate || !targetPerson) {
      setError('لطفا تاریخ و شخص جایگزین را انتخاب کنید.');
      return;
    }

    // Validation
    const validation = validateSwap(schedule, selectedDate, targetPerson, selectedShift);
    if (!validation.valid) {
      setError(validation.reason || 'امکان جابجایی وجود ندارد.');
      return;
    }

    onRequest(selectedDate, selectedShift, targetPerson);
    onClose();
  };

  // Filter schedule to days where current user works
  const myShifts = schedule.filter(s => 
    (selectedShift === 'Day' && (s.dayShiftPerson === currentUser || (s.extraDayPersons && s.extraDayPersons.includes(currentUser)))) || 
    (selectedShift === 'Night' && (s.nightShiftPerson === currentUser || (s.extraNightPersons && s.extraNightPersons.includes(currentUser))))
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-900">درخواست جابجایی شیفت</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">نوع شیفت من</label>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                className={`flex-1 py-1 text-sm rounded-md transition font-bold ${selectedShift === 'Day' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-800'}`}
                onClick={() => setSelectedShift('Day')}
              >
                روز
              </button>
              <button 
                className={`flex-1 py-1 text-sm rounded-md transition font-bold ${selectedShift === 'Night' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-800'}`}
                onClick={() => setSelectedShift('Night')}
              >
                شب
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">انتخاب تاریخ</label>
            <select 
              className="w-full bg-white text-slate-900 font-medium border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            >
              <option value="">انتخاب کنید...</option>
              {myShifts.map(s => (
                <option key={s.id} value={s.date}>{s.dayName} - {s.date}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">درخواست جابجایی با</label>
            <select 
              className="w-full bg-white text-slate-900 font-medium border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              value={targetPerson}
              onChange={(e) => setTargetPerson(e.target.value)}
            >
              <option value="">انتخاب همکار...</option>
              {staffList.filter(n => n !== currentUser).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2 font-medium">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button 
              onClick={onClose}
              className="flex-1 py-2 text-slate-700 bg-slate-100 rounded-lg text-sm font-bold hover:bg-slate-200"
            >
              انصراف
            </button>
            <button 
              onClick={handleSubmit}
              className="flex-1 py-2 text-white bg-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-700 flex justify-center items-center gap-2 shadow-md"
            >
              <Check size={16} />
              ثبت درخواست
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
