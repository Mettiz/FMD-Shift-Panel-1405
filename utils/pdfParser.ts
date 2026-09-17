/**
 * PDF Parser for Production Shift Schedule
 * Extracts shifts, dates, multi-person assignments, and personnel with high fidelity.
 */
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ShiftEntry, Personnel, DateParts } from '../types';
import { OFFICIAL_HOLIDAYS } from '../constants';
import { 
  normalizePersianText, 
  parsePersonField, 
  getCanonicalPersonKey, 
  matchCanonicalPersonName, 
  unifyPersonnelAndShifts 
} from './customFormatHandler';
import { getDayNameForJalali } from './persianDate';

// Configure the local worker URL bundled by Vite (safe within iframes, same-origin)
try {
  if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  }
} catch (e) {
  console.warn('Could not set pdfjs GlobalWorkerOptions:', e);
}

/**
 * Fallback binary text extractor in case worker is restricted
 */
function extractTextFromBinaryPdf(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    let binaryStr = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binaryStr += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }

    const textPieces: string[] = [];
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(binaryStr)) !== null) {
      if (match[1]) textPieces.push(match[1]);
    }

    const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
    while ((match = arrayTjRegex.exec(binaryStr)) !== null) {
      const inner = match[1];
      const innerMatches = inner.match(/\(([^)]+)\)/g);
      if (innerMatches) {
        textPieces.push(innerMatches.map(m => m.slice(1, -1)).join(' '));
      }
    }

    const decodedPieces = textPieces.map(t => {
      try {
        const charBytes = new Uint8Array(t.length);
        for (let j = 0; j < t.length; j++) {
          charBytes[j] = t.charCodeAt(j) & 0xff;
        }
        return new TextDecoder('utf-8', { fatal: false }).decode(charBytes);
      } catch {
        return t;
      }
    });

    return decodedPieces.join('\n');
  } catch (err) {
    console.warn('Binary PDF extraction fallback error:', err);
    return '';
  }
}

/**
 * Clean & normalize text specifically for shift schedule lines
 */
export const PERSIAN_DAY_NAMES = ['سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'یکشنبه', 'دوشنبه', 'جمعه', 'شنبه'];
export const PERSIAN_DAY_REGEX = /(سه‌\s*شنبه|سه\s*شنبه|سه‌شنبه|چهارشنبه|پنج‌\s*شنبه|پنج\s*شنبه|پنج‌شنبه|یک\s*شنبه|يكشنبه|یکشنبه|دو\s*شنبه|دوشنبه|جمعه|شنبه)/gi;

export const normalizePersianDayName = (str: string): string => {
  if (!str) return 'نامشخص';
  const clean = str.replace(/[\s\u200B-\u200D\uFEFF]/g, '').replace(/ي/g, 'ی');
  if (clean.includes('سه')) return 'سه‌شنبه';
  if (clean.includes('چهار')) return 'چهارشنبه';
  if (clean.includes('پنج')) return 'پنج‌شنبه';
  if (clean.includes('یک')) return 'یکشنبه';
  if (clean.includes('دو')) return 'دوشنبه';
  if (clean.includes('جمعه')) return 'جمعه';
  if (clean.includes('شنبه')) return 'شنبه';
  return str.trim();
};

/**
 * Validates whether a token is a legitimate person candidate (filters out numbers, day name fragments like 'سه', etc.)
 */
export const isValidPersonCandidate = (name: string): boolean => {
  if (!name) return false;
  const clean = normalizePersianText(name).replace(/[\s\u200B-\u200D\uFEFF\-\_]/g, '');
  if (clean.length < 3) return false;
  const bannedTokens = ['سه', 'شنبه', 'یک', 'دو', 'چهار', 'پنج', 'جمعه', 'سه‌شنبه', 'دوشنبه', 'یکشنبه', 'پنج‌شنبه', 'چهارشنبه', 'تاریخ', 'روز', 'شیفت'];
  if (bannedTokens.includes(clean)) return false;
  if (/^\d+$/.test(clean)) return false;
  return true;
};

/**
 * Clean & normalize text specifically for shift schedule lines
 */
export function cleanScheduleLineText(str: string): string {
  if (!str) return '';
  return str
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    // Fix known PDF font ligature / OCR issues in Persian names
    .replace(/فالح/g, 'فلاح')
    .replace(/ساالروند/g, 'سالاروند')
    // Normalize dashes and connectors
    .replace(/[\–\—]/g, '-')
    .replace(/[\u200B\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/یک\s*شنبه|يكشنبه/g, 'یکشنبه')
    .replace(/دو\s*شنبه/g, 'دوشنبه')
    .replace(/سه\s*شنبه|سه\u200Cشنبه|سهشنبه/g, 'سه‌شنبه')
    .replace(/چهار\s*شنبه/g, 'چهارشنبه')
    .replace(/پنج\s*شنبه|پنج\u200Cشنبه|پنجشنبه/g, 'پنج‌شنبه')
    .trim();
}

/**
 * Extract lines from PDF document, grouping text items with close vertical coordinates
 */
export async function extractPdfLines(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const lines: string[] = [];

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      stopAtErrors: false,
    });

    const pdf = await loadingTask.promise;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Group items by Y coordinate with 4-unit tolerance
      const rowGroups: { y: number; items: { x: number; text: string }[] }[] = [];
      
      for (const item of textContent.items as any[]) {
        if (!item || typeof item.str !== 'string') continue;
        const text = item.str.trim();
        if (!text) continue;
        
        const tx = item.transform ? item.transform[4] : 0;
        const ty = item.transform ? item.transform[5] : 0;

        let matchedGroup = rowGroups.find(g => Math.abs(g.y - ty) < 4.5);
        if (!matchedGroup) {
          matchedGroup = { y: ty, items: [] };
          rowGroups.push(matchedGroup);
        }
        matchedGroup.items.push({ x: tx, text });
      }

      // Sort rows top-to-bottom (in PDF, higher Y is higher on page)
      rowGroups.sort((a, b) => b.y - a.y);

      for (const group of rowGroups) {
        // In Persian RTL tables, items might appear right-to-left or left-to-right.
        // We sort by X coordinate (either RTL or preserve natural text flow)
        group.items.sort((a, b) => b.x - a.x); // Right to left
        const rowText = group.items.map(it => it.text).join(' ');
        if (rowText.trim()) {
          lines.push(cleanScheduleLineText(rowText));
        }
      }
    }
  } catch (workerErr) {
    console.warn('pdfjs extraction failed, using binary fallback:', workerErr);
    const fallbackText = extractTextFromBinaryPdf(arrayBuffer);
    fallbackText.split(/[\r\n]+/).forEach(l => {
      const cleaned = cleanScheduleLineText(l);
      if (cleaned) lines.push(cleaned);
    });
  }

  return lines;
}

/**
 * Tokenize shift line into distinct column segments.
 * Correctly distinguishes Day Shift, Night Shift, and ON Call supervisor.
 */
function extractShiftColumnsFromLine(
  remainingText: string,
  knownSupervisors: Set<string>
): { dayShift: string; nightShift: string; onCall: string } {
  let text = cleanScheduleLineText(remainingText);
  if (!text) return { dayShift: '', nightShift: '', onCall: '' };

  let onCall = '';

  // Check if a known supervisor name is present in the line first
  for (const supName of knownSupervisors) {
    const supCanonical = getCanonicalPersonKey(supName);
    if (!supCanonical) continue;

    const words = text.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const candidate = words.slice(i, i + 3).join(' ');
      if (getCanonicalPersonKey(candidate) === supCanonical) {
        onCall = supName;
        text = text.replace(candidate, ' ').trim();
        break;
      }
    }
    if (onCall) break;
  }

  // Protect hyphenated pairs and slash connectors so they stay within shift entities
  text = text.replace(/\s*[\-–—]\s*/g, '__LINK__');
  text = text.replace(/\s*[\/]\s*/g, '__LINK__');

  const words = text.split(/\s+/).filter(w => w.length > 0);
  const rawEntities: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const isNewTitle = (word === 'مهندس' || word === 'آقای' || word === 'خانم' || word === 'دکتر');

    if (isNewTitle && current && !current.endsWith('__LINK__')) {
      rawEntities.push(current.replace(/__LINK__/g, ' - ').trim());
      current = word;
    } else if (current) {
      current += ' ' + word;
    } else {
      current = word;
    }
  }

  if (current) {
    rawEntities.push(current.replace(/__LINK__/g, ' - ').trim());
  }

  // Filter entities: only keep valid candidates with person characteristics (strip out 'سه', 'شنبه', numbers, etc.)
  const cleanEntities = rawEntities
    .map(e => e.replace(/__LINK__/g, ' - ').trim())
    .filter(e => isValidPersonCandidate(e));

  let dayShift = '';
  let nightShift = '';

  if (cleanEntities.length === 1) {
    dayShift = cleanEntities[0];
  } else if (cleanEntities.length === 2) {
    dayShift = cleanEntities[0];
    nightShift = cleanEntities[1];
  } else if (cleanEntities.length >= 3) {
    dayShift = cleanEntities[0];
    nightShift = cleanEntities[1];

    // Check entity 3 and beyond
    for (let k = 2; k < cleanEntities.length; k++) {
      const extra = cleanEntities[k];
      const isKnownSup = Array.from(knownSupervisors).some(
        s => getCanonicalPersonKey(s) === getCanonicalPersonKey(extra)
      );

      if (isKnownSup && !onCall) {
        onCall = extra;
      } else {
        // It is an extra shift worker (multi-person), append to night shift with hyphen separator
        nightShift = nightShift ? `${nightShift} - ${extra}` : extra;
      }
    }
  }

  return { dayShift, nightShift, onCall };
}

export interface ParsePdfResult {
  shifts: ShiftEntry[];
  discoveredPersonnel: Personnel[];
  monthHint?: string;
  dateRange?: {
    from: DateParts;
    to: DateParts;
  };
}

/**
 * Parses official PDF shift schedules (both 4-column and 5-column formats)
 */
export async function parsePdfSchedule(
  file: File,
  knownPersonnel: Personnel[] = []
): Promise<ParsePdfResult> {
  const lines = await extractPdfLines(file);

  if (lines.length === 0) {
    throw new Error('محتوای متنی در این فایل PDF یافت نشد. لطفاً از فایل اکسل (.xlsx) استفاده کنید یا مطمئن شوید فایل اسکن تصویری غیرقابل خواندن نباشد.');
  }

  // Persian date regex: 14xx/xx/xx
  const dateRegex = /(14\d{2}\/\d{1,2}\/\d{1,2})/;

  // Collect known supervisor canonical names to prevent misclassification
  const knownSupervisorNames = new Set<string>();
  knownPersonnel.forEach(p => {
    if (p.roles.includes('Supervisor')) {
      knownSupervisorNames.add(p.name);
    }
  });

  const parsedShifts: ShiftEntry[] = [];
  const discoveredShiftPeople = new Set<string>();
  const discoveredSupervisors = new Set<string>();

  let activeSupervisor = '';

  for (const rawLine of lines) {
    const line = cleanScheduleLineText(rawLine);
    if (!line) continue;

    // Ignore headers / footers
    if (line.includes('برنامه شیفت') || line.includes('شیفت روز') || line.includes('OFF میباشند') || line.includes('از ساعت')) {
      continue;
    }

    const dateMatch = line.match(dateRegex);
    if (!dateMatch) continue;

    const rawDate = dateMatch[1];
    const dateParts = rawDate.split('/');
    const formattedDate = `${dateParts[0]}/${dateParts[1].padStart(2, '0')}/${dateParts[2].padStart(2, '0')}`;

    // Extract day name with exact Persian matcher or mathematically via Jalali calendar
    const calculatedDayName = getDayNameForJalali(
      parseInt(dateParts[0], 10),
      parseInt(dateParts[1], 10),
      parseInt(dateParts[2], 10)
    );
    const dayMatch = line.match(PERSIAN_DAY_REGEX);
    const dayName = dayMatch ? normalizePersianDayName(dayMatch[0]) : (calculatedDayName || 'نامشخص');

    // Remove day name and date from the line to extract shift participants
    let remaining = line.replace(rawDate, ' ');
    if (dayMatch) {
      remaining = remaining.replace(dayMatch[0], ' ');
    }
    remaining = remaining.trim();

    // Clean up unwanted keywords
    remaining = remaining
      .replace(/روز/g, '')
      .replace(/تاریخ/g, '')
      .replace(/ON Call/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract column segments
    const { dayShift, nightShift, onCall } = extractShiftColumnsFromLine(remaining, knownSupervisorNames);

    if (onCall) {
      activeSupervisor = onCall;
      discoveredSupervisors.add(onCall);
    }

    // Parse multi-person for Day & Night shifts
    const dayParsed = parsePersonField(dayShift);
    const nightParsed = parsePersonField(nightShift);

    if (dayParsed.primary && dayParsed.primary !== 'نامشخص' && isValidPersonCandidate(dayParsed.primary)) {
      discoveredShiftPeople.add(dayParsed.primary);
    }
    dayParsed.extras.forEach(extra => {
      if (isValidPersonCandidate(extra)) discoveredShiftPeople.add(extra);
    });

    if (nightParsed.primary && nightParsed.primary !== 'نامشخص' && isValidPersonCandidate(nightParsed.primary)) {
      discoveredShiftPeople.add(nightParsed.primary);
    }
    nightParsed.extras.forEach(extra => {
      if (isValidPersonCandidate(extra)) discoveredShiftPeople.add(extra);
    });

    parsedShifts.push({
      id: Math.floor(Math.random() * 90000000) + 10000000,
      date: formattedDate,
      dayName,
      dayShiftPerson: dayParsed.primary || 'نامشخص',
      extraDayPersons: dayParsed.extras.length > 0 ? dayParsed.extras : undefined,
      nightShiftPerson: nightParsed.primary || 'نامشخص',
      extraNightPersons: nightParsed.extras.length > 0 ? nightParsed.extras : undefined,
      onCallPerson: activeSupervisor || 'نامشخص',
      isHoliday: dayName === 'جمعه' || OFFICIAL_HOLIDAYS.includes(formattedDate),
    });
  }

  // Deduplicate and sort by date
  const shiftMap = new Map<string, ShiftEntry>();
  for (const s of parsedShifts) {
    shiftMap.set(s.date, s);
  }
  const finalShifts = Array.from(shiftMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  if (finalShifts.length === 0) {
    throw new Error('هیچ سطری حاوی تاریخ معتبر (مثلاً ۱۴۰۵/۰۵/۲۶) در فایل PDF شناسایی نشد.');
  }

  // Determine date range
  const firstDate = finalShifts[0].date;
  const lastDate = finalShifts[finalShifts.length - 1].date;
  const firstParts = firstDate.split('/');
  const lastParts = lastDate.split('/');

  const dateRange = {
    from: { year: firstParts[0], month: firstParts[1], day: firstParts[2] },
    to: { year: lastParts[0], month: lastParts[1], day: lastParts[2] },
  };

  const monthHint = `${firstParts[0]}/${firstParts[1]}`;

  // Build discovered personnel list
  const defaultColors = [
    '#2563eb', '#f97316', '#e11d48', '#059669', '#7c3aed', 
    '#0891b2', '#d97706', '#0284c7', '#4f46e5', '#ca8a04'
  ];
  let cIdx = 0;
  const discoveredPersonnel: Personnel[] = [];

  discoveredShiftPeople.forEach(name => {
    discoveredPersonnel.push({
      name,
      roles: ['Shift'],
      isActive: true,
      color: defaultColors[cIdx % defaultColors.length],
    });
    cIdx++;
  });

  discoveredSupervisors.forEach(name => {
    const existing = discoveredPersonnel.find(p => getCanonicalPersonKey(p.name) === getCanonicalPersonKey(name));
    if (existing) {
      if (!existing.roles.includes('Supervisor')) {
        existing.roles.push('Supervisor');
      }
    } else {
      discoveredPersonnel.push({
        name,
        roles: ['Supervisor'],
        isActive: true,
        color: defaultColors[cIdx % defaultColors.length],
      });
      cIdx++;
    }
  });

  // Unify duplicate names (e.g. سپهرآرا vs سپهر آرا) and map them accurately
  const { unifiedShifts, unifiedPersonnel } = unifyPersonnelAndShifts(
    finalShifts,
    discoveredPersonnel,
    knownPersonnel
  );

  return {
    shifts: unifiedShifts,
    discoveredPersonnel: unifiedPersonnel,
    monthHint,
    dateRange,
  };
}
