import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../lib/store';
import { api, type Summary } from '../../lib/api';
import { local } from '../../lib/local';
import { C, S, tint } from '../../lib/theme';
import { Appear } from '../../components/Appear';
import { Button, Card, Header, Icon, IconBadge, Loading, SectionTitle, styles as ui, tap, type IconName } from '../../components/ui';
import { Pet3D, TRICK_INFO, type PetAction, type Trick } from '../../components/pet3d/Pet3D';
import { BathGame, CatchGame, FetchGame, FindGame } from '../../components/games/Games';
import { careOf, needsLine } from '../../components/Pet';

const TRICK_ORDER: Trick[] = ['sit', 'paw', 'spin', 'roll', 'bow', 'beg', 'zoomies', 'dance'];
const WEAR_ICON: Record<string, IconName> = {
  party: 'party-popper', bow: 'ribbon', glasses: 'sunglasses', beanie: 'snowflake', flowers: 'flower', cap: 'hat-fedora', bowtie: 'tie', veil: 'ring',
};
type GameId = 'fetch' | 'catch' | 'find';
const GAMES: { id: GameId; title: string; blurb: string; icon: IconName; color: string }[] = [
  { id: 'fetch', title: 'Fetch', blurb: 'Time your throw for a mid air catch', icon: 'tennis-ball', color: '#9BC53D' },
  { id: 'catch', title: 'Treat catch', blurb: 'Slide the bowl, dodge bath time', icon: 'bone', color: '#F2C96B' },
  { id: 'find', title: 'Find the bone', blurb: 'Follow the cup through the shuffle', icon: 'cup', color: '#F59AB8' },
];
const FOOD = '#F2A65A';
const PLAY = '#F56F9A';
const ENERGY = '#8B93FF';
const CLEAN = '#5BC0EB';

export default function Dog() {
  const router = useRouter();
  const { summary, apply, partner } = useStore();
  const { width } = useWindowDimensions();
  const [action, setAction] = useState<PetAction | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [game, setGame] = useState<null | GameId | 'bath'>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedOpen, setFeedOpen] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const gamesY = useRef(0);

  useEffect(() => { if (!said) return; const t = setTimeout(() => setSaid(null), 4500); return () => clearTimeout(t); }, [said]);

  // A fuller bowl than last time means someone moved: the dog tucks in.
  const food = summary?.pet.needs?.food ?? null;
  useEffect(() => {
    if (food == null) return;
    const before = local.lastFood();
    if (before >= 0 && food >= before + 10) {
      setAction({ name: 'eat', id: Date.now() });
      setSaid('Thanks for moving! That filled my bowl.');
    }
    local.setLastFood(food);
  }, [food]);

  const post = useCallback(async (path: string, body: Record<string, unknown>) => {
    try { const s = await api<Summary>(path, { method: 'POST', body }); apply(s); local.setLastFood(s.pet.needs.food); return true; }
    catch (e) { setSaid((e as Error).message); return false; }
  }, [apply]);
  const play = useCallback((kind: string, score = 0) => post('/api/fit/pet/play', { kind, score }), [post]);
  const care = useCallback((what: 'nap' | 'wake' | 'bath' | 'scoop') => post('/api/fit/pet/care', { action: what }), [post]);

  if (!summary?.pet.needs) return <View style={{ flex: 1 }}><Header title="Your dog" /><Loading rows={4} /></View>;
  const pet = summary.pet;
  const n = pet.needs;
  const name = pet.name ?? 'Your dog';
  const next = pet.stages.find((s) => !s.reached);
  const daysLeft = next ? next.at - pet.growth : 0;

  const asleepCheck = () => {
    if (n.napping) { setSaid(`Shh, ${name} is napping. Tap Wake up first.`); return true; }
    return false;
  };
  const doTrick = (t: Trick) => {
    if (asleepCheck()) return;
    tap();
    setAction({ name: t, id: Date.now() });
    setSaid(['Good dog!', 'Who is a clever pup?', 'Nailed it!', `Yes ${name}!`][Math.floor(Math.random() * 4)]);
    play('trick');
  };
  const treat = async () => {
    if (busy) return;
    if (pet.treats < 1) { setSaid('No treats left. Every ten minutes of moving earns one.'); return; }
    tap();
    setBusy('treat');
    setAction({ name: 'treat', id: Date.now() });
    if (await play('treat')) setSaid('Nom nom nom. Thank you!');
    setBusy(null);
  };
  const openGame = (g: GameId) => {
    if (asleepCheck()) return;
    if (n.sick) { setSaid("I'm too poorly to play right now. Look after me first."); return; }
    if (n.energy < 10) { setSaid("I'm too tired to play. A nap would help."); return; }
    tap();
    setGame(g);
  };
  const napToggle = async () => {
    if (busy) return;
    tap();
    setBusy('nap');
    if (n.napping) { if (await care('wake')) { setAction({ name: 'wake', id: Date.now() }); setSaid('*yawn* I’m up!'); } }
    else if (await care('nap')) setSaid('Night night. Wake me any time.');
    setBusy(null);
  };
  const scoop = async () => {
    if (busy || !n.mess) return;
    tap();
    setBusy('scoop');
    if (await care('scoop')) { setAction({ name: 'spin', id: Date.now() }); setSaid('Sorry about that! Thank you.'); }
    setBusy(null);
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
  const finishGame = (kind: GameId) => (score: number) => { play(kind, score); };

  const line = said ?? needsLine(pet) ?? (pet.treats > 0 ? `I can smell ${pet.treats} ${pet.treats === 1 ? 'treat' : 'treats'}…` : 'Stroke my head, I love pats.');
  const minsToFull = Math.max(0, Math.ceil((100 - n.food) / 3.5));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 60 }}>
        <Header eyebrow={`${pet.stage_name} · ${pet.age_days} ${pet.age_days === 1 ? 'day' : 'days'} old`} title={name} />
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          <Appear index={0}>
            <View style={[ui.card, { alignItems: 'center', gap: S.sm, paddingHorizontal: 0 }]}>
              <View style={{ backgroundColor: n.sick ? tint(C.danger, 0.18) : C.raised, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '88%' }}>
                <Text style={{ color: C.ink, fontWeight: '600', textAlign: 'center' }} accessibilityLiveRegion="polite">{line}</Text>
              </View>
              <Pet3D color={pet.color} mood={pet.mood} stage={pet.stage} wearing={pet.wearing} size={width - S.lg * 2 - 2} height={290}
                action={action} care={careOf(pet)}
                onPat={() => { setSaid(n.napping ? 'Mmm… *snore*' : 'Aww, more pats please.'); play('pat'); }}
                onTap={() => setSaid(n.napping ? 'Zzz…' : ['Woof!', 'Hehe', 'Again!', 'Walkies?'][Math.floor(Math.random() * 4)])} />
              <Text style={{ color: C.faint, fontSize: 12 }}>Tap to say hi · stroke up and down to pat · drag to spin</Text>

              {/* Needs, Tamagotchi style. */}
              <View style={{ alignSelf: 'stretch', paddingHorizontal: S.lg, gap: S.sm, marginTop: S.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name={n.sick ? 'thermometer' : 'heart-pulse'} size={16} color={n.sick ? C.danger : n.wellbeing >= 60 ? C.green : n.wellbeing >= 35 ? C.gold : C.danger} />
                  <Text style={{ color: C.ink, fontWeight: '800' }}>{n.sick ? 'Feeling poorly' : `Wellbeing ${n.wellbeing}%`}</Text>
                  <View style={{ flex: 1 }} />
                  {n.mess ? <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700' }}>{n.mess} {n.mess === 1 ? 'mess' : 'messes'} in the yard</Text> : null}
                </View>
                <View style={{ flexDirection: 'row', gap: S.md }}>
                  <Meter label="Tummy" value={n.food} color={FOOD} icon="food-drumstick" />
                  <Meter label="Play" value={n.fun} color={PLAY} icon="heart" />
                </View>
                <View style={{ flexDirection: 'row', gap: S.md }}>
                  <Meter label="Energy" value={n.energy} color={ENERGY} icon="lightning-bolt" />
                  <Meter label="Clean" value={n.clean} color={CLEAN} icon="shimmer" />
                </View>
              </View>

              {/* Care buttons. */}
              <View style={{ flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between', paddingHorizontal: S.md, marginTop: S.sm }}>
                <CareButton icon="bowl" label="Feed" color={FOOD} alert={n.food < 35} on={feedOpen} onPress={() => { tap(); setFeedOpen((o) => !o); }} />
                <CareButton icon="tennis-ball" label="Play" color={PLAY} alert={n.fun < 25} onPress={() => { tap(); scroll.current?.scrollTo({ y: gamesY.current, animated: true }); }} />
                <CareButton icon="shower-head" label="Bath" color={CLEAN} alert={n.clean < 30 || n.sick === 'dirty'} onPress={() => { if (asleepCheck()) return; tap(); setGame('bath'); }} />
                <CareButton icon={n.napping ? 'weather-sunny' : 'sleep'} label={n.napping ? 'Wake up' : 'Nap'} color={ENERGY} alert={n.energy < 20 && !n.napping} busy={busy === 'nap'} onPress={napToggle} />
                <CareButton icon="broom" label="Tidy" color={C.gold} alert={n.mess >= 2} badge={n.mess} dim={!n.mess} busy={busy === 'scoop'} onPress={scoop} />
              </View>

              {feedOpen ? (
                <View style={{ alignSelf: 'stretch', marginHorizontal: S.lg, marginTop: S.sm, padding: S.md, borderRadius: 16, backgroundColor: tint(FOOD, 0.1), gap: S.sm }}>
                  <Text style={ui.rowTitle}>{n.food >= 95 ? `${name}'s bowl is full` : `${minsToFull} minutes of moving fills the bowl`}</Text>
                  <Text style={ui.rowSub}>Every minute either of you moves today goes into the bowl. Walks, workouts and anything Samsung Health records all count.</Text>
                  <View style={{ flexDirection: 'row', gap: S.sm }}>
                    <View style={{ flex: 1 }}><Button title="Start a walk" icon="walk" onPress={() => { tap(); router.push({ pathname: '/session', params: { type: 'walk' } }); }} /></View>
                    <View style={{ flex: 1 }}><Button title={`Treat (${pet.treats})`} icon="bone" kind="soft" busy={busy === 'treat'} onPress={treat} /></View>
                  </View>
                </View>
              ) : null}
            </View>
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

          <View onLayout={(e) => { gamesY.current = e.nativeEvent.layout.y; }}>
            <SectionTitle right={<Text style={{ color: C.sub, fontWeight: '700' }}>Each game uses a little energy</Text>}>Games</SectionTitle>
          </View>
          <View style={{ gap: S.sm }}>
            {GAMES.map((g) => (
              <Pressable key={g.id} onPress={() => openGame(g.id)} accessibilityRole="button"
                style={({ pressed }) => [ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, opacity: pressed ? 0.85 : n.energy < 10 || n.napping ? 0.55 : 1 }]}>
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

          <SectionTitle>How looking after {name} works</SectionTitle>
          <Card style={{ gap: S.sm }}>
            <Tip icon="food-drumstick" color={FOOD} text="Tummy empties over about a day and a half. Moving is the only way to fill the bowl: ten minutes fills about a third." />
            <Tip icon="heart" color={PLAY} text="Play fades over two days. Pats, tricks, treats and games lift it." />
            <Tip icon="lightning-bolt" color={ENERGY} text="Energy drops through the day and with each game. It refills overnight, or with a thirty minute nap." />
            <Tip icon="shimmer" color={CLEAN} text="Clean drops slowly, and walks bring back muddy paws. A bath fixes it." />
            <Tip icon="broom" color={C.gold} text="A little mess turns up every few hours. Tidy it to keep wellbeing up." />
            <Tip icon="thermometer" color={C.danger} text={`If the bowl or the coat stays at zero for half a day, ${name} feels poorly until you fill the bowl or give a bath.`} />
          </Card>
        </View>
      </ScrollView>

      <FetchGame visible={game === 'fetch'} pet={pet} onClose={() => setGame(null)} onScore={finishGame('fetch')} />
      <CatchGame visible={game === 'catch'} pet={pet} onClose={() => setGame(null)} onScore={finishGame('catch')} />
      <FindGame visible={game === 'find'} pet={pet} onClose={() => setGame(null)} onScore={finishGame('find')} />
      <BathGame visible={game === 'bath'} pet={pet} care={careOf(pet)} onClose={() => setGame(null)}
        onScore={async () => { if (await care('bath')) setSaid('So fresh and so clean!'); }} />
    </View>
  );
}

function Meter({ label, value, color, icon }: { label: string; value: number; color: string; icon: IconName }) {
  const low = value < 25;
  return (
    <View style={{ flex: 1, gap: 4 }} accessible accessibilityLabel={`${label} ${Math.round(value)} percent`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={14} color={color} />
        <Text style={{ color: low ? C.danger : C.sub, fontSize: 12, fontWeight: '700', flex: 1 }}>{label}</Text>
        <Text style={{ color: C.faint, fontSize: 11, fontWeight: '700' }}>{Math.round(value)}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: C.raised, overflow: 'hidden' }}>
        <View style={{ height: 8, width: `${Math.max(3, Math.min(100, value))}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

function CareButton({ icon, label, color, onPress, alert, badge, dim, on, busy }: {
  icon: IconName; label: string; color: string; onPress: () => void; alert?: boolean; badge?: number; dim?: boolean; on?: boolean; busy?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}
      style={({ pressed }) => ({ alignItems: 'center', gap: 4, width: 60, opacity: pressed || busy ? 0.6 : dim ? 0.45 : 1 })}>
      <View style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color : tint(color, 0.18), borderWidth: alert ? 2 : 0, borderColor: color }}>
        <Icon name={icon} size={24} color={on ? '#1d1a10' : color} />
        {badge ? (
          <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ color: alert ? C.ink : C.sub, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function Tip({ icon, color, text }: { icon: IconName; color: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'flex-start' }}>
      <Icon name={icon} size={16} color={color} />
      <Text style={{ color: C.sub, fontSize: 13, flex: 1, lineHeight: 19 }}>{text}</Text>
    </View>
  );
}
