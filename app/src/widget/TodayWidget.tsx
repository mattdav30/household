import { FlexWidget, TextWidget } from 'react-native-android-widget';

export type WidgetData = {
  today: string;
  events: { title: string; date: string; start_time: string | null; holiday?: boolean; color?: string | null }[];
  meals: { title: string; slot: string }[];
  shopping_open: number;
  chores: unknown[];
  updatedAt: number;
};

type Hex = `#${string}`;
const PALETTE: Record<'dark' | 'light', Record<'bg' | 'ink' | 'sub' | 'line' | 'accent' | 'chip', Hex>> = {
  dark: { bg: '#141A18', ink: '#ECF2EF', sub: '#97A39E', line: '#232D29', accent: '#34C08A', chip: '#1C2421' },
  light: { bg: '#FFFFFF', ink: '#16201C', sub: '#5F6B66', line: '#E4E0D8', accent: '#16835E', chip: '#F4F2EE' },
};
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function time12(t: string | null) {
  if (!t) return 'All day';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''}${h >= 12 ? 'pm' : 'am'}`;
}
function dayLabel(date: string, today: string) {
  if (date === today) return '';
  const d = new Date(date + 'T00:00:00');
  return DAYS[d.getDay()].slice(0, 1) + DAYS[d.getDay()].slice(1).toLowerCase() + ' ';
}

/** The Today home screen widget: date, next events, tonight's dinner and the shopping count. */
export function TodayWidget({ data, mode, message }: { data: WidgetData | null; mode: 'dark' | 'light'; message?: string }) {
  const c = PALETTE[mode];
  const now = new Date();
  const header = data
    ? (() => { const d = new Date(data.today + 'T00:00:00'); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; })()
    : `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  const events = (data?.events ?? []).slice(0, 3);
  const dinner = data?.meals.find((m) => m.slot === 'dinner') ?? data?.meals[0];

  return (
    <FlexWidget clickAction="OPEN_APP" accessibilityLabel="Household today"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.bg, borderRadius: 22, padding: 16, flexDirection: 'column', flexGap: 8 }}>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'center' }}>
        <TextWidget text={header} style={{ fontSize: 12, color: c.accent, fontWeight: '700', letterSpacing: 0.08 }} />
        <FlexWidget style={{ flex: 1 }} />
        <TextWidget text="Household" style={{ fontSize: 12, color: c.sub }} />
      </FlexWidget>

      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'household:///calendar' }}
        style={{ flexDirection: 'column', width: 'match_parent', flexGap: 5, flex: 1 }}>
        {message ? <TextWidget text={message} style={{ fontSize: 14, color: c.sub }} maxLines={2} /> : null}
        {!message && !events.length ? <TextWidget text="Nothing on the calendar." style={{ fontSize: 15, color: c.sub }} /> : null}
        {events.map((e, i) => (
          <FlexWidget key={i} style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'center', flexGap: 8 }}>
            <FlexWidget style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: (e.color ?? c.accent) as Hex }} />
            <TextWidget text={e.holiday ? `${dayLabel(e.date, data!.today)}Holiday` : `${dayLabel(e.date, data!.today)}${time12(e.start_time)}`}
              style={{ fontSize: 13, color: c.sub, fontWeight: '700' }} />
            <TextWidget text={e.title} style={{ fontSize: 14, color: c.ink, fontWeight: '600' }} maxLines={1} truncate="END" />
          </FlexWidget>
        ))}
      </FlexWidget>

      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', flexGap: 8 }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'household:///meals' }}
          style={{ flex: 1, backgroundColor: c.chip, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'column' }}>
          <TextWidget text="Dinner" style={{ fontSize: 11, color: c.sub, fontWeight: '700' }} />
          <TextWidget text={dinner ? dinner.title : 'Not planned'} style={{ fontSize: 14, color: dinner ? c.ink : c.sub, fontWeight: '700' }} maxLines={1} truncate="END" />
        </FlexWidget>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'household:///shopping' }}
          style={{ backgroundColor: c.chip, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'column' }}>
          <TextWidget text="To buy" style={{ fontSize: 11, color: c.sub, fontWeight: '700' }} />
          <TextWidget text={data ? String(data.shopping_open) : '-'} style={{ fontSize: 14, color: c.ink, fontWeight: '700' }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
