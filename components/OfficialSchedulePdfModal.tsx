/**
 * Official Schedule PDF Preview and Print Modal
 * Renders the exact format matching the user's official production shift schedule PDF
 * Supports custom date ranges (از تاریخ ... تا تاریخ ...), specific months, and full schedule exports
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Printer, X, Calendar, FileSpreadsheet, Columns, ArrowRightLeft, Sparkles, Filter, Check } from 'lucide-react';
import { ShiftEntry } from '../types';
import { 
  exportScheduleToExcelFormat, 
  PERSIAN_MONTHS_LIST, 
  PERSIAN_DAYS_LIST, 
  PERSIAN_YEARS_LIST 
} from '../utils/customFormatHandler';
import { toPersianDigits } from '../utils/persianDate';

// Reusable Date Field Select for modal
const ModalDateFieldSelect = ({
  value,
  onChange,
  options,
  width = "w-[56px]"
}: {
  value: string;
  onChange: (val: string) => void;
  options: any[];
  width?: string;
}) => (
  <div className={`relative h-8 ${width}`}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-full appearance-none bg-white border border-slate-300 hover:border-emerald-500 rounded-md px-1 text-[11px] font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none transition cursor-pointer text-center dir-ltr shadow-2xs"
      style={{ textAlign: 'center', textAlignLast: 'center' }}
    >
      {options.map((o) => {
        const val = typeof o === 'object' ? o.value : o;
        const label = typeof o === 'object' ? o.label : o;
        return (
          <option key={val} value={val}>
            {toPersianDigits(label)}
          </option>
        );
      })}
    </select>
  </div>
);

interface OfficialSchedulePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ShiftEntry[];
  initialFilterMode?: 'month' | 'custom' | 'all';
  initialStartDate?: string;
  initialEndDate?: string;
  initialMonth?: string;
}

export const OfficialSchedulePdfModal: React.FC<OfficialSchedulePdfModalProps> = ({
  isOpen,
  onClose,
  schedule,
  initialFilterMode = 'month',
  initialStartDate,
  initialEndDate,
  initialMonth,
}) => {
  const [includeOnCall, setIncludeOnCall] = useState<boolean>(() => {
    return schedule.some(s => s.onCallPerson && s.onCallPerson !== 'نامشخص');
  });

  // Extract all distinct sorted dates
  const allDates = useMemo(() => {
    const dates = Array.from(new Set(schedule.map(s => s.date))).sort();
    return dates;
  }, [schedule]);

  const minDate = allDates.length > 0 ? allDates[0] : '';
  const maxDate = allDates.length > 0 ? allDates[allDates.length - 1] : '';

  // Extract all distinct months available in the schedule
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    schedule.forEach(s => {
      const parts = s.date.split('/');
      if (parts.length >= 2) {
        months.add(`${parts[0]}/${parts[1]}`);
      }
    });
    return Array.from(months).sort();
  }, [schedule]);

  const monthNamesMap: Record<string, string> = {
    '01': 'فروردین',
    '02': 'اردیبهشت',
    '03': 'خرداد',
    '04': 'تیر',
    '05': 'مرداد',
    '06': 'شهریور',
    '07': 'مهر',
    '08': 'آبان',
    '09': 'آذر',
    '10': 'دی',
    '11': 'بهمن',
    '12': 'اسفند',
  };

  const getMonthName = (monthKey: string) => {
    const parts = monthKey.split('/');
    if (parts.length === 2) {
      const mNum = parts[1];
      return `${monthNamesMap[mNum] || mNum} ${parts[0]}`;
    }
    return monthKey;
  };

  // State with Granular Day/Month/Year
  const [filterMode, setFilterMode] = useState<'month' | 'custom' | 'all'>(initialFilterMode);
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || (availableMonths.length > 0 ? availableMonths[0] : ''));

  const [fromParts, setFromParts] = useState<{ year: string; month: string; day: string }>(() => {
    const p = (initialStartDate || minDate || '1405/05/26').split('/');
    return {
      year: p[0] || '1405',
      month: p[1] || '05',
      day: p[2] || '26'
    };
  });

  const [toParts, setToParts] = useState<{ year: string; month: string; day: string }>(() => {
    const p = (initialEndDate || maxDate || '1405/06/25').split('/');
    return {
      year: p[0] || '1405',
      month: p[1] || '06',
      day: p[2] || '25'
    };
  });

  const customStart = useMemo(() => {
    return `${fromParts.year}/${fromParts.month.padStart(2, '0')}/${fromParts.day.padStart(2, '0')}`;
  }, [fromParts]);

  const customEnd = useMemo(() => {
    return `${toParts.year}/${toParts.month.padStart(2, '0')}/${toParts.day.padStart(2, '0')}`;
  }, [toParts]);

  // Sync state when modal opens or initial props change
  useEffect(() => {
    if (isOpen) {
      if (initialFilterMode) setFilterMode(initialFilterMode);
      if (initialMonth) setSelectedMonth(initialMonth);
      if (initialStartDate) {
        const p = initialStartDate.split('/');
        if (p.length === 3) setFromParts({ year: p[0], month: p[1], day: p[2] });
      } else if (minDate) {
        const p = minDate.split('/');
        if (p.length === 3) setFromParts({ year: p[0], month: p[1], day: p[2] });
      }
      
      if (initialEndDate) {
        const p = initialEndDate.split('/');
        if (p.length === 3) setToParts({ year: p[0], month: p[1], day: p[2] });
      } else if (maxDate) {
        const p = maxDate.split('/');
        if (p.length === 3) setToParts({ year: p[0], month: p[1], day: p[2] });
      }
    }
  }, [isOpen, initialFilterMode, initialMonth, initialStartDate, initialEndDate, minDate, maxDate]);

  // Filter schedule based on active mode
  const filteredSchedule = useMemo(() => {
    if (schedule.length === 0) return [];

    if (filterMode === 'all') {
      return schedule;
    }

    if (filterMode === 'month') {
      if (!selectedMonth) return schedule;
      return schedule.filter(s => s.date.startsWith(selectedMonth));
    }

    if (filterMode === 'custom') {
      return schedule.filter(s => {
        if (customStart && s.date < customStart) return false;
        if (customEnd && s.date > customEnd) return false;
        return true;
      });
    }

    return schedule;
  }, [schedule, filterMode, selectedMonth, customStart, customEnd]);

  // Dynamic Header Title
  const currentTitle = useMemo(() => {
    if (filterMode === 'all') {
      if (filteredSchedule.length > 0) {
        const first = filteredSchedule[0].date;
        const last = filteredSchedule[filteredSchedule.length - 1].date;
        return `کل دوره ( از ${first} الی ${last} )`;
      }
      return 'کل دوره';
    }

    if (filterMode === 'month') {
      if (!selectedMonth) {
        return 'کل دوره';
      }
      const parts = selectedMonth.split('/');
      if (parts.length === 2) {
        const mNum = parts[1];
        return `${monthNamesMap[mNum] || mNum} ${parts[0]}`;
      }
      return selectedMonth;
    }

    if (filterMode === 'custom') {
      const s = customStart || minDate;
      const e = customEnd || maxDate;
      if (s && e) {
        return `از ${s} الی ${e}`;
      }
      return 'بازه انتخابی';
    }

    return 'برنامه شیفت';
  }, [filterMode, selectedMonth, customStart, customEnd, filteredSchedule, minDate, maxDate]);

  // Compute rowspans for ON Call supervisor to merge consecutive days
  const onCallRowSpans = useMemo(() => {
    const spans: { [index: number]: number } = {};
    let currentSup = '';
    let startIndex = 0;

    filteredSchedule.forEach((entry, idx) => {
      const sup = entry.onCallPerson || '';
      if (idx === 0) {
        currentSup = sup;
        startIndex = 0;
        spans[0] = 1;
      } else if (sup === currentSup) {
        spans[startIndex] += 1;
        spans[idx] = 0; // 0 means do not render <td> because merged
      } else {
        currentSup = sup;
        startIndex = idx;
        spans[idx] = 1;
      }
    });

    return spans;
  }, [filteredSchedule]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    try {
      exportScheduleToExcelFormat(filteredSchedule, currentTitle, includeOnCall);
    } catch (err: any) {
      alert(err.message || 'خطا در خروجی اکسل');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      
      {/* Top Controls Bar - Hidden when printing */}
      <div className="w-full max-w-5xl bg-white rounded-t-2xl shadow-xl border border-slate-200 p-3.5 sm:p-4.5 space-y-3.5 print:hidden sticky top-0 z-50">
        
        {/* Row 1: Header title + main actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
              <Printer size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-850 text-sm sm:text-base flex items-center gap-2">
                <span>پیش‌نمایش و چاپ سند رسمی (PDF & Excel)</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                  {toPersianDigits(filteredSchedule.length)} روز انتخاب‌شده
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                فیلتر بر اساس بازه زمانی دلخواه یا ماه مشخص، با قالب ۴ و ۵ ستونه استاندارد
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* 4 vs 5 Column Toggle */}
            <button
              type="button"
              onClick={() => setIncludeOnCall(!includeOnCall)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                includeOnCall 
                  ? 'bg-blue-50 border-blue-300 text-blue-800' 
                  : 'bg-slate-50 border-slate-300 text-slate-700'
              }`}
            >
              <Columns size={14} />
              <span>{includeOnCall ? 'ستون On Call: فعال (۵ ستونه)' : 'ستون On Call: مخفی (۴ ستونه)'}</span>
            </button>

            {/* Excel Export Button */}
            <button
              type="button"
              id="btn-modal-export-excel"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
              title="دانلود اکسل مطابق این بازه"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              <span>خروجی اکسل بازه</span>
            </button>

            {/* Print/Save to PDF Button */}
            <button
              type="button"
              id="btn-modal-print-pdf"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer"
            >
              <Printer size={15} />
              <span>چاپ / صدور PDF</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="بستن"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Row 2: Range Filter Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
          
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setFilterMode('custom')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                filterMode === 'custom' 
                  ? 'bg-emerald-600 text-white shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              بازه زمانی دلخواه
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('month')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                filterMode === 'month' 
                  ? 'bg-emerald-600 text-white shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              بر اساس ماه
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                filterMode === 'all' 
                  ? 'bg-emerald-600 text-white shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              کل دوره ({toPersianDigits(schedule.length)} روز)
            </button>
          </div>

          {/* Mode-Specific Inputs */}
          {filterMode === 'custom' && (
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {/* From Date Group */}
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-2xs">
                <span className="font-bold text-slate-500 text-[11px] whitespace-nowrap">از:</span>
                <div className="flex items-center gap-0.5">
                  <ModalDateFieldSelect
                    value={fromParts.day}
                    onChange={(v) => setFromParts(prev => ({ ...prev, day: v }))}
                    options={PERSIAN_DAYS_LIST}
                    width="w-[46px]"
                  />
                  <span className="text-slate-400 font-bold text-xs">/</span>
                  <ModalDateFieldSelect
                    value={fromParts.month}
                    onChange={(v) => setFromParts(prev => ({ ...prev, month: v }))}
                    options={PERSIAN_MONTHS_LIST}
                    width="w-[74px]"
                  />
                  <span className="text-slate-400 font-bold text-xs">/</span>
                  <ModalDateFieldSelect
                    value={fromParts.year}
                    onChange={(v) => setFromParts(prev => ({ ...prev, year: v }))}
                    options={PERSIAN_YEARS_LIST}
                    width="w-[60px]"
                  />
                </div>
              </div>

              {/* To Date Group */}
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-2xs">
                <span className="font-bold text-slate-500 text-[11px] whitespace-nowrap">تا:</span>
                <div className="flex items-center gap-0.5">
                  <ModalDateFieldSelect
                    value={toParts.day}
                    onChange={(v) => setToParts(prev => ({ ...prev, day: v }))}
                    options={PERSIAN_DAYS_LIST}
                    width="w-[46px]"
                  />
                  <span className="text-slate-400 font-bold text-xs">/</span>
                  <ModalDateFieldSelect
                    value={toParts.month}
                    onChange={(v) => setToParts(prev => ({ ...prev, month: v }))}
                    options={PERSIAN_MONTHS_LIST}
                    width="w-[74px]"
                  />
                  <span className="text-slate-400 font-bold text-xs">/</span>
                  <ModalDateFieldSelect
                    value={toParts.year}
                    onChange={(v) => setToParts(prev => ({ ...prev, year: v }))}
                    options={PERSIAN_YEARS_LIST}
                    width="w-[60px]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (minDate && maxDate) {
                    const pStart = minDate.split('/');
                    const pEnd = maxDate.split('/');
                    if (pStart.length === 3) setFromParts({ year: pStart[0], month: pStart[1], day: pStart[2] });
                    if (pEnd.length === 3) setToParts({ year: pEnd[0], month: pEnd[1], day: pEnd[2] });
                  }
                }}
                className="px-2.5 py-1.5 text-[11px] font-bold bg-white text-slate-700 hover:bg-slate-100 hover:text-emerald-700 border border-slate-300 rounded-lg transition cursor-pointer shadow-2xs"
              >
                کل برنامه
              </button>
            </div>
          )}

          {filterMode === 'month' && (
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1">
                <Calendar size={14} className="text-slate-500" />
                <span className="font-bold text-slate-500">انتخاب ماه:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                >
                  <option value="">همه ماه‌ها</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>
                      {getMonthName(m)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Range Summary Info */}
          <div className="text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
            <span>عنوان سند: </span>
            <span className="text-emerald-700 font-bold">{toPersianDigits(currentTitle)}</span>
          </div>

        </div>

      </div>

      {/* Printable Sheet Container */}
      <div 
        id="official-pdf-sheet" 
        className="w-full max-w-5xl bg-white shadow-2xl border border-slate-300 p-4 sm:p-8 rounded-b-2xl print:rounded-none print:shadow-none print:border-none print:p-2 print:max-w-none print:w-full print:m-0 text-black font-['Vazirmatn',sans-serif]"
        dir="rtl"
      >
        {/* Printable Header Section */}
        <div className="mb-3">
          {includeOnCall ? (
            <div className="grid grid-cols-5 gap-2 items-stretch">
              {/* Main Title Box (Columns 1 to 4) */}
              <div className="col-span-4 bg-[#c6efce] border-[2px] border-black p-2.5 sm:p-3 text-center rounded-sm flex flex-col justify-center items-center">
                <h1 className="text-lg sm:text-2xl font-black text-black tracking-wide">
                  برنامه شیفت تولید
                </h1>
                <p className="text-xs sm:text-sm md:text-base font-bold text-black mt-1">
                  ( {toPersianDigits(currentTitle)} )
                </p>
              </div>

              {/* ON Call Header Box (Column 5) */}
              <div className="col-span-1 bg-white border-[2px] border-black p-2 sm:p-3 text-center rounded-sm flex items-center justify-center">
                <span className="text-base sm:text-xl font-black text-black">
                  ON Call
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full bg-[#c6efce] border-[2px] border-black p-2.5 sm:p-3 text-center rounded-sm flex flex-col justify-center items-center">
              <h1 className="text-lg sm:text-2xl font-black text-black tracking-wide">
                برنامه شیفت تولید
              </h1>
              <p className="text-xs sm:text-sm md:text-base font-bold text-black mt-1">
                ( {toPersianDigits(currentTitle)} )
              </p>
            </div>
          )}
        </div>

        {/* Schedule Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-[2px] border-black text-center">
            <thead>
              <tr className="border-b-[2px] border-black">
                <th className="w-[12%] bg-[#ffe699] border border-black p-2.5 sm:p-3 font-black text-black text-sm sm:text-base md:text-lg">
                  روز
                </th>
                <th className="w-[14%] bg-[#ffe699] border border-black p-2.5 sm:p-3 font-black text-black text-sm sm:text-base md:text-lg">
                  تاریخ
                </th>
                <th className={`${includeOnCall ? 'w-[28%]' : 'w-[37%]'} bg-[#ffc000] border border-black p-2 sm:p-2.5 text-black`}>
                  <div className="text-sm sm:text-base md:text-lg font-black leading-tight">
                    شیفت روز
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-black/90 mt-0.5">
                    (از ساعت ۸ الی ۱۹)
                  </div>
                </th>
                <th className={`${includeOnCall ? 'w-[28%]' : 'w-[37%]'} bg-[#ffc000] border border-black p-2 sm:p-2.5 text-black`}>
                  <div className="text-sm sm:text-base md:text-lg font-black leading-tight">
                    شیفت شب
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-black/90 mt-0.5">
                    (از ساعت ۱۹ الی ۸)
                  </div>
                </th>
                {includeOnCall && (
                  <th className="w-[18%] bg-[#f8cbad] border border-black p-2.5 sm:p-3 font-black text-black text-sm sm:text-base md:text-lg">
                    ON Call
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredSchedule.length === 0 ? (
                <tr>
                  <td colSpan={includeOnCall ? 5 : 4} className="p-8 text-center text-slate-500 font-bold border border-black text-sm">
                    هیچ شیفتی در این بازه زمانی یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredSchedule.map((entry, idx) => {
                  const isFriday = entry.dayName === 'جمعه';
                  const rowSpan = onCallRowSpans[idx];

                  // Multi-person rendering with hyphen
                  let dayShiftDisplay = entry.dayShiftPerson;
                  if (entry.extraDayPersons && entry.extraDayPersons.length > 0) {
                    dayShiftDisplay += ` - ${entry.extraDayPersons.join(' - ')}`;
                  }

                  let nightShiftDisplay = entry.nightShiftPerson;
                  if (entry.extraNightPersons && entry.extraNightPersons.length > 0) {
                    nightShiftDisplay += ` - ${entry.extraNightPersons.join(' - ')}`;
                  }

                  return (
                    <tr 
                      key={entry.id || `${entry.date}-${idx}`}
                      className={`border-b border-black text-xs sm:text-[13px] md:text-sm ${isFriday ? 'bg-amber-50/60 font-bold' : idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'}`}
                    >
                      {/* Day Name */}
                      <td className={`border border-black p-2 sm:p-2.5 font-bold ${isFriday ? 'text-red-700' : 'text-black'}`}>
                        {entry.dayName}
                      </td>

                      {/* Date in Persian Digits */}
                      <td className="border border-black p-2 sm:p-2.5 font-bold text-black text-center whitespace-nowrap">
                        {toPersianDigits(entry.date)}
                      </td>

                      {/* Day Shift Person(s) */}
                      <td className="border border-black p-2 sm:p-2.5 font-bold text-black">
                        <span className={entry.extraDayPersons?.length ? 'text-amber-950 font-black' : ''}>
                          {dayShiftDisplay}
                        </span>
                      </td>

                      {/* Night Shift Person(s) */}
                      <td className="border border-black p-2 sm:p-2.5 font-bold text-black">
                        <span className={entry.extraNightPersons?.length ? 'text-indigo-950 font-black' : ''}>
                          {nightShiftDisplay}
                        </span>
                      </td>

                      {/* ON Call (Merged Cells) */}
                      {includeOnCall && rowSpan !== 0 && (
                        <td 
                          rowSpan={rowSpan > 1 ? rowSpan : undefined}
                          className="border border-black p-2 sm:p-2.5 font-black text-black bg-white align-middle text-xs sm:text-[13px] md:text-sm"
                        >
                          {entry.onCallPerson && entry.onCallPerson !== 'نامشخص' ? entry.onCallPerson : '-'}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Notice */}
        <div className="mt-3 bg-[#c6efce] border-[2px] border-black p-2.5 sm:p-3 text-center rounded-sm">
          <p className="text-xs sm:text-sm md:text-base font-black text-black">
            تمامی کارشناسان فردای شیفت شب OFF میباشند
          </p>
        </div>
      </div>
    </div>
  );
};
