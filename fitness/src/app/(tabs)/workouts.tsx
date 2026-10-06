import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../lib/store';
import { buildSession, GROUPS, HAS_LENGTH, PLACES, todaysSession, TYPE_INFO, type SessionType } from '../../lib/plan';
import { EXERCISES, type Area } from '../../lib/exercises';
import { C, S, tint } from '../../lib/theme';
import { Appear } from '../../components/Appear';
import { Button, Card, Chips, Header, Icon, Loading, SectionTitle, styles as ui, tap } from '../../components/ui';
import { LogSheet, accentOf } from '../../components/fit';

const AREAS: { value: Area | 'partner'; label: string }[] = [
  { value: 'legs', label: 'Legs' }, { value: 'push', label: 'Push' }, { value: 'pull', label: 'Back' }, { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' }, { value: 'mobility', label: 'Stretch' }, { value: 'partner', label: 'Partner' },
];

export default function Workouts() {
  const router = useRouter();
  const { summary, planInput } = useStore();
  const [len, setLen] = useState('20');
  const [logging, setLogging] = useState(false);
  const [library, setLibrary] = useState(false);
  const [area, setArea] = useState<Area | 'partner'>('legs');
  const [open, setOpen] = useState<string | null>(null);
  const p = useMemo(() => planInput({ minutes: Number(len) }), [planInput, len]);
  const sessions = useMemo(() => {
    if (!p) return {} as Record<SessionType, ReturnType<typeof buildSession>>;
    const out = {} as Record<SessionType, ReturnType<typeof buildSession>>;
    for (const g of GROUPS) for (const t of g.types) out[t] = buildSession(t, p);
    return out;
  }, [p]);
  const today = useMemo(() => (p ? todaysSession({ ...p, minutes: undefined }) : null), [p]);

  if (!summary || !p || !today) return <View style={{ flex: 1 }}><Header title="Workouts" /><Loading rows={5} /></View>;
  const me = summary.members.find((m) => m.id === summary.me)!;
  const start = (type: SessionType) => {
    tap();
    router.push({ pathname: '/session', params: { type, shuffle: String(Math.floor(Math.random() * 1000)), ...(HAS_LENGTH.includes(type) ? { minutes: len } : {}) } });
  };
  const have = new Set(['none', 'chair', ...summary.settings.equipment]);
  const moves = EXERCISES.filter((e) => (area === 'partner' ? e.partner : e.area === area && !e.partner));
  const todayInfo = TYPE_INFO[today.session.type];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Header eyebrow={`Step ${me.step} · sized to you`} title="Workouts" subtitle="Tap one to see the moves, then Start." />
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          <Appear index={0}>
            <Pressable onPress={() => start(today.session.type)} accessibilityRole="button"
              style={({ pressed }) => [ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: tint(accentOf(todayInfo.color), 0.12), borderColor: accentOf(todayInfo.color), opacity: pressed ? 0.85 : 1 }]}>
              <Icon name="star-four-points" size={26} color={accentOf(todayInfo.color)} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.sub, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>TODAY'S PICK</Text>
                <Text style={ui.rowTitle}>{today.session.title}</Text>
                <Text style={ui.rowSub}>{today.session.minutes} min · {todayInfo.blurb}</Text>
              </View>
              <Icon name="play-circle" size={34} color={accentOf(todayInfo.color)} />
            </Pressable>
          </Appear>

          <Appear index={1}>
            <Chips label="Length for home workouts" value={len} onChange={setLen} options={[{ value: '10', label: '10 min' }, { value: '20', label: '20 min' }, { value: '30', label: '30 min' }]} />
          </Appear>

          {GROUPS.map((g, gi) => (
            <Appear key={g.title} index={gi + 2}>
              <SectionTitle>{g.title}</SectionTitle>
              <Text style={{ color: C.sub, fontSize: 13, marginTop: -S.xs, marginBottom: S.sm, paddingHorizontal: S.xs }}>{g.sub}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
                {g.types.map((t) => {
                  const info = TYPE_INFO[t];
                  const s = sessions[t];
                  const col = accentOf(info.color);
                  return (
                    <Pressable key={t} onPress={() => start(t)} accessibilityRole="button" accessibilityLabel={`${s.title}, ${s.minutes} minutes`}
                      style={({ pressed }) => [ui.card, { width: '48.6%', gap: 6, padding: S.md, opacity: pressed ? 0.85 : 1 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: tint(col, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name={info.icon as never} size={22} color={col} />
                        </View>
                        <Text style={[{ color: C.sub, fontWeight: '800' }, ui.num]}>{s.minutes}m</Text>
                      </View>
                      <Text style={[ui.rowTitle, { fontSize: 15 }]} numberOfLines={1}>{s.title}</Text>
                      <Text style={{ color: C.sub, fontSize: 12, lineHeight: 16 }} numberOfLines={2}>{info.blurb}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Appear>
          ))}

          <View style={{ marginTop: S.lg }}>
            <Button title="Did something else? Log it" kind="soft" icon="plus" onPress={() => setLogging(true)} />
          </View>

          <SectionTitle>Free spots for a walk</SectionTitle>
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

          <SectionTitle right={<Pressable onPress={() => setLibrary(!library)}><Text style={{ color: C.accent, fontWeight: '700' }}>{library ? 'Hide' : 'Show'}</Text></Pressable>}>All {EXERCISES.length} moves</SectionTitle>
          {library ? (
            <>
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
                        {e.seated ? <Text style={{ color: C.faint, fontSize: 12 }}>seated</Text> : null}
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
            </>
          ) : null}
        </View>
      </ScrollView>
      <LogSheet visible={logging} onClose={() => setLogging(false)} />
    </View>
  );
}
