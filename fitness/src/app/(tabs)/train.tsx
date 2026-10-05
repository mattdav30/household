import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../lib/store';
import { ALL_TYPES, buildSession, PLACES, TYPE_INFO, type SessionType } from '../../lib/plan';
import { EXERCISES, type Area } from '../../lib/exercises';
import { C, S } from '../../lib/theme';
import { Appear } from '../../components/Appear';
import { Button, Card, Chips, Header, Icon, IconBadge, Loading, SectionTitle, Sheet, styles as ui, tap } from '../../components/ui';
import { Wheel, accentOf } from '../../components/fit';

const AREAS: { value: Area | 'partner'; label: string }[] = [
  { value: 'legs', label: 'Legs' }, { value: 'push', label: 'Push' }, { value: 'pull', label: 'Back' }, { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' }, { value: 'mobility', label: 'Stretch' }, { value: 'partner', label: 'Partner' },
];

export default function Train() {
  const router = useRouter();
  const { summary, planInput } = useStore();
  const [spinOpen, setSpinOpen] = useState(false);
  const [picked, setPicked] = useState<SessionType | null>(null);
  const [area, setArea] = useState<Area | 'partner'>('legs');
  const [open, setOpen] = useState<string | null>(null);

  const p = useMemo(() => planInput(), [planInput]);
  const sessions = useMemo(() => (p ? ALL_TYPES.map((t) => buildSession(t, p)) : []), [p]);
  const outdoorOk = !(p?.weather && (p.weather.rainChance >= 60 || p.weather.maxTemp >= 34));
  const wheelTypes = ALL_TYPES.filter((t) => t !== 'quick' && (outdoorOk || (t !== 'walk' && t !== 'stairs')));
  const start = (type: SessionType) => { tap(); setSpinOpen(false); router.push({ pathname: '/session', params: { type, shuffle: String(Math.floor(Math.random() * 1000)) } }); };
  const have = new Set(['none', ...(summary?.settings.equipment ?? [])]);
  const moves = EXERCISES.filter((e) => (area === 'partner' ? e.partner : e.area === area && !e.partner));

  if (!summary || !p) return <View style={{ flex: 1 }}><Header title="Train" /><Loading rows={5} /></View>;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Header eyebrow="No gym needed" title="Train" subtitle="Pick a session, or let the wheel decide." />
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          <Appear index={0}>
            <Pressable onPress={() => { tap(); setPicked(null); setSpinOpen(true); }} accessibilityRole="button"
              style={({ pressed }) => [ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.accentSoft, borderColor: C.accent, opacity: pressed ? 0.85 : 1 }]}>
              <IconBadge name="dice-multiple" color={C.accent} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={ui.h2}>Spin the wheel</Text>
                <Text style={ui.rowSub}>Can't decide? The wheel picks for you.{outdoorOk ? '' : ' Outdoor options are off today because of the weather.'}</Text>
              </View>
            </Pressable>
          </Appear>

          <SectionTitle>Sessions</SectionTitle>
          {sessions.map((s, i) => {
            const info = TYPE_INFO[s.type];
            const col = accentOf(info.color);
            return (
              <Appear key={s.type} index={i + 1}>
                <Pressable onPress={() => start(s.type)} accessibilityRole="button" accessibilityLabel={`${s.title}, ${s.minutes} minutes`}
                  style={({ pressed }) => [ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, opacity: pressed ? 0.85 : 1 }]}>
                  <IconBadge name={info.icon as never} color={col} />
                  <View style={{ flex: 1 }}>
                    <Text style={ui.rowTitle}>{s.title}</Text>
                    <Text style={ui.rowSub} numberOfLines={2}>{info.blurb}</Text>
                  </View>
                  <Text style={[{ color: C.sub, fontWeight: '700' }, ui.num]}>{s.minutes}m</Text>
                </Pressable>
              </Appear>
            );
          })}

          <SectionTitle>Free outdoor spots</SectionTitle>
          <Card style={{ paddingVertical: S.xs }}>
            {PLACES.map((pl, i) => (
              <View key={pl.name} style={[ui.row, { alignItems: 'flex-start' }, i ? { borderTopWidth: 1, borderTopColor: C.line } : null]}>
                <Icon name={pl.for.includes('stairs') ? 'stairs' : 'walk'} color={C.green} />
                <View style={{ flex: 1 }}>
                  <Text style={ui.rowTitle}>{pl.name}</Text>
                  <Text style={ui.rowSub}>{pl.tip}</Text>
                </View>
              </View>
            ))}
          </Card>

          <SectionTitle>Move library</SectionTitle>
          <Chips value={area} onChange={(a) => { setArea(a); setOpen(null); }} options={AREAS} />
          <Card style={{ paddingVertical: S.xs }}>
            {moves.map((e, i) => {
              const on = open === e.id;
              const usable = have.has(e.equip);
              return (
                <Pressable key={e.id} onPress={() => setOpen(on ? null : e.id)} accessibilityRole="button" accessibilityState={{ expanded: on }}
                  style={[{ paddingVertical: S.md, gap: 6 }, i ? { borderTopWidth: 1, borderTopColor: C.line } : null]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                    <Text style={[ui.rowTitle, { flex: 1, color: usable ? C.ink : C.sub }]}>{e.name}</Text>
                    {e.impact === 'high' ? <Text style={{ color: C.faint, fontSize: 12 }}>jumping</Text> : null}
                    {!usable ? <Text style={{ color: C.faint, fontSize: 12 }}>needs {e.equip}</Text> : null}
                    <Icon name={on ? 'chevron-up' : 'chevron-down'} size={20} color={C.faint} />
                  </View>
                  {on ? (
                    <>
                      <Text style={{ color: C.sub, lineHeight: 20 }}>{e.how}</Text>
                      {e.easier ? <Text style={{ color: C.green, fontSize: 13 }}>Easier: {e.easier}</Text> : null}
                      {e.harder ? <Text style={{ color: C.gold, fontSize: 13 }}>Harder: {e.harder}</Text> : null}
                    </>
                  ) : null}
                </Pressable>
              );
            })}
          </Card>
        </View>
      </ScrollView>

      <Sheet visible={spinOpen} title="Spin the wheel" onClose={() => setSpinOpen(false)}>
        <Wheel options={wheelTypes} onPicked={setPicked} />
        {picked ? (
          <View style={[ui.card, { gap: S.md, backgroundColor: C.raised }]}>
            <Text style={ui.h2}>{TYPE_INFO[picked].label}</Text>
            <Text style={{ color: C.sub }}>{TYPE_INFO[picked].blurb}</Text>
            <Button title="Start this one" icon="play" onPress={() => start(picked)} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
