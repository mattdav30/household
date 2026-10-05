import { FlexWidget, TextWidget } from 'react-native-android-widget';

export type WidgetData = {
  title: string;
  line: string;
  bowls: { name: string; fed: boolean }[];
  streak: number;
  label: string;
  pct: number;
};

type Hex = `#${string}`;
const PALETTE: Record<'dark' | 'light', Record<'bg' | 'ink' | 'sub' | 'accent' | 'chip' | 'track' | 'gold' | 'green', Hex>> = {
  dark: { bg: '#17152A', ink: '#EEEDF7', sub: '#A3A1BC', accent: '#8B93FF', chip: '#211F39', track: '#27253F', gold: '#F2C96B', green: '#34C08A' },
  light: { bg: '#FFFFFF', ink: '#17162B', sub: '#5E5C78', accent: '#5560E8', chip: '#F1F0F8', track: '#E3E1EE', gold: '#A87A12', green: '#16835E' },
};

/** Home screen widget: how the pet feels, who has fed it today, and your step progress. */
export function JourneyWidget({ data, mode, message }: { data: WidgetData | null; mode: 'dark' | 'light'; message?: string }) {
  const c = PALETTE[mode];
  return (
    <FlexWidget clickAction="OPEN_APP" accessibilityLabel="Road to Tokyo"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.bg, borderRadius: 22, padding: 14, flexDirection: 'column', flexGap: 8 }}>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'center' }}>
        <TextWidget text={data ? data.label : 'ROAD TO TOKYO'} style={{ fontSize: 11, color: c.accent, fontWeight: '700', letterSpacing: 0.08 }} />
        <FlexWidget style={{ flex: 1 }} />
        {data ? <TextWidget text={`${data.streak} day streak`} style={{ fontSize: 12, color: c.gold, fontWeight: '700' }} /> : null}
      </FlexWidget>
      {message || !data ? (
        <TextWidget text={message ?? 'Open the app to load your day.'} style={{ fontSize: 14, color: c.sub }} maxLines={2} />
      ) : (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', flex: 1, flexGap: 6 }}>
          <TextWidget text={data.title} style={{ fontSize: 17, color: c.ink, fontWeight: '700' }} maxLines={1} truncate="END" />
          <FlexWidget style={{ flexDirection: 'row', flexGap: 8 }}>
            {data.bowls.map((b, i) => (
              <FlexWidget key={i} style={{ backgroundColor: c.chip, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
                <TextWidget text={`${b.fed ? '●' : '○'} ${b.name}`} style={{ fontSize: 12, color: b.fed ? c.green : c.sub, fontWeight: '700' }} />
              </FlexWidget>
            ))}
          </FlexWidget>
        </FlexWidget>
      )}
      {data ? (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', flexGap: 5 }}>
          <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', height: 6, backgroundColor: c.track, borderRadius: 3 }}>
            <FlexWidget style={{ height: 6, width: Math.max(6, Math.round(data.pct * 260)), backgroundColor: data.pct >= 1 ? c.green : c.accent, borderRadius: 3 }} />
          </FlexWidget>
          <TextWidget text={data.line} style={{ fontSize: 12, color: c.sub }} />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
