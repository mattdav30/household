// Queensland public holidays, worked out by rule so every year is covered.
// Checked against queenslandpublicholidays.com.au for 2026.

const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const dow = (d: Date) => d.getUTCDay(); // 0 Sunday

/** Easter Sunday (anonymous Gregorian algorithm). */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), dd = ((h + l - 7 * m + 114) % 31) + 1;
  return day(y, month, dd);
}

/** The nth given weekday of a month, e.g. first Monday of May. */
function nthWeekday(y: number, m: number, weekday: number, n: number) {
  const first = day(y, m, 1);
  return addDays(first, ((weekday - dow(first) + 7) % 7) + (n - 1) * 7);
}

export type Holiday = { date: string; title: string; note?: string };

export function qldHolidays(y: number): Holiday[] {
  const out: Holiday[] = [];
  const taken = new Set<string>();
  const add = (d: Date, title: string, note?: string) => { out.push({ date: iso(d), title, note }); taken.add(iso(d)); };

  // Fixed days that move to the next free weekday when they land on a weekend.
  const withSubstitute = (d: Date, title: string) => {
    add(d, title);
    if (dow(d) === 0 || dow(d) === 6) {
      let s = addDays(d, dow(d) === 6 ? 2 : 1);
      while (taken.has(iso(s)) || dow(s) === 0 || dow(s) === 6) s = addDays(s, 1);
      add(s, `${title} (additional day)`);
    }
  };

  withSubstitute(day(y, 1, 1), "New Year's Day");
  withSubstitute(day(y, 1, 26), 'Australia Day');

  const e = easter(y);
  add(addDays(e, -2), 'Good Friday');
  add(addDays(e, -1), 'Easter Saturday');
  add(e, 'Easter Sunday');
  add(addDays(e, 1), 'Easter Monday');

  // Anzac Day moves only when it falls on a Sunday.
  const anzac = day(y, 4, 25);
  add(anzac, 'Anzac Day');
  if (dow(anzac) === 0) add(addDays(anzac, 1), 'Anzac Day (additional day)');

  add(nthWeekday(y, 5, 1, 1), 'Labour Day');

  // Ekka: the Wednesday after the first Friday in August, or the second Friday when the first falls before the 5th.
  let showFri = nthWeekday(y, 8, 5, 1);
  if (showFri.getUTCDate() < 5) showFri = addDays(showFri, 7);
  add(addDays(showFri, 5), 'Ekka (Brisbane)', 'Royal Queensland Show, Brisbane area only');

  add(nthWeekday(y, 10, 1, 1), "King's Birthday");

  out.push({ date: `${y}-12-24`, title: 'Christmas Eve (from 6pm)', note: 'Part-day public holiday, 6pm to midnight' });
  add(day(y, 12, 25), 'Christmas Day');
  add(day(y, 12, 26), 'Boxing Day');
  // Christmas and Boxing Day substitutes, checked together so they never collide.
  for (const [d, title] of [[day(y, 12, 25), 'Christmas Day'], [day(y, 12, 26), 'Boxing Day']] as const) {
    if (dow(d) === 0 || dow(d) === 6) {
      let s = day(y, 12, 27);
      while (taken.has(iso(s)) || dow(s) === 0 || dow(s) === 6) s = addDays(s, 1);
      add(s, `${title} (additional day)`);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Holidays between two dates, shaped like calendar events. */
export function holidayEvents(from: string, to: string) {
  const out = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    for (const h of qldHolidays(y)) {
      if (h.date < from || h.date > to) continue;
      out.push({
        id: 'hol-' + h.date + '-' + h.title.length, title: h.title, date: h.date, series_date: h.date,
        start_time: h.title.startsWith('Christmas Eve') ? '18:00' : null, end_time: null, who: 'both',
        location: null, notes: h.note ?? null, color: '#E8B931', repeat: 'none', repeat_until: null, holiday: true,
      });
    }
  }
  return out;
}
