import { FlexWidget, TextWidget } from 'react-native-android-widget';

export type WidgetData = {
  session: string;
  minutes: number;
  done: boolean;
  streak: number;
  week: number;
  goal: number;
  next: string | null;
  kmLeft: number;
  days: number;
};

type Hex = `#${string}`;
const PALETTE: Record<'dark' | 'light', Record<'bg' | 'ink' | 'sub' | 'accent' | 'chip' | 'track' | 'gold', Hex>> = {
  dark: { bg: '#17152A', ink: '#EEEDF7', sub: '#A3A1BC', accent: '#8B93FF', chip: '#211F39', track: '#27253F', gold: '#F2C96B' },
  light: { bg: '#FFFFFF', ink: '#17162B', sub: '#5E5C78', accent: '#5560E8', chip: '#F1F0F8', track: '#E3E1EE', gold: '#A87A12' },
};

/** Home screen widget: today's session, streak, this week's minutes and the next stop. */
export function JourneyWidget({ data, mode, message }: { data: WidgetData | null; mode: 'dark' | 'light'; message?: string }) {
  const c = PALETTE[mode];
  const pct = data ? Math.min(1, data.week / Math.max(1, data.goal)) : 0;
  return (
    <FlexWidget clickAction="OPEN_APP" accessibilityLabel="Road to Tokyo"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.bg, borderRadius: 22, padding: 14, flexDirection: 'column', flexGap: 8 }}>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'center' }}>
        <TextWidget text={data ? `${data.days} DAYS TO GO` : 'ROAD TO TOKYO'} style={{ fontSize: 11, color: c.accent, fontWeight: '700', letterSpacing: 0.08 }} />
        <FlexWidget style={{ flex: 1 }} />
        {data ? <TextWidget text={`${data.streak} day streak`} style={{ fontSize: 12, color: c.gold, fontWeight: '700' }} /> : null}
      </FlexWidget>
      {message || !data ? (
        <TextWidget text={message ?? 'Open the app to load your plan.'} style={{ fontSize: 14, color: c.sub }} maxLines={2} />
      ) : (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', flex: 1, flexGap: 2 }}>
          <TextWidget text={data.done ? 'Done for today' : data.session} style={{ fontSize: 17, color: c.ink, fontWeight: '700' }} maxLines={1} truncate="END" />
          <TextWidget text={data.done ? 'Nice work. Rest up.' : `${data.minutes} min, or ten if the drive is low`} style={{ fontSize: 13, color: c.sub }} maxLines={1} />
        </FlexWidget>
      )}
      {data ? (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', flexGap: 5 }}>
          <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', height: 6, backgroundColor: c.track, borderRadius: 3 }}>
            <FlexWidget style={{ height: 6, width: Math.max(6, Math.round(pct * 260)), backgroundColor: c.accent, borderRadius: 3 }} />
          </FlexWidget>
          <FlexWidget style={{ flexDirection: 'row', width: 'match_parent' }}>
            <TextWidget text={`${data.week} of ${data.goal} min this week`} style={{ fontSize: 12, color: c.sub }} />
            <FlexWidget style={{ flex: 1 }} />
            {data.next ? <TextWidget text={`${data.kmLeft.toLocaleString()} km to ${data.next}`} style={{ fontSize: 12, color: c.sub }} /> : null}
          </FlexWidget>
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
