import React, { useState, useEffect } from 'react';
import { ShiftEntry } from '../types';
import { Users, UserPlus, X, Sun, Moon, Calendar, Check, Info } from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';

interface MultiPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ShiftEntry[];
  shiftWorkers: string[];
  initialDate?: string;
  onAddExtraPerson: (id: number, shiftType: 'Day' | 'Night', personName: string) => void;
  onRemoveExtraPerson: (id: number, shiftType: 'Day' | 'Night', personName: string) => void;
}

export const MultiPersonModal: React.FC<MultiPersonModalProps> = ({
  isOpen,
  onClose,
  schedule,
  shiftWorkers,
  initialDate,
  onAddExtraPerson,
  onRemoveExtraPerson,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    } else if (schedule.length > 0 && !selectedDate) {
      setSelectedDate(schedule[0].date);
    }
  }, [initialDate, schedule]);

  if (!isOpen) return null;

  const currentEntry = schedule.find(s => s.date === selectedDate) || schedule[0];
  if (!currentEntry) return null;

  // Find all days in the current schedule that have extra persons
  const multiDays = schedule.filter(
    s => (s.extraDayPersons && s.extraDayPersons.length > 0) || 
         (s.extraNightPersons && s.extraNightPersons.length > 0)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 dir-rtl">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-violet-800 text-white p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <UserPlus size={22} className="text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">تنظیم شیفت چندنفره (۲ یا ۳ نفره)</h3>
                <span className="bg-amber-400 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                  جدید
                </span>
              </div>
              <p className="text-xs text-indigo-100/80 mt-0.5">
                افزودن یا حذف همکاران کمکی برای شیفت‌های روز و شب
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/15 p-1.5 rounded-xl transition cursor-pointer"
            title="بستن"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          
          {/* 1. Date Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar size={15} className="text-indigo-600" />
                <span>انتخاب تاریخ برای تنظیم:</span>
              </label>
              <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-lg">
                {currentEntry.dayName} - {toPersianDigits(currentEntry.date)}
              </span>
            </div>

            <select
              id="select-multi-person-modal-date"
              className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            >
              {schedule.map(s => {
                const totalInDay = (s.extraDayPersons?.length || 0) + (s.extraNightPersons?.length || 0);
                const suffix = totalInDay > 0 ? ` ⭐ [${toPersianDigits(totalInDay + 2)} نفره]` : '';
                return (
                  <option key={s.id} value={s.date}>
                    {s.dayName} - {toPersianDigits(s.date)}{suffix}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 2. Shift Cards (Day & Night) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Day Shift */}
            <div className="bg-white border-2 border-amber-200 rounded-xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-amber-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <Sun size={16} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-slate-800">شیفت روز</h4>
                    <span className="text-[10px] text-amber-700 font-bold">۰۸:۰۰ الی ۱۹:۰۰</span>
                  </div>
                </div>
                <span className="text-[11px] font-black bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md">
                  {toPersianDigits((currentEntry.extraDayPersons?.length || 0) + 1)} نفر حاضر
                </span>
              </div>

              {/* Members List */}
              <div className="space-y-2 min-h-[75px]">
                {/* Primary Person */}
                <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200 px-2.5 py-1.5 rounded-lg text-xs">
                  <span className="font-bold text-slate-800">{currentEntry.dayShiftPerson}</span>
                  <span className="text-[10px] font-black bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-md">
                    نفر اصلی
                  </span>
                </div>

                {/* Extra Persons */}
                {currentEntry.extraDayPersons && currentEntry.extraDayPersons.length > 0 ? (
                  currentEntry.extraDayPersons.map((person, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between bg-orange-50 border border-orange-200/90 px-2.5 py-1.5 rounded-lg text-xs animate-in fade-in"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-orange-950">{person}</span>
                        <span className="text-[10px] font-black bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded-md">
                          {idx === 0 ? 'نفر دوم' : 'نفر سوم'}
                        </span>
                      </div>
                      <button
                        onClick={() => onRemoveExtraPerson(currentEntry.id, 'Day', person)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-md transition"
                        title="حذف از شیفت"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))
                ) : null}
              </div>

              {/* Add Day Extra Person Dropdown */}
              {(!currentEntry.extraDayPersons || currentEntry.extraDayPersons.length < 2) ? (
                <div className="pt-2 border-t border-slate-100">
                  <select
                    className="w-full bg-slate-50 hover:bg-white text-slate-800 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none transition cursor-pointer"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        onAddExtraPerson(currentEntry.id, 'Day', e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="" disabled>+ افزودن همکار کمکی به روز...</option>
                    {shiftWorkers
                      .filter(p => p !== currentEntry.dayShiftPerson && !(currentEntry.extraDayPersons || []).includes(p))
                      .map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))
                    }
                  </select>
                </div>
              ) : (
                <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md text-center font-bold">
                  حداکثر ظرفیت (۳ نفر) تکمیل است
                </div>
              )}
            </div>

            {/* Night Shift */}
            <div className="bg-white border-2 border-indigo-200 rounded-xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Moon size={16} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-slate-800">شیفت شب</h4>
                    <span className="text-[10px] text-indigo-700 font-bold">۱۹:۰۰ الی ۰۸:۰۰</span>
                  </div>
                </div>
                <span className="text-[11px] font-black bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-md">
                  {toPersianDigits((currentEntry.extraNightPersons?.length || 0) + 1)} نفر حاضر
                </span>
              </div>

              {/* Members List */}
              <div className="space-y-2 min-h-[75px]">
                {/* Primary Person */}
                <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-200 px-2.5 py-1.5 rounded-lg text-xs">
                  <span className="font-bold text-slate-800">{currentEntry.nightShiftPerson}</span>
                  <span className="text-[10px] font-black bg-indigo-200/80 text-indigo-950 px-2 py-0.5 rounded-md">
                    نفر اصلی
                  </span>
                </div>

                {/* Extra Persons */}
                {currentEntry.extraNightPersons && currentEntry.extraNightPersons.length > 0 ? (
                  currentEntry.extraNightPersons.map((person, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between bg-slate-50 border border-indigo-200/90 px-2.5 py-1.5 rounded-lg text-xs animate-in fade-in"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-indigo-950">{person}</span>
                        <span className="text-[10px] font-black bg-indigo-200 text-indigo-900 px-1.5 py-0.5 rounded-md">
                          {idx === 0 ? 'نفر دوم' : 'نفر سوم'}
                        </span>
                      </div>
                      <button
                        onClick={() => onRemoveExtraPerson(currentEntry.id, 'Night', person)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-md transition"
                        title="حذف از شیفت"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))
                ) : null}
              </div>

              {/* Add Night Extra Person Dropdown */}
              {(!currentEntry.extraNightPersons || currentEntry.extraNightPersons.length < 2) ? (
                <div className="pt-2 border-t border-slate-100">
                  <select
                    className="w-full bg-slate-50 hover:bg-white text-slate-800 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition cursor-pointer"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        onAddExtraPerson(currentEntry.id, 'Night', e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="" disabled>+ افزودن همکار کمکی به شب...</option>
                    {shiftWorkers
                      .filter(p => p !== currentEntry.nightShiftPerson && !(currentEntry.extraNightPersons || []).includes(p))
                      .map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))
                    }
                  </select>
                </div>
              ) : (
                <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md text-center font-bold">
                  حداکثر ظرفیت (۳ نفر) تکمیل است
                </div>
              )}
            </div>

          </div>

          {/* 3. Existing Multi-Person Days in Month */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Users size={14} className="text-indigo-600" />
                <span>روزهای چندنفره ثبت‌شده در این ماه:</span>
              </span>
              <span className="text-[11px] font-black text-slate-600">
                {toPersianDigits(multiDays.length)} روز
              </span>
            </div>

            {multiDays.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
                {multiDays.map(d => {
                  const isSelected = d.date === selectedDate;
                  const dayExtras = d.extraDayPersons?.length || 0;
                  const nightExtras = d.extraNightPersons?.length || 0;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDate(d.date)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs' 
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>{toPersianDigits(d.date.split('/').slice(1).join('/'))}</span>
                      <span className={`text-[9px] px-1 rounded ${isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {dayExtras > 0 ? `روز:${toPersianDigits(dayExtras + 1)}` : ''}
                        {dayExtras > 0 && nightExtras > 0 ? ' | ' : ''}
                        {nightExtras > 0 ? `شب:${toPersianDigits(nightExtras + 1)}` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-2">
                هنوز هیچ روزی با شیفت چندنفره ثبت نشده است. با انتخاب تاریخ از بالا، نفر دوم یا سوم را اضافه فرمایید.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 p-2.5 rounded-xl text-blue-900 text-xs">
            <Info size={16} className="text-blue-600 shrink-0" />
            <span>تغییرات به صورت لحظه‌ای اعمال می‌شوند. برای انتشار نهایی روی دکمه ذخیره کلیک کنید.</span>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3.5 sm:p-4 flex items-center justify-end">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Check size={16} />
            <span>بستن و بازگشت</span>
          </button>
        </div>

      </div>
    </div>
  );
};
