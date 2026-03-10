// Nepali Bikram Sambat calendar utilities

const NEPALI_MONTHS = [
  { en: 'Baisakh', np: 'बैशाख' },
  { en: 'Jestha', np: 'जेठ' },
  { en: 'Ashadh', np: 'असार' },
  { en: 'Shrawan', np: 'श्रावण' },
  { en: 'Bhadra', np: 'भाद्र' },
  { en: 'Ashwin', np: 'आश्विन' },
  { en: 'Kartik', np: 'कार्तिक' },
  { en: 'Mangsir', np: 'मंसिर' },
  { en: 'Poush', np: 'पौष' },
  { en: 'Magh', np: 'माघ' },
  { en: 'Falgun', np: 'फाल्गुन' },
  { en: 'Chaitra', np: 'चैत्र' },
];

// Days in each month for BS years 2070-2090
const BS_CALENDAR: Record<number, number[]> = {
  2070: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2073: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2074: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2075: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2077: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2078: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2079: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2080: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2082: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2085: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2086: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2087: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2088: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2089: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2090: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
};

export interface NepaliDate {
  year: number;
  month: number; // 1-12
  day: number;
}

export function getNepaliMonths() {
  return NEPALI_MONTHS;
}

export function getNepaliMonthName(month: number, lang: 'en' | 'np' = 'en'): string {
  return NEPALI_MONTHS[month - 1]?.[lang] || '';
}

export function getDaysInMonth(year: number, month: number): number {
  const yearData = BS_CALENDAR[year];
  if (!yearData) return 30;
  return yearData[month - 1] || 30;
}

export function getAvailableYears(): number[] {
  return Object.keys(BS_CALENDAR).map(Number);
}

export function getTodayNepali(): NepaliDate {
  // Approximate conversion - for production use a proper library
  // Using rough offset: 2080-01-01 BS ≈ 2023-04-14 AD
  const now = new Date();
  const refAD = new Date(2023, 3, 14); // April 14, 2023
  const refBS: NepaliDate = { year: 2080, month: 1, day: 1 };
  
  let diffDays = Math.floor((now.getTime() - refAD.getTime()) / (1000 * 60 * 60 * 24));
  
  let year = refBS.year;
  let month = refBS.month;
  let day = refBS.day;
  
  day += diffDays;
  
  while (day > getDaysInMonth(year, month)) {
    day -= getDaysInMonth(year, month);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  
  while (day < 1) {
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
    day += getDaysInMonth(year, month);
  }
  
  return { year, month, day };
}

export function formatNepaliDate(date: NepaliDate, lang: 'en' | 'np' = 'en'): string {
  const monthName = getNepaliMonthName(date.month, lang);
  return `${date.day} ${monthName} ${date.year}`;
}

export function nepaliDateToKey(date: NepaliDate): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}
