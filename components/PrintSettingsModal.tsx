
/**
 * Print Settings Modal - v1.0.1
 */
import React, { useState } from 'react';
import { X, Printer, CalendarRange, Calendar, ChevronDown } from 'lucide-react';

interface PrintSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: (type: 'CURRENT' | 'CUSTOM', startDate?: string, endDate?: string) => void;
  currentMonthLabel: string;
  availableYears: string[];
}

const PERSIAN_MONTHS = [
  { value: '01', label: 'فروردین' },
  { value: '02', label: 'اردیبهشت' },
  { value: '03', label: 'خرداد' },
  { value: '04', label: 'تیر' },
  { value: '05', label: 'مرداد' },
  { value: '06', label: 'شهریور' },
  { value: '07', label: 'مهر' },
  { value: '08', label: 'آبان' },
  { value: '09', label: 'آذر' },
  { value: '10', label: 'دی' },
  { value: '11', label: 'بهمن' },
  { value: '12', label: 'اسفند' },
];

const PERSIAN_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

// Helper to convert digits to Persian
const toPersianDigits = (s: string | number) => String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

// High contrast date select component
const DateSelect = ({ value, onChange, options, label }: { value: string, onChange: (val: string) => void, options: any[], label: string }) => (
  <div className="flex-1 min-w-[70px]">
    <label className="block text-xs font-black text-black mb-1 text-center">{label}</label>
    <div className="relative h-10">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-full appearance-none bg-white border-2 border-black text-black text-sm font-bold rounded-lg pl-2 pr-2 text-center focus:ring-2 focus:ring-black focus:border-black outline-none transition-shadow cursor-pointer"
        style={{ textAlign: 'center', textAlignLast: 'center' }}
      >
        {options.map((o) => (
          <option key={o.value || o} value={o.value || o} className="text-black bg-white">
            {toPersianDigits(o.label || o)}
          </option>
        ))}
      </select>
      {/* Icon positioned absolutely, pointer-events-none to allow clicks through to select */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none text-black">
          <ChevronDown size={14} strokeWidth={3} />
      </div>
    </div>
  </div>
);

export const PrintSettingsModal: React.FC<PrintSettingsModalProps> = ({
  isOpen, onClose, onPrint, currentMonthLabel, availableYears
}) => {
  const [mode, setMode] = useState<'CURRENT' | 'CUSTOM'>('CURRENT');
  
  // Default to first available year or current year (1404)
  const defaultYear = availableYears.length > 0 ? availableYears[availableYears.length - 1] : '1404';

  const [sYear, setSYear] = useState(defaultYear);
  const [sMonth, setSMonth] = useState('01');
  const [sDay, setSDay] = useState('01');

  const [eYear, setEYear] = useState(defaultYear);
  const [eMonth, setEMonth] = useState('12');
  const [eDay, setEDay] = useState('29');

  if (!isOpen) return null;

  const handlePrintClick = () => {
    if (mode === 'CURRENT') {
      onPrint('CURRENT');
    } else {
      const start = `${sYear}/${sMonth}/${sDay}`;
      const end = `${eYear}/${eMonth}/${eDay}`;
      onPrint('CUSTOM', start, end);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative z-10" 
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b-2 border-slate-100 flex justify-between items-center">
           <h3 className="font-black text-xl text-black flex items-center gap-2">
             <Printer size={24} className="text-black" />
             تنظیمات چاپ
           </h3>
           <button onClick={onClose} className="text-slate-500 hover:text-black transition p-2 hover:bg-slate-100 rounded-full">
             <X size={24} />
           </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4">
           
           {/* Option 1: Current Month */}
           <div 
             className={`border-2 rounded-xl p-4 cursor-pointer transition-all flex items-center gap-4 ${mode === 'CURRENT' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-slate-400'}`}
             onClick={() => setMode('CURRENT')}
           >
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${mode === 'CURRENT' ? 'border-emerald-600' : 'border-slate-400'}`}>
                 {mode === 'CURRENT' && <div className="w-3 h-3 rounded-full bg-emerald-600" />}
              </div>
              <div className="flex-1">
                 <span className={`block font-black text-lg ${mode === 'CURRENT' ? 'text-black' : 'text-slate-800'}`}>چاپ ماه جاری</span>
                 <span className="text-sm text-slate-800 font-bold mt-1 block">{toPersianDigits(currentMonthLabel)}</span>
              </div>
              <Calendar className={`${mode === 'CURRENT' ? 'text-emerald-600' : 'text-slate-300'}`} size={28} />
           </div>

           {/* Option 2: Custom Range */}
           <div 
             className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${mode === 'CUSTOM' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-400'}`}
             onClick={() => setMode('CUSTOM')}
           >
              <div className="flex items-center gap-4 mb-2">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${mode === 'CUSTOM' ? 'border-blue-600' : 'border-slate-400'}`}>
                    {mode === 'CUSTOM' && <div className="w-3 h-3 rounded-full bg-blue-600" />}
                </div>
                <div className="flex-1">
                    <span className={`block font-black text-lg ${mode === 'CUSTOM' ? 'text-black' : 'text-slate-800'}`}>بازه انتخابی (دستی)</span>
                </div>
                <CalendarRange className={`${mode === 'CUSTOM' ? 'text-blue-600' : 'text-slate-300'}`} size={28} />
              </div>

              {/* Date Pickers */}
              {mode === 'CUSTOM' && (
                 <div className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                    
                    {/* Start Date */}
                    <div className="bg-white border-2 border-slate-200 rounded-xl p-3 sm:p-4">
                        <div className="flex items-center gap-2 mb-3">
                             <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                             <span className="text-base font-black text-black">تاریخ شروع:</span>
                        </div>
                        <div className="flex gap-2 sm:gap-3">
                            <DateSelect label="روز" value={sDay} onChange={setSDay} options={PERSIAN_DAYS} />
                            <DateSelect label="ماه" value={sMonth} onChange={setSMonth} options={PERSIAN_MONTHS} />
                            <DateSelect label="سال" value={sYear} onChange={setSYear} options={availableYears} />
                        </div>
                    </div>

                    {/* End Date */}
                    <div className="bg-white border-2 border-slate-200 rounded-xl p-3 sm:p-4">
                        <div className="flex items-center gap-2 mb-3">
                             <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                             <span className="text-base font-black text-black">تاریخ پایان:</span>
                        </div>
                        <div className="flex gap-2 sm:gap-3">
                            <DateSelect label="روز" value={eDay} onChange={setEDay} options={PERSIAN_DAYS} />
                            <DateSelect label="ماه" value={eMonth} onChange={setEMonth} options={PERSIAN_MONTHS} />
                            <DateSelect label="سال" value={eYear} onChange={setEYear} options={availableYears} />
                        </div>
                    </div>

                 </div>
              )}
           </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t-2 border-slate-100 flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-6 py-3 text-sm font-black text-slate-700 hover:text-black hover:bg-slate-200 rounded-lg transition"
            >
                انصراف
            </button>
            <button 
                onClick={handlePrintClick}
                className="bg-black hover:bg-slate-800 text-white px-8 py-3 rounded-lg text-sm font-black shadow-lg transition-all flex items-center gap-2"
            >
                <Printer size={20} />
                <span>چاپ کن</span>
            </button>
        </div>

      </div>
    </div>
  );
};
