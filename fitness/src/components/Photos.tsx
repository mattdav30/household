import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { deletePhoto, listPhotos, POSES, savePhoto, type Photo, type Pose } from '../lib/photos';
import { C, S, tint } from '../lib/theme';
import { friendly, today } from '../lib/dates';
import { Appear } from './Appear';
import { Button, Chips, DateField, Icon, IconBadge, SectionTitle, Sheet, styles as ui, tap } from './ui';

const daysApart = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
function apartLabel(a: string, b: string) {
  const d = daysApart(a, b);
  if (d < 14) return `${d} ${d === 1 ? 'day' : 'days'} apart`;
  if (d < 70) return `${Math.round(d / 7)} weeks apart`;
  return `${Math.round(d / 30)} months apart`;
}

/** Drag the handle across to wipe between the before and after photos. */
function BeforeAfter({ before, after }: { before: Photo; after: Photo }) {
  const [w, setW] = useState(0);
  const [pos, setPos] = useState(0.5);
  const width = useRef(0);
  const start = useRef(0.5);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: () => { start.current = posRef.current; },
    onPanResponderMove: (_e, g) => { if (width.current) setPos(Math.min(0.98, Math.max(0.02, start.current + g.dx / width.current))); },
    onPanResponderTerminationRequest: () => false,
  })).current;
  const posRef = useRef(pos);
  posRef.current = pos;
  const h = w * (4 / 3);

  return (
    <View onLayout={(e) => { setW(e.nativeEvent.layout.width); width.current = e.nativeEvent.layout.width; }}
      style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: C.raised, height: h || 300 }} {...pan.panHandlers}
      accessibilityLabel={`Before and after. ${friendly(before.date)} and ${friendly(after.date)}. Drag to compare.`}>
      {w ? (
        <>
          <Image source={{ uri: after.uri }} style={{ position: 'absolute', width: w, height: h }} resizeMode="cover" />
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: w * pos, overflow: 'hidden' }}>
            <Image source={{ uri: before.uri }} style={{ width: w, height: h }} resizeMode="cover" />
          </View>
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: w * pos - 1.5, width: 3, backgroundColor: '#FFFFFF' }} />
          <View style={{ position: 'absolute', top: h / 2 - 22, left: w * pos - 22, width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
            <Icon name="arrow-left-right" size={22} color="#17162B" />
          </View>
          <View style={{ position: 'absolute', left: 12, top: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>BEFORE · {friendly(before.date)}</Text>
          </View>
          <View style={{ position: 'absolute', right: 12, top: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>NOW · {friendly(after.date)}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Progress photos: before and after slider, a timeline per pose, and adding from the camera or gallery. */
export function Photos() {
  const router = useRouter();
  const [pose, setPose] = useState<Pose>('front');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [view, setView] = useState<Photo | null>(null);
  const [pick, setPick] = useState<{ before?: string; after?: string }>({});
  const [importing, setImporting] = useState<{ uri: string; date: string | null }[] | null>(null);
  const [importPose, setImportPose] = useState<Pose>('front');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { try { setPhotos(listPhotos()); } catch { setPhotos([]); } }, []);
  useFocusEffect(load);

  const forPose = useMemo(() => photos.filter((p) => p.pose === pose), [photos, pose]);
  const before = forPose.find((p) => p.name === pick.before) ?? forPose[0];
  const after = forPose.find((p) => p.name === pick.after) ?? forPose[forPose.length - 1];
  const counts = useMemo(() => Object.fromEntries(POSES.map((p) => [p.value, photos.filter((x) => x.pose === p.value).length])), [photos]);

  const fromGallery = async () => {
    tap();
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.85, exif: true });
    if (res.canceled || !res.assets.length) return;
    setImportPose(pose);
    setImporting(res.assets.map((a) => {
      // Photos keep the day they were taken, when the phone recorded it.
      const raw = (a.exif?.DateTimeOriginal ?? a.exif?.DateTime) as string | undefined;
      const m = raw?.match(/^(\d{4}):(\d{2}):(\d{2})/);
      return { uri: a.uri, date: m ? `${m[1]}-${m[2]}-${m[3]}` : null };
    }));
  };

  const saveImports = async () => {
    if (!importing) return;
    setBusy(true);
    try {
      for (const it of importing) await savePhoto(it.uri, it.date ?? today(), importPose);
      setPose(importPose);
      setPick({});
      setImporting(null);
      load();
    } catch (e) { Alert.alert('Those photos did not save', (e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <Appear index={0}>
        <View style={{ flexDirection: 'row', gap: S.sm }}>
          <View style={{ flex: 1 }}><Button title="Take photo" icon="camera-outline" onPress={() => { tap(); router.push({ pathname: '/camera', params: { pose } }); }} /></View>
          <View style={{ flex: 1 }}><Button title="From gallery" icon="image-multiple-outline" kind="soft" onPress={fromGallery} /></View>
        </View>
      </Appear>

      <Chips value={pose} onChange={(p) => { setPose(p); setPick({}); }} options={POSES.map((p) => ({ value: p.value, label: `${p.label}${counts[p.value] ? ` · ${counts[p.value]}` : ''}` }))} />

      {before && after && before !== after ? (
        <Appear index={1}>
          <BeforeAfter before={before} after={after} />
          <Text style={{ color: C.sub, fontSize: 13, textAlign: 'center', marginTop: S.sm }}>{apartLabel(before.date, after.date)}. Drag the handle to compare.</Text>
        </Appear>
      ) : forPose.length === 1 ? (
        <Appear index={1}>
          <View style={{ borderRadius: 20, overflow: 'hidden' }}>
            <Image source={{ uri: forPose[0].uri }} style={{ width: '100%', aspectRatio: 3 / 4 }} resizeMode="cover" />
            <View style={{ position: 'absolute', left: 12, top: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>BEFORE · {friendly(forPose[0].date)}</Text>
            </View>
          </View>
          <Text style={{ color: C.sub, fontSize: 13, textAlign: 'center', marginTop: S.sm }}>Your before is saved. Take the next one in a month and the comparison appears here.</Text>
        </Appear>
      ) : (
        <Appear index={1}>
          <View style={[ui.card, { alignItems: 'center', gap: S.sm, paddingVertical: S.xl, backgroundColor: tint(C.accent, 0.06), borderColor: tint(C.accent, 0.35) }]}>
            <IconBadge name="image-filter-hdr" color={C.accent} size={56} />
            <Text style={ui.h2}>Your before photo</Text>
            <Text style={{ color: C.sub, textAlign: 'center', lineHeight: 20 }}>Take one today, or add one from your gallery. Same spot and light each month makes the change easy to see.</Text>
          </View>
        </Appear>
      )}

      {forPose.length ? (
        <>
          <SectionTitle right={<Text style={{ color: C.sub, fontWeight: '700' }}>{forPose.length}</Text>}>Timeline</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm, paddingRight: S.lg }}>
            {forPose.map((p) => {
              const isBefore = p === before && forPose.length > 1;
              const isAfter = p === after && forPose.length > 1;
              return (
                <Pressable key={p.name} onPress={() => { tap(); setView(p); }} accessibilityLabel={`Photo from ${friendly(p.date)}`}>
                  <Image source={{ uri: p.uri }} style={{ width: 96, height: 128, borderRadius: 14, borderWidth: 2, borderColor: isBefore ? C.warm : isAfter ? C.accent : 'transparent' }} />
                  <Text style={{ color: isBefore ? C.warm : isAfter ? C.accent : C.sub, fontSize: 11, marginTop: 4, fontWeight: isBefore || isAfter ? '800' : '500' }}>
                    {isBefore ? 'Before' : isAfter ? 'Now' : friendly(p.date)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center', marginTop: S.sm }}>
        <Icon name="lock-outline" size={16} color={C.faint} />
        <Text style={{ color: C.faint, fontSize: 12, flex: 1 }}>Photos stay on this phone only and never upload.</Text>
      </View>

      <Modal visible={!!view} transparent animationType="fade" onRequestClose={() => setView(null)}>
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
          {view ? <Image source={{ uri: view.uri }} style={{ width: '100%', aspectRatio: 3 / 4 }} resizeMode="contain" /> : null}
          {view ? <Text style={{ color: '#fff', textAlign: 'center', marginTop: S.md, fontWeight: '700' }}>{friendly(view.date)}</Text> : null}
          <View style={{ position: 'absolute', bottom: 40, left: S.lg, right: S.lg, gap: S.sm }}>
            {forPose.length > 1 ? (
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <View style={{ flex: 1 }}><Button title="Set as before" kind="soft" onPress={() => { setPick((x) => ({ ...x, before: view!.name })); setView(null); }} /></View>
                <View style={{ flex: 1 }}><Button title="Set as now" kind="soft" onPress={() => { setPick((x) => ({ ...x, after: view!.name })); setView(null); }} /></View>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              <View style={{ flex: 1 }}><Button title="Close" kind="ghost" onPress={() => setView(null)} /></View>
              <View style={{ flex: 1 }}>
                <Button title="Delete" kind="danger" onPress={() => Alert.alert('Delete this photo?', 'It is only stored on this phone, so this cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { deletePhoto(view!); setView(null); setPick({}); load(); } },
                ])} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Sheet visible={!!importing} title={importing && importing.length > 1 ? `Add ${importing.length} photos` : 'Add photo'} onClose={() => setImporting(null)}
        onSave={saveImports} saving={busy} saveLabel="Add to progress">
        <ScrollView horizontal contentContainerStyle={{ gap: S.sm }}>
          {(importing ?? []).map((it, i) => (
            <View key={i} style={{ gap: 6, width: 110 }}>
              <Image source={{ uri: it.uri }} style={{ width: 110, height: 146, borderRadius: 12 }} />
              <DateField label="Taken" value={it.date ?? today()} onChange={(d) => setImporting((xs) => xs!.map((x, j) => (j === i ? { ...x, date: d } : x)))} />
            </View>
          ))}
        </ScrollView>
        <Chips label="Pose" value={importPose} onChange={setImportPose} options={POSES} />
        <Text style={{ color: C.sub, fontSize: 13 }}>Copies go into Tandem's private folder. The originals stay in your gallery.</Text>
      </Sheet>
    </>
  );
}
