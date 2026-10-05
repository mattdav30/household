// Dates are stored as YYYY-MM-DD strings in local time.

export function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export const today = () => iso(new Date());
export function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s: string, n: number): string {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export function startOfWeek(s: string): string {
  const d = parse(s);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return iso(d);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function friendly(s: string | null): string {
  if (!s) return 'No date';
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, 1)) return 'Tomorrow';
  if (s === addDays(t, -1)) return 'Yesterday';
  const d = parse(s);
  const base = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}
export function dayName(s: string) { return DAYS[parse(s).getDay()]; }
export function dayNum(s: string) { return parse(s).getDate(); }
export function monthLabel(s: string) { const d = parse(s); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }

export function daysUntil(s: string): number {
  return Math.round((parse(s).getTime() - parse(today()).getTime()) / 86400000);
}

export function time12(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, '0')}${ap}` : `${hh}${ap}`;
}

export function money(cents: number | null): string {
  if (cents == null) return '';
  return '$' + (cents / 100).toLocaleString('en-AU', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
}
export function toCents(s: string): number | null {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : Math.round(n * 100);
}

export const REPEATS = ['none', 'daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'] as const;
export const repeatLabel = (r: string) => (r === 'none' ? 'Once' : r[0].toUpperCase() + r.slice(1));

/** friendly() for the middle of a sentence: "tomorrow", "Sat 3 Oct". */
export function friendlyInline(s: string | null): string {
  const f = friendly(s);
  return /^(Today|Tomorrow|Yesterday|No date)$/.test(f) ? f.toLowerCase() : f;
}
