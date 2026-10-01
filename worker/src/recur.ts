// Expands repeating calendar events into the dates they fall on.

const DAY = 86400000;
const toMs = (d: string) => Date.parse(d + 'T00:00:00Z');
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function addMonths(start: string, n: number): string {
  const d = new Date(start + 'T00:00:00Z');
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return toIso(target.getTime());
}

const STEP_DAYS: Record<string, number> = { daily: 1, weekly: 7, fortnightly: 14 };
const STEP_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };

/** Every date the event lands on between from and to, inclusive. */
export function occurrences(start: string, repeat: string, until: string | null, exdates: string[], from: string, to: string): string[] {
  const end = until && until < to ? until : to;
  const skip = new Set(exdates);
  const out: string[] = [];
  if (!repeat || repeat === 'none') {
    if (start >= from && start <= to && !skip.has(start)) out.push(start);
    return out;
  }
  if (STEP_DAYS[repeat]) {
    const step = STEP_DAYS[repeat] * DAY;
    let n = Math.max(0, Math.floor((toMs(from) - toMs(start)) / step));
    for (let ms = toMs(start) + n * step; toIso(ms) <= end; ms += step, n++) {
      const d = toIso(ms);
      if (d >= from && !skip.has(d)) out.push(d);
    }
    return out;
  }
  if (STEP_MONTHS[repeat]) {
    const k = STEP_MONTHS[repeat];
    const s = new Date(start + 'T00:00:00Z');
    const f = new Date(from + 'T00:00:00Z');
    const monthsApart = (f.getUTCFullYear() - s.getUTCFullYear()) * 12 + (f.getUTCMonth() - s.getUTCMonth());
    let n = Math.max(0, Math.floor(monthsApart / k) - 1);
    for (let i = 0; i < 400; i++, n++) {
      const d = addMonths(start, n * k);
      if (d > end) break;
      if (d >= from && !skip.has(d)) out.push(d);
    }
  }
  return out;
}

type EventRow = { date: string; repeat?: string; repeat_until?: string | null; exdates?: string; [k: string]: unknown };

/** Turns stored events into one row per date, sorted by date and time. */
export function expandEvents<T extends EventRow>(rows: T[], from: string, to: string) {
  const out: (T & { series_date: string })[] = [];
  for (const r of rows) {
    let ex: string[] = [];
    try { ex = JSON.parse(r.exdates || '[]'); } catch { ex = []; }
    for (const d of occurrences(r.date, r.repeat || 'none', r.repeat_until ?? null, ex, from, to)) {
      out.push({ ...r, series_date: r.date, date: d });
    }
  }
  return out.sort((a, b) => (a.date + (a.start_time ?? '')).localeCompare(b.date + (b.start_time ?? '')));
}
