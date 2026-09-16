
/**
 * ShiftFlow Core Types - v1.0.1
 */
export type PersonName = string;
export type OnCallName = string;
export type Role = 'Shift' | 'Supervisor';

export interface Personnel {
  name: string;
  roles: Role[];
  isActive: boolean;
  color?: string; // Hex color code for chart and badge styling
}

export interface ShiftEntry {
  id: number;
  dayName: string;
  date: string; // Persian date string YYYY/MM/DD
  dayShiftPerson: PersonName;
  nightShiftPerson: PersonName;
  onCallPerson: OnCallName;
  isHoliday: boolean;
  // New fields to track history of swaps
  originalDayShiftPerson?: PersonName;
  originalNightShiftPerson?: PersonName;
  // Multi-person support: additional persons for Day or Night shift (2nd, 3rd, etc.)
  extraDayPersons?: PersonName[];
  extraNightPersons?: PersonName[];
}

export interface StatEntry {
  name: PersonName;
  dayShifts: number;
  nightShifts: number;
  totalHours: number;
  weightedScore: number;
  offHours: number;
  workedHours: number;
}

export const SHIFT_WEIGHTS = {
  dayHours: 11,
  nightHours: 13,
  nightMultiplier: 1.5
};

export interface DateParts {
  year: string;
  month: string;
  day: string;
}

export interface PublishedRange {
  isActive: boolean;
  from: DateParts;
  to: DateParts;
}

export interface DashboardProps {
  scheduleData: ShiftEntry[];
  fullSchedule: ShiftEntry[]; // Added for Live Status
  shiftWorkers: string[];
  supervisors: string[];
  personnelList?: Personnel[]; // List of personnel with configured colors
  monthName: string;
  year: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  // Removed isEditable and onToggleEdit
  onUpdateShift: (id: number, type: 'dayShiftPerson' | 'nightShiftPerson' | 'onCallPerson', newPerson: string) => void;
  onToggleHoliday: (id: number) => void;
  onOpenReport: () => void;
  // Multi-person shift management
  onAddExtraPerson?: (id: number, shiftType: 'Day' | 'Night', personName: string) => void;
  onRemoveExtraPerson?: (id: number, shiftType: 'Day' | 'Night', personName: string) => void;
  onReplaceExtraPerson?: (id: number, shiftType: 'Day' | 'Night', oldPerson: string, newPerson: string) => void;
  // Locking props
  isLocked: boolean;
  onToggleLock: () => void;
  onRegenerate: () => void; // Added for Auto Arrange
  onNavigateToToday?: () => void;
  // Owner and Range Restriction props
  isOwner: boolean;
  onOpenOwnerLogin: () => void;
  onLogoutOwner?: () => void;
  publishedRange: PublishedRange | null;
  onSavePublishedRange: (range: PublishedRange | null) => void;
}

export interface AppData {
  schedule: ShiftEntry[];
  personnel: Personnel[];
  lockedMonths: string[]; 
  publishedRange?: PublishedRange | null;
}
