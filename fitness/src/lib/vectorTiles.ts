// Map data for the route map: OpenFreeMap vector tiles (OpenStreetMap data in the OpenMapTiles layout),
// fetched through our worker and turned into SVG paths, so the map can be drawn in the app's own colours.
import { PbfReader } from 'pbf';
import { VectorTile, type VectorTileFeature } from '@mapbox/vector-tile';
import { API_URL } from './api';

/** Paths for one tile in 0..256 coordinates, one string per kind of thing to draw. */
export type TilePaths = {
  water: string; green: string; building: string; waterLine: string;
  major: string; mid: string; minor: string; path: string;
};
export const EMPTY: TilePaths = { water: '', green: '', building: '', waterLine: '', major: '', mid: '', minor: '', path: '' };

/** Highest zoom the data comes in. Closer views stretch these tiles. */
export const DATA_MAX_ZOOM = 14;

const cache = new Map<string, TilePaths>();
const failedAt = new Map<string, number>();
const pending = new Map<string, Promise<TilePaths | 'failed'>>();

const GREEN_COVER = new Set(['grass', 'wood', 'forest', 'wetland', 'park', 'scrub', 'farmland', 'meadow']);
const ROAD: Record<string, keyof TilePaths> = {
  motorway: 'major', trunk: 'major', primary: 'major',
  secondary: 'mid', tertiary: 'mid',
  minor: 'minor', service: 'minor', raceway: 'minor', busway: 'minor',
  path: 'path', track: 'path', pedestrian: 'path', bridleway: 'path', cycleway: 'path', footway: 'path',
};

function toPath(f: VectorTileFeature, close: boolean) {
  const k = 256 / f.extent;
  let d = '';
  for (const ring of f.loadGeometry()) {
    ring.forEach((p, i) => { d += `${i ? 'L' : 'M'}${(p.x * k).toFixed(1)} ${(p.y * k).toFixed(1)}`; });
    if (close) d += 'Z';
  }
  return d;
}

function decode(buf: ArrayBuffer): TilePaths {
  const out: TilePaths = { ...EMPTY };
  const tile = new VectorTile(new PbfReader(new Uint8Array(buf)));
  const each = (layer: string, fn: (f: VectorTileFeature) => void) => {
    const l = tile.layers[layer];
    if (!l) return;
    for (let i = 0; i < l.length; i++) fn(l.feature(i));
  };
  each('water', (f) => { if (f.type === 3) out.water += toPath(f, true); });
  each('waterway', (f) => { if (f.type === 2) out.waterLine += toPath(f, false); });
  each('park', (f) => { if (f.type === 3) out.green += toPath(f, true); });
  each('landcover', (f) => { if (f.type === 3 && GREEN_COVER.has(String(f.properties.class))) out.green += toPath(f, true); });
  each('landuse', (f) => { if (f.type === 3 && ['pitch', 'playground', 'cemetery', 'park', 'garden'].includes(String(f.properties.class))) out.green += toPath(f, true); });
  each('building', (f) => { if (f.type === 3) out.building += toPath(f, true); });
  each('transportation', (f) => {
    if (f.type !== 2) return;
    const cls = String(f.properties.class ?? '');
    const kind = ROAD[cls];
    if (kind) out[kind] += toPath(f, false);
  });
  return out;
}

/** Already loaded paths for a tile, or undefined while it loads. 'failed' means draw the picture tile instead. */
export const tileNow = (z: number, x: number, y: number): TilePaths | 'failed' | undefined => {
  const key = `${z}/${x}/${y}`;
  return cache.get(key) ?? (failedAt.has(key) ? 'failed' : undefined);
};

export function loadTile(z: number, x: number, y: number): Promise<TilePaths | 'failed'> {
  const key = `${z}/${x}/${y}`;
  const have = cache.get(key);
  if (have) return Promise.resolve(have);
  // After a failure, wait a minute before asking again.
  if (Date.now() - (failedAt.get(key) ?? 0) < 60000) return Promise.resolve('failed');
  const p = pending.get(key);
  if (p) return p;
  const job = (async () => {
    try {
      const res = await fetch(`${API_URL}/vtiles/${key}.pbf`);
      if (res.status === 204) return EMPTY; // open sea or nothing mapped here
      if (!res.ok) throw new Error(String(res.status));
      return decode(await res.arrayBuffer());
    } catch {
      return 'failed' as const;
    }
  })().then((r) => {
    pending.delete(key);
    if (r === 'failed') { failedAt.set(key, Date.now()); return r; }
    failedAt.delete(key);
    cache.set(key, r);
    // Keep the memory use small: forget the oldest tiles past a few hundred.
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    return r;
  });
  pending.set(key, job);
  return job;
}
