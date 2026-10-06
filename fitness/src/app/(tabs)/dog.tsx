import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useStore } from '../../lib/store';
import { api, type Summary } from '../../lib/api';
import { C, S, tint } from '../../lib/theme';
import { Appear } from '../../components/Appear';
import { Card, Header, Icon, IconBadge, Loading, SectionTitle, styles as ui, tap, type IconName } from '../../components/ui';
import { Pet3D, TRICK_INFO, type PetAction, type Trick } from '../../components/pet3d/Pet3D';
import { CatchGame, FetchGame, FindGame } from '../../components/games/Games';

const TRICK_ORDER: Trick[] = ['sit', 'paw', 'spin', 'roll', 'bow', 'beg', 'zoomies', 'dance'];
const WEAR_ICON: Record<string, IconName> = {
  party: 'party-popper', bow: 'ribbon', glasses: 'sunglasses', beanie: 'snowflake', flowers: 'flower', cap: 'hat-fedora', bowtie: 'tie', veil: 'ring',
};
const GAMES: { id: 'fetch' | 'catch' | 'find'; title: string; blurb: string; icon: IconName; color: string }[] = [
  { id: 'fetch', title: 'Fetch', blurb: 'Time your throw for a mid air catch', icon: 'tennis-ball', color: '#9BC53D' },
  { id: 'catch', title: 'Treat catch', blurb: 'Slide the bowl, dodge bath time', icon: 'bone', color: '#F2C96B' },
  { id: 'find', title: 'Find the bone', blurb: 'Follow the bowl through the shuffle', icon: 'bowl', color: '#F59AB8' },
];

export default function Dog() {
  const { summary, apply, partner } = useStore();
  const { width } = useWindowDimensions();
  const [action, setAction] = useState<PetAction | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [game, setGame] = useState<null | 'fetch' | 'catch' | 'find'>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!said) return; const t = setTimeout(() => setSaid(null), 4000); return () => clearTimeout(t); }, [said]);

  const play = useCallback(async (kind: string, score = 0) => {
    try { apply(await api<Summary>('/api/fit/pet/play', { method: 'POST', body: { kind, score } })); return true; }
    catch (e) { setSaid((e as Error).message); return false; }
  }, [apply]);

  if (!summary) return <View style={{ flex: 1 }}><Header title="Your dog" /><Loading rows={4} /></View>;
  const pet = summary.pet;
  const name = pet.name ?? 'Your dog';
  const next = pet.stages.find((s) => !s.reached);
  const daysLeft = next ? next.at - pet.growth : 0;

  const doTrick = (t: Trick) => {
    tap();
    setAction({ name: t, id: Date.now() });
    setSaid(['Good dog!', 'Who is a clever pup?', 'Nailed it!', `Yes ${name}!`][Math.floor(Math.random() * 4)]);
    play('trick');
  };
  const treat = async () => {
    if (busy) return;
    if (pet.treats < 1) { setSaid('No treats left. Every ten minutes of moving earns one.'); return; }
    tap();
    setBusy(true);
    setAction({ name: 'treat', id: Date.now() });
    if (await play('treat')) setSaid('Nom nom nom. Thank you!');
    setBusy(false);
  };
  const buy = async (id: string, cost: number, label: string) => {
    if (pet.treats < cost) { Alert.alert(`${label} costs ${cost} treats`, `You have ${pet.treats}. Every ten minutes of moving earns one treat.`); return; }
    Alert.alert(`Buy the ${label.toLowerCase()}?`, `It costs ${cost} treats. ${partner ? `${partner.name} will see it too.` : ''}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Buy', onPress: async () => { try { apply(await api<Summary>('/api/fit/pet/buy', { method: 'POST', body: { item: id } })); setAction({ name: 'spin', id: Date.now() }); } catch (e) { Alert.alert('That did not work', (e as Error).message); } } },
    ]);
  };
  const wear = async (id: string | null) => {
    tap();
    try { apply(await api<Summary>('/api/fit/pet/wear', { method: 'POST', body: { item: id } })); } catch { /* next refresh */ }
  };
  const finishGame = (kind: 'fetch' | 'catch' | 'find') => async (score: number) => { await play(kind, score); };

  const line = said ?? (pet.fun < 25 ? `I'm bored. Play with me?` : pet.treats > 0 ? `I can smell ${pet.treats} ${pet.treats === 1 ? 'treat' : 'treats'}…` : 'Stroke my head, I love pats.');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Header eyebrow={`${pet.stage_name} · stage ${pet.stage + 1} of ${pet.stages.length}`} title={name} />
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          <Appear index={0}>
            <View style={[ui.card, { alignItems: 'center', gap: S.sm, paddingHorizontal: 0 }]}>
              <View style={{ backgroundColor: C.raised, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '88%' }}>
                <Text style={{ color: C.ink, fontWeight: '600', textAlign: 'center' }} accessibilityLiveRegion="polite">{line}</Text>
              </View>
              <Pet3D color={pet.color} mood={pet.mood} stage={pet.stage} wearing={pet.wearing} size={width - S.lg * 2 - 2} height={300}
                action={action} onPat={() => { setSaid('Aww, more pats please.'); play('pat'); }} onTap={() => setSaid(['Woof!', 'Hehe', 'Again!', 'Walkies?'][Math.floor(Math.random() * 4)])} />
              <Text style={{ color: C.faint, fontSize: 12 }}>Tap to say hi · stroke up and down to pat · drag to spin</Text>
              <View style={{ flexDirection: 'row', gap: S.md, alignSelf: 'stretch', paddingHorizontal: S.lg, marginTop: S.sm }}>
                <Meter label="Play" value={pet.fun} color={C.warm} icon="heart" />
                <Meter label="Fed today" value={Object.values(pet.fed).filter(Boolean).length / Math.max(1, Object.keys(pet.fed).length) * 100} color={C.green} icon="bowl" />
              </View>
            </View>
          </Appear>

          <Appear index={1}>
            <Pressable onPress={treat} accessibilityRole="button" style={({ pressed }) => [ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, opacity: pressed ? 0.8 : 1, borderColor: tint(C.gold, 0.5) }]}>
              <IconBadge name="bone" color={C.gold} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={ui.rowTitle}>Give a treat</Text>
                <Text style={ui.rowSub}>{pet.treats} {pet.treats === 1 ? 'treat' : 'treats'} · every 10 minutes of moving earns one</Text>
              </View>
              <Icon name="chevron-right" color={C.faint} />
            </Pressable>
          </Appear>

          <SectionTitle right={<Text style={{ color: C.sub, fontWeight: '700' }}>{pet.tricks.length} of {TRICK_ORDER.length}</Text>}>Tricks</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
            {TRICK_ORDER.map((t) => {
              const known = pet.tricks.includes(t);
              const at = pet.stages.find((s) => s.trick === t);
              return (
                <Pressable key={t} onPress={() => (known ? doTrick(t) : setSaid(`I'll learn ${TRICK_INFO[t].label.toLowerCase()} as a ${at?.name}.`))}
                  accessibilityRole="button" accessibilityState={{ disabled: !known }}
                  style={({ pressed }) => [ui.chip, { opacity: known ? (pressed ? 0.7 : 1) : 0.45, backgroundColor: known ? C.accentSoft : C.raised, borderColor: known ? C.accent : C.line }]}>
                  {!known ? <Icon name="lock-outline" size={14} color={C.faint} /> : null}
                  <Text style={[ui.chipText, known && { color: C.accent, fontWeight: '700' }]}>{TRICK_INFO[t].label}</Text>
                </Pressable>
              );
            })}
          </View>
          {!pet.tricks.length ? <Text style={{ color: C.sub, fontSize: 13 }}>{name} learns the first trick in {Math.max(0, pet.stages[1].at - pet.growth)} more days of moving.</Text> : null}

          <SectionTitle>Games</SectionTitle>
          <View style={{ gap: S.sm }}>
            {GAMES.map((g) => (
              <Pressable key={g.id} onPress={() => { tap(); setGame(g.id); }} accessibilityRole="button"
                style={({ pressed }) => [ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, opacity: pressed ? 0.85 : 1 }]}>
                <IconBadge name={g.icon} color={g.color} />
                <View style={{ flex: 1 }}>
                  <Text style={ui.rowTitle}>{g.title}</Text>
                  <Text style={ui.rowSub}>{g.blurb}{pet.best[g.id] ? ` · best ${pet.best[g.id]}` : ''}</Text>
                </View>
                <Icon name="play-circle" size={30} color={C.accent} />
              </Pressable>
            ))}
          </View>

          <SectionTitle right={<Text style={{ color: C.sub, fontWeight: '700' }}>{pet.treats} treats</Text>}>Wardrobe</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
            {pet.wardrobe.map((w) => {
              const owned = pet.owned.includes(w.id);
              const on = pet.wearing === w.id;
              return (
                <Pressable key={w.id} onPress={() => (owned ? wear(on ? null : w.id) : buy(w.id, w.cost, w.name))} accessibilityRole="button"
                  style={({ pressed }) => [ui.card, { width: '31.6%', alignItems: 'center', gap: 4, padding: S.md, opacity: pressed ? 0.8 : 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? C.accentSoft : C.card }]}>
                  <Icon name={WEAR_ICON[w.id] ?? 'tshirt-crew'} size={30} color={owned ? C.ink : C.faint} />
                  <Text style={{ color: C.ink, fontSize: 12, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>{w.name}</Text>
                  <Text style={{ color: on ? C.accent : owned ? C.sub : C.gold, fontSize: 11, fontWeight: '700' }}>{on ? 'Wearing' : owned ? 'Wear' : `${w.cost} treats`}</Text>
                </Pressable>
              );
            })}
          </View>

          <SectionTitle>Growing up</SectionTitle>
          <Card style={{ gap: S.sm }}>
            {next ? (
              <>
                <Text style={ui.rowTitle}>{daysLeft} more {daysLeft === 1 ? 'day' : 'days'} of moving to {next.name}</Text>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: C.raised, overflow: 'hidden' }}>
                  <View style={{ height: 8, width: `${Math.min(100, ((pet.growth - pet.stages[pet.stage].at) / Math.max(1, next.at - pet.stages[pet.stage].at)) * 100)}%`, backgroundColor: C.gold }} />
                </View>
                <Text style={{ color: C.sub, fontSize: 12 }}>Each day either of you moves 10+ minutes counts. Both of you on the same day counts twice.</Text>
              </>
            ) : <Text style={ui.rowTitle}>{name} is a Legend. Fully grown.</Text>}
            {pet.stages.map((s, i) => {
              const here = i === pet.stage;
              return (
                <View key={s.name} style={[ui.row, { paddingVertical: S.sm }, i ? { borderTopWidth: 1, borderTopColor: C.line } : null]}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: here ? C.gold : s.reached ? tint(C.gold, 0.2) : C.raised }}>
                    {s.reached && !here ? <Icon name="check" size={16} color={C.gold} /> : <Text style={{ color: here ? '#1d1a10' : C.faint, fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[ui.rowTitle, !s.reached && { color: C.sub }]}>{s.name}</Text>
                    <Text style={ui.rowSub}>{s.look}{s.trick ? ` · learns ${TRICK_INFO[s.trick as Trick].label.toLowerCase()}` : ''}</Text>
                  </View>
                  <Text style={{ color: s.reached ? C.gold : C.faint, fontSize: 12, fontWeight: '700' }}>{s.at ? `day ${s.at}` : 'start'}</Text>
                </View>
              );
            })}
          </Card>
        </View>
      </ScrollView>

      <FetchGame visible={game === 'fetch'} pet={pet} onClose={() => setGame(null)} onScore={finishGame('fetch')} />
      <CatchGame visible={game === 'catch'} pet={pet} onClose={() => setGame(null)} onScore={finishGame('catch')} />
      <FindGame visible={game === 'find'} pet={pet} onClose={() => setGame(null)} onScore={finishGame('find')} />
    </View>
  );
}

function Meter({ label, value, color, icon }: { label: string; value: number; color: string; icon: IconName }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={14} color={color} />
        <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: C.raised, overflow: 'hidden' }}>
        <View style={{ height: 8, width: `${Math.max(3, Math.min(100, value))}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}
