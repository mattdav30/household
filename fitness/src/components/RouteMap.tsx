// A map of a walk or run: map tiles under the route line, fitted to the route.
// Tiles come from CARTO's free basemaps (OpenStreetMap data), so no map account or key is needed.
import { Image, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { C, MODE, S, tint } from '../lib/theme';
import { fmtPace } from '../lib/gps';
import { styles as ui } from './ui';

type LL = { lat: number; lng: number };
const TILE = 256;
const worldX = (lng: number, z: number) => ((lng + 180) / 360) * TILE * 2 ** z;
const worldY = (lat: number, z: number) => {
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z;
};
const style = MODE === 'dark' ? 'dark_all' : 'rastertiles/voyager';

/** Draws the route. Each inner array is one stretch between pauses. `here` marks where you are now. */
export function RouteMap({ segments, width, height, here, radius = 16 }: { segments: LL[][]; width: number; height: number; here?: LL | null; radius?: number }) {
  const all = segments.flat().concat(here ? [here] : []);
  if (!all.length) {
    return (
      <View style={{ width, height, borderRadius: radius, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.sub }}>Waiting for GPS…</Text>
      </View>
    );
  }
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  const box = { n: Math.max(...lats), s: Math.min(...lats), e: Math.max(...lngs), w: Math.min(...lngs) };
  // The closest zoom where the whole route fits with some room around it.
  const pad = 36;
  let z = 17;
  while (z > 3 && (worldX(box.e, z) - worldX(box.w, z) > width - pad * 2 || worldY(box.s, z) - worldY(box.n, z) > height - pad * 2)) z--;
  const cx = (worldX(box.e, z) + worldX(box.w, z)) / 2;
  const cy = (worldY(box.s, z) + worldY(box.n, z)) / 2;
  const ox = cx - width / 2;
  const oy = cy - height / 2;
  const n = 2 ** z;
  const tiles: { x: number; y: number; left: number; top: number }[] = [];
  for (let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + width) / TILE); tx++) {
    for (let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + height) / TILE); ty++) {
      if (ty < 0 || ty >= n) continue;
      tiles.push({ x: ((tx % n) + n) % n, y: ty, left: tx * TILE - ox, top: ty * TILE - oy });
    }
  }
  const px = (p: LL) => `${(worldX(p.lng, z) - ox).toFixed(1)},${(worldY(p.lat, z) - oy).toFixed(1)}`;
  const first = segments.find((s) => s.length)?.[0];
  const lastSeg = [...segments].reverse().find((s) => s.length);
  const last = lastSeg?.[lastSeg.length - 1];
  const at = (p: LL) => ({ cx: worldX(p.lng, z) - ox, cy: worldY(p.lat, z) - oy });

  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: MODE === 'dark' ? '#1b1d24' : '#e8e6df' }}>
      {tiles.map((t) => (
        <Image key={`${z}/${t.x}/${t.y}/${t.left}`} source={{ uri: `https://basemaps.cartocdn.com/${style}/${z}/${t.x}/${t.y}@2x.png` }}
          style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE }} fadeDuration={0} />
      ))}
      <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
        {segments.filter((s) => s.length > 1).map((s, i) => (
          <Polyline key={`c${i}`} points={s.map(px).join(' ')} fill="none" stroke="#ffffff" strokeOpacity={0.85} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {segments.filter((s) => s.length > 1).map((s, i) => (
          <Polyline key={`r${i}`} points={s.map(px).join(' ')} fill="none" stroke={C.accent} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {first ? <Circle {...at(first)} r={6} fill="#3DBE7A" stroke="#fff" strokeWidth={2} /> : null}
        {last && !here ? <Circle {...at(last)} r={6} fill="#E2557B" stroke="#fff" strokeWidth={2} /> : null}
        {here ? <Circle {...at(here)} r={12} fill={C.accent} fillOpacity={0.25} /> : null}
        {here ? <Circle {...at(here)} r={6} fill={C.accent} stroke="#fff" strokeWidth={2} /> : null}
      </Svg>
      <Text style={{ position: 'absolute', right: 6, bottom: 4, fontSize: 9, color: MODE === 'dark' ? '#9a9aa6' : '#555' }}>© OpenStreetMap © CARTO</Text>
    </View>
  );
}

/** A bar per kilometre, fastest in green. */
export function Splits({ splits }: { splits: number[] }) {
  if (!splits.length) return null;
  const fastest = Math.min(...splits);
  const slowest = Math.max(...splits);
  return (
    <View style={[ui.card, { gap: S.sm }]}>
      <Text style={ui.label}>Kilometre splits</Text>
      {splits.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          <Text style={[{ color: C.sub, width: 28, fontWeight: '700' }, ui.num]}>{i + 1}</Text>
          <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: C.raised, overflow: 'hidden' }}>
            <View style={{ height: 10, width: `${Math.max(12, 100 - ((s - fastest) / Math.max(1, slowest - fastest)) * 60)}%`, backgroundColor: s === fastest ? C.green : tint(C.accent, 0.7) }} />
          </View>
          <Text style={[{ color: C.ink, width: 52, textAlign: 'right', fontWeight: '700' }, ui.num]}>{fmtPace(s)}</Text>
        </View>
      ))}
    </View>
  );
}

