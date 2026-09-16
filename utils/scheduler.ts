
/**
 * Shift Scheduler & Generation Engine - v1.0.1
 */
import { ShiftEntry, SHIFT_WEIGHTS, Personnel } from '../types';
import { OFFICIAL_HOLIDAYS, INITIAL_PERSONNEL } from '../constants';
import { getDayNameForJalali } from './persianDate';

export const INITIAL_STAFF: Personnel[] = INITIAL_PERSONNEL;

const WEEK_DAYS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

// Helper to determine days in Persian month
export const getDaysInPersianMonth = (monthCode: string, isLeapYear: boolean = false): number => {
  const monthIndex = parseInt(monthCode, 10);
  if (monthIndex >= 1 && monthIndex <= 6) return 31;
  if (monthIndex >= 7 && monthIndex <= 11) return 30;
  if (monthIndex === 12) return isLeapYear ? 30 : 29; // 1404 is not leap (usually), 1403 was. Assuming standard 29 for Esfand.
  return 30;
};

interface StaffStats {
  name: string;
  dayCount: number;
  nightCount: number;
  weightedScore: number;
}

export const generateNextMonth = (
  fullScheduleHistory: ShiftEntry[], 
  nextYear: number,
  nextMonthCode: string, 
  startDayIndex: number, 
  allPersonnel: Personnel[],
  daysInMonth: number
): ShiftEntry[] => {
  const newSchedule: ShiftEntry[] = [];
  let currentDateIdx = 1;
  
  // Filter eligible staff
  const shiftWorkers = allPersonnel.filter(p => p.isActive && p.roles.includes('Shift')).map(p => p.name);
  const supervisors = allPersonnel.filter(p => p.isActive && p.roles.includes('Supervisor')).map(p => p.name);
  
  // --- STEP 0: Calculate Historical Stats ---
  // We must calculate the cumulative load for everyone to ensure long-term fairness.
  // If we only looked at the new month, someone who worked extra last month wouldn't "pay it back".
  
  const stats: StaffStats[] = shiftWorkers.map(s => ({ 
    name: s, 
    dayCount: 0, 
    nightCount: 0, 
    weightedScore: 0 
  }));

  fullScheduleHistory.forEach(entry => {
    // Check Day Shift
    const dayPersons = [entry.dayShiftPerson, ...(entry.extraDayPersons || [])];
    dayPersons.forEach(dp => {
      const p = stats.find(s => s.name === dp);
      if (p) {
        p.dayCount++;
        p.weightedScore += SHIFT_WEIGHTS.dayHours;
      }
    });

    // Check Night Shift
    const nightPersons = [entry.nightShiftPerson, ...(entry.extraNightPersons || [])];
    nightPersons.forEach(np => {
      const p = stats.find(s => s.name === np);
      if (p) {
        p.nightCount++;
        p.weightedScore += (SHIFT_WEIGHTS.nightHours * SHIFT_WEIGHTS.nightMultiplier);
      }
    });
  });

  // --- Start Generation ---

  // Initialize cycle variables from the absolute last entry of the history
  const lastEntry = fullScheduleHistory.length > 0 ? fullScheduleHistory[fullScheduleHistory.length - 1] : null;
  
  let currentOnCallIndex = 0;
  if (lastEntry && supervisors.length > 0) {
    const lastSupIdx = supervisors.indexOf(lastEntry.onCallPerson);
    // Continue rotation logic
    currentOnCallIndex = (lastSupIdx + 1) % supervisors.length;
  }
  
  // We need to track the "Last Night Person" to enforce the Off rule.
  // Initially, it's the person from the last day of previous history.
  let prevNightPerson = lastEntry ? lastEntry.nightShiftPerson : '';

  for (let i = 0; i < daysInMonth; i++) {
    const dayName = getDayNameForJalali(nextYear, parseInt(nextMonthCode, 10), currentDateIdx);
    const isFriday = dayName === 'جمعه';
    const dateStr = `${nextYear}/${nextMonthCode}/${String(currentDateIdx).padStart(2, '0')}`;
    const isHoliday = isFriday || OFFICIAL_HOLIDAYS.includes(dateStr);
    
    // Rotate OnCall every Saturday (if applicable)
    // If it is the start of the generation loop and it is saturday, we rotate.
    // NOTE: Logic simplified to ensure weekly rotation.
    if (dayName === 'شنبه' && i > 0 && supervisors.length > 0) {
        currentOnCallIndex = (currentOnCallIndex + 1) % supervisors.length;
    }

    const currentSupervisor = supervisors.length > 0 ? supervisors[currentOnCallIndex] : 'نامشخص';

    // --- STEP 1: Assign Night Shift ---
    // Constraint: Cannot be the person who did night shift yesterday
    
    // Filter eligible candidates
    let nightCandidates = stats.filter(s => s.name !== prevNightPerson);

    // Sort by Fairness (Long Term):
    // 1. Lowest Total Night Count (Primary Goal)
    // 2. Lowest Total Weighted Score (Secondary Goal)
    nightCandidates.sort((a, b) => {
      if (a.nightCount !== b.nightCount) return a.nightCount - b.nightCount;
      return a.weightedScore - b.weightedScore;
    });

    // Pick top candidate
    // Fallback to anyone if candidate list is empty (shouldn't happen with > 2 staff)
    const selectedNight = nightCandidates.length > 0 ? nightCandidates[0] : stats[0];
    
    // Update Stats (Accumulate for next days in this loop)
    selectedNight.nightCount++;
    selectedNight.weightedScore += (SHIFT_WEIGHTS.nightHours * SHIFT_WEIGHTS.nightMultiplier);

    // --- STEP 2: Assign Day Shift ---
    // Constraint: Cannot be prev night person (Off day) AND cannot be current night person (Double shift)
    let dayCandidates = stats.filter(s => 
      s.name !== prevNightPerson && 
      s.name !== selectedNight.name
    );

    // Sort by Fairness (Long Term):
    // 1. Lowest Total Day Count
    // 2. Lowest Total Weighted Score
    dayCandidates.sort((a, b) => {
      if (a.dayCount !== b.dayCount) return a.dayCount - b.dayCount;
      return a.weightedScore - b.weightedScore;
    });

    const selectedDay = dayCandidates.length > 0 ? dayCandidates[0] : stats.find(s => s.name !== selectedNight.name) || stats[0];

    // Update Stats
    selectedDay.dayCount++;
    selectedDay.weightedScore += SHIFT_WEIGHTS.dayHours;

    newSchedule.push({
      id: Math.random(),
      dayName,
      date: dateStr,
      dayShiftPerson: selectedDay.name,
      nightShiftPerson: selectedNight.name,
      onCallPerson: currentSupervisor,
      isHoliday: isHoliday 
    });

    // Update trackers for next iteration
    prevNightPerson = selectedNight.name;
    currentDateIdx++;
  }

  return newSchedule;
};

export const validateSwap = (
  schedule: ShiftEntry[],
  date: string,
  targetPerson: string,
  shiftType: 'Day' | 'Night'
): { valid: boolean; reason?: string } => {
  const entryIndex = schedule.findIndex(s => s.date === date);
  if (entryIndex === -1) return { valid: false, reason: 'تاریخ یافت نشد.' };

  const currentEntry = schedule[entryIndex];
  const prevEntry = entryIndex > 0 ? schedule[entryIndex - 1] : null;
  const nextEntry = entryIndex < schedule.length - 1 ? schedule[entryIndex + 1] : null;

  const currentNightPersons = [currentEntry.nightShiftPerson, ...(currentEntry.extraNightPersons || [])];
  const currentDayPersons = [currentEntry.dayShiftPerson, ...(currentEntry.extraDayPersons || [])];
  const prevNightPersons = prevEntry ? [prevEntry.nightShiftPerson, ...(prevEntry.extraNightPersons || [])] : [];
  const nextDayPersons = nextEntry ? [nextEntry.dayShiftPerson, ...(nextEntry.extraDayPersons || [])] : [];

  if (shiftType === 'Day') {
    // Target takes Day Shift
    
    // 1. Cannot work Day if working Night same day (Double shift)
    if (currentNightPersons.includes(targetPerson)) {
      return { valid: false, reason: 'این شخص در همین روز شیفت شب دارد.' };
    }
    // 2. Cannot work Day if worked Night previous day (Need Rest)
    if (prevNightPersons.includes(targetPerson)) {
      return { valid: false, reason: 'این شخص روز قبل شیفت شب بوده و نیاز به استراحت دارد.' };
    }
  } else {
    // Target takes Night Shift
    
    // 1. Cannot work Night if working Day same day (Double shift)
    if (currentDayPersons.includes(targetPerson)) {
      return { valid: false, reason: 'این شخص در همین روز شیفت روز دارد.' };
    }
    // 2. Cannot work Night if worked Night previous day (Back-to-back night constraint from generator)
    if (prevNightPersons.includes(targetPerson)) {
      return { valid: false, reason: 'این شخص شب قبل شیفت بوده است (توالی شب‌کاری).' };
    }
    // 3. Cannot work Night if working Day next day (Need Rest after night)
    if (nextDayPersons.includes(targetPerson)) {
       return { valid: false, reason: 'این شخص فردا شیفت روز دارد و نمی‌تواند امشب شیفت بایستد.' };
    }
  }

  return { valid: true };
};
