import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { lastPhoto, savePhoto, type Pose } from '../lib/photos';
import { today } from '../lib/dates';
import { C, S } from '../lib/theme';
import { Button, Icon, styles as ui, tap } from '../components/ui';

/** Progress photo camera with a faint outline of the last photo, so each month lines up. */
export default function Camera() {
  const { pose = 'front' } = useLocalSearchParams<{ pose?: Pose }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [timer, setTimer] = useState(10);
  const [count, setCount] = useState<number | null>(null);
  const [ghost, setGhost] = useState(true);
  const [busy, setBusy] = useState(false);
  const cam = useRef<CameraView>(null);
  const prev = useRef(lastPhoto(pose as Pose)).current;

  useEffect(() => { if (perm && !perm.granted && perm.canAskAgain) requestPerm(); }, [perm, requestPerm]);

  useEffect(() => {
    if (count == null) return;
    if (count === 0) { setCount(null); shoot(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const t = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  async function shoot() {
    if (!cam.current || busy) return;
    setBusy(true);
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.8 });
      if (pic?.uri) {
        await savePhoto(pic.uri, today(), pose as Pose);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        router.back();
      }
    } finally { setBusy(false); }
  }

  if (!perm?.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: S.xl, paddingTop: insets.top + 80, gap: S.lg }}>
        <Text style={ui.h1}>Camera access</Text>
        <Text style={ui.headerSub}>Progress photos need the camera. They save inside this app on this phone only.</Text>
        <Button title="Allow camera" onPress={requestPerm} />
        <Button title="Not now" kind="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cam} style={{ flex: 1 }} facing={facing} mirror={false} />
      {ghost && prev ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Image source={{ uri: prev.uri }} style={{ width: '100%', height: '100%', opacity: 0.3 }} resizeMode="cover" />
        </View>
      ) : !prev ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: '12%', bottom: '10%', left: '28%', right: '28%', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 120, borderStyle: 'dashed' }} />
      ) : null}
      {count != null ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 120, fontWeight: '800' }}>{count}</Text>
        </View>
      ) : null}

      <View style={{ position: 'absolute', top: insets.top + S.md, left: S.lg, right: S.lg, flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" style={pill}><Icon name="close" color="#fff" /></Pressable>
        <View style={{ flex: 1 }} />
        {prev ? (
          <Pressable onPress={() => { tap(); setGhost(!ghost); }} accessibilityRole="switch" accessibilityState={{ checked: ghost }} style={pill}>
            <Icon name="image-filter-center-focus-weak" color={ghost ? C.accent : '#fff'} />
            <Text style={pillText}>Outline</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => { tap(); setTimer(timer === 0 ? 5 : timer === 5 ? 10 : 0); }} accessibilityLabel={`Timer ${timer} seconds`} style={pill}>
          <Icon name="timer-outline" color="#fff" />
          <Text style={pillText}>{timer ? `${timer}s` : 'Off'}</Text>
        </Pressable>
      </View>

      <View style={{ position: 'absolute', bottom: insets.bottom + 30, left: 0, right: 0, alignItems: 'center', gap: S.md }}>
        <Text style={{ color: '#fff', fontWeight: '700', textShadowColor: '#000', textShadowRadius: 6 }}>
          {pose[0].toUpperCase() + pose.slice(1)} pose. {prev ? 'Line up with the outline.' : 'Same spot and light each month.'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 40 }}>
          <View style={{ width: 52 }} />
          <Pressable disabled={busy || count != null} onPress={() => { tap(); if (timer) setCount(timer); else shoot(); }} accessibilityLabel="Take photo"
            style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: busy ? C.faint : '#fff' }} />
          </Pressable>
          <Pressable onPress={() => { tap(); setFacing(facing === 'back' ? 'front' : 'back'); }} accessibilityLabel="Switch camera" style={[pill, { width: 52, height: 52, justifyContent: 'center' }]}>
            <Icon name="camera-flip-outline" color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const pill = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)' };
const pillText = { color: '#fff', fontWeight: '700' as const };
