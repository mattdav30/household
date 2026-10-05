import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../lib/store';
import { ALL_TYPES, buildSession, PLACES, TYPE_INFO, type SessionType } from '../../lib/plan';
import { EXERCISES, type Area } from '../../lib/exercises';
import { C, S, tint } from '../../lib/theme';
import { Appear } from '../../components/Appear';
import { Card, Chips, Header, Icon, IconBadge, Loading, SectionTitle, styles as ui, tap } from '../../components/ui';
import { accentOf } from '../../components/fit';

const AREAS: { value: Area | 'partner'; label: string }[] = [
  { value: 'legs', label: 'Legs' }, { value: 'push', label: 'Push' }, { value: 'pull', label: 'Back' }, { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' }, { value: 'mobility', label: 'Stretch' }, { value: 'partner', label: 'Partner' },
];

export default function Moves() {
  const router = useRouter();
  const { summary, planInput } = useStore();
  const [area, setArea] = useState<Area | 'partner'>('legs');
  const [open, setOpen] = useState<string | null>(null);
  const p = useMemo(() => planInput(), [planInput]);
  const sessions = useMemo(() => (p ? ALL_TYPES.map((t) => buildSession(t, p)) : []), [p]);

  if (!summary || !p) return <View style={{ flex: 1 }}><Header title="Moves" /><Loading rows={5} /></View>;
  const me = summary.members.find((m) => m.id === summary.me)!;
  const start = (type: SessionType) => { tap(); router.push({ pathname: '/session', params: { type } }); };
  const have = new Set(['none', ...summary.settings.equipment]);
  const moves = EXERCISES.filter((e) => (area === 'partner' ? e.partner : e.area === area && !e.partner));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
      <Header eyebrow={`Step ${me.step} of ${summary.steps.length}`} title="Moves" subtitle="Guided sessions sized to your step. More unlock as you climb." />
      <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
        <Appear index={0}>
          <Card style={{ gap: S.sm }}>
            {summary.steps.map((s) => {
              const here = s.step === me.step;
              const done = s.step < me.step;
              return (
                <View key={s.step} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 4, opacity: s.step > me.step + 2 ? 0.5 : 1 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: here ? C.accent : done ? tint(C.green, 0.2) : C.raised }}>
                    {done ? <Icon name="check" size={16} color={C.green} /> : <Text style={{ color: here ? C.onAccent : C.sub, fontWeight: '800', fontSize: 13 }}>{s.step}</Text>}
                  </View>
                  <Text style={[ui.rowTitle, { flex: 1, color: here ? C.ink : done ? C.sub : C.sub, fontWeight: here ? '800' : '600' }]}>{s.title}</Text>
                  <Text style={[{ color: here ? C.accent : C.faint, fontWeight: '700', fontSize: 13 }, ui.num]}>{s.target} min</Text>
                </View>
              );
            })}
          </Card>
        </Appear>

        <SectionTitle>Guided sessions</SectionTitle>
        {sessions.map((s, i) => {
          const info = TYPE_INFO[s.type];
          const locked = info.unlock > me.step;
          const col = accentOf(info.color);
          return (
            <Appear key={s.type} index={i + 1}>
              <Pressable onPress={() => !locked && start(s.type)} disabled={locked} accessibilityRole="button" accessibilityState={{ disabled: locked }}
                accessibilityLabel={locked ? `${s.title}, unlocks at step ${info.unlock}` : `${s.title}, ${s.minutes} minutes`}
                style={({ pressed }) => [ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, opacity: locked ? 0.5 : pressed ? 0.85 : 1 }]}>
                <IconBadge name={(locked ? 'lock-outline' : info.icon) as never} color={locked ? C.faint : col} />
                <View style={{ flex: 1 }}>
                  <Text style={ui.rowTitle}>{s.title}</Text>
                  <Text style={ui.rowSub} numberOfLines={2}>{locked ? `Unlocks at step ${info.unlock}` : info.blurb}</Text>
                </View>
                {!locked ? <Text style={[{ color: C.sub, fontWeight: '700' }, ui.num]}>{s.minutes}m</Text> : null}
              </Pressable>
            </Appear>
          );
        })}

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
  );
}
