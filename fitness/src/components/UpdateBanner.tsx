import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { applyUpdate, checkForUpdates, installRelease, type UpdateStatus } from '../lib/appUpdates';
import { C, S } from '../lib/theme';
import { Icon, tap } from './ui';

const EVERY = 15 * 60 * 1000;

/**
 * Checks for updates on launch and whenever the app comes back to the front, then shows a small
 * banner: Restart for an over the air update, Install for a new build. Dismissing hides it until
 * the next check.
 */
export function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);

  const run = useCallback(async (force = false) => {
    if (!force && Date.now() - last.current < EVERY) return;
    last.current = Date.now();
    const s = await checkForUpdates();
    setStatus(s);
    if (s.otaReady || s.release) setHidden(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => run(true), 4000);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') run(); });
    return () => { clearTimeout(t); sub.remove(); };
  }, [run]);

  if (hidden || !status || (!status.otaReady && !status.release)) return null;
  const release = status.release;
  const title = release ? `Tandem ${release.version} is ready` : 'Update ready';
  const sub = release ? (release.notes ?? 'Tap Install, then confirm on the next screen.') : 'Restart to load the latest changes.';

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: S.md, right: S.md, top: insets.top + S.sm, zIndex: 50 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.raised, borderRadius: 16, padding: S.md, borderWidth: 1, borderColor: C.accent, elevation: 8 }}
        accessibilityLiveRegion="polite">
        <Icon name={release ? 'download-circle-outline' : 'refresh-circle'} size={28} color={C.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.ink, fontWeight: '800' }}>{title}</Text>
          <Text style={{ color: C.sub, fontSize: 12 }} numberOfLines={2}>{sub}</Text>
        </View>
        <Pressable onPress={() => { tap(); if (release) installRelease(release); else applyUpdate(); }} accessibilityRole="button"
          style={({ pressed }) => ({ backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, opacity: pressed ? 0.75 : 1 })}>
          <Text style={{ color: C.onAccent, fontWeight: '800' }}>{release ? 'Install' : 'Restart'}</Text>
        </Pressable>
        <Pressable onPress={() => setHidden(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Later">
          <Icon name="close" size={20} color={C.faint} />
        </Pressable>
      </View>
    </View>
  );
}
