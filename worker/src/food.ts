// Recipe sources, ingredient parsing and matching against what we have.

export type Ingredient = { name: string; qty: string | null };
export type RecipeOut = {
  id: string; title: string; image_url: string | null; category: string | null; area: string | null;
  ingredients: Ingredient[]; instructions: string | null; servings: string | null;
  source: string; source_id: string | null; source_url: string | null;
};

// ---------- Parsing "500 g beef mince, diced" into name and quantity ----------

const FRACTIONS: Record<string, string> = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8' };
const UNITS = [
  'kilograms?', 'kg', 'grams?', 'g', 'gr', 'millilitres?', 'milliliters?', 'ml', 'litres?', 'liters?', 'l',
  'cups?', 'tablespoons?', 'tbsps?', 'tbs', 'tbsp', 'teaspoons?', 'tsps?', 'tsp', 'ounces?', 'oz', 'pounds?', 'lbs?',
  'cloves?', 'pinch(?:es)?', 'handfuls?', 'bunch(?:es)?', 'cans?', 'tins?', 'packets?', 'pkts?', 'slices?', 'sprigs?',
  'sticks?', 'heads?', 'pieces?', 'dash(?:es)?', 'jars?', 'bottles?', 'stalks?', 'leaves', 'fillets?', 'large', 'medium', 'small',
];
const QTY_RE = new RegExp(
  '^((?:about|approx\\.?|approximately)\\s+)?([\\d.,/\\s-]+(?:\\s*(?:to|-)\\s*[\\d./]+)?)\\s*(?:(' + UNITS.join('|') + ')\\b\\.?)?\\s*(?:of\\s+)?',
  'i',
);

export function parseIngredient(raw: string): Ingredient {
  let s = raw.replace(/[½⅓⅔¼¾⅛]/g, (m) => ' ' + FRACTIONS[m]).replace(/\s+/g, ' ').trim();
  let qty: string | null = null;
  const m = s.match(QTY_RE);
  if (m && /\d/.test(m[2] ?? '')) {
    qty = (m[2].trim() + (m[3] ? ' ' + m[3] : '')).trim();
    s = s.slice(m[0].length);
  }
  // "2 x 400g tins chickpeas" -> qty "2 x 400g tins", name "chickpeas"
  const multi = s.match(/^x\s*([\d.]+\s*(?:g|kg|ml|l)\b)\s*((?:cans?|tins?|jars?|packets?)\s+)?(?:of\s+)?/i);
  if (multi && qty) { qty = `${qty} x ${multi[1]}${multi[2] ? ' ' + multi[2].trim() : ''}`; s = s.slice(multi[0].length); }
  const container = s.match(/^((?:cans?|tins?|jars?|packets?|bags?|bottles?)\s+)(?:of\s+)?/i);
  if (container) { qty = ((qty ?? '') + ' ' + container[1].trim()).trim(); s = s.slice(container[0].length); }
  // Drop notes after a comma or in brackets: "onion, finely chopped" -> "onion"
  let name = s.replace(/\([^)]*\)/g, '').split(',')[0].trim();
  name = name.replace(/^(of|a|an)\s+/i, '').trim();
  if (!name) name = raw.trim();
  return { name: name.charAt(0).toUpperCase() + name.slice(1), qty };
}

/** Accepts the old string format and the new object format. */
export function normIngredients(raw: unknown): Ingredient[] {
  let list: unknown = raw;
  if (typeof raw === 'string') { try { list = JSON.parse(raw); } catch { list = []; } }
  if (!Array.isArray(list)) return [];
  return list.map((x) => {
    if (typeof x === 'string') return parseIngredient(x);
    const o = x as Partial<Ingredient>;
    return { name: String(o.name ?? '').trim(), qty: o.qty ? String(o.qty).trim() : null };
  }).filter((i) => i.name);
}

// ---------- Matching "Beef mince" against "mince" in the pantry ----------

const FILLER = new Set(['fresh', 'freshly', 'chopped', 'diced', 'sliced', 'minced', 'grated', 'large', 'small', 'medium', 'finely', 'roughly',
  'ripe', 'raw', 'whole', 'organic', 'free', 'range', 'extra', 'virgin', 'to', 'taste', 'for', 'serving', 'optional', 'of', 'and', 'or', 'a']);

function singular(w: string) {
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.endsWith('oes')) return w.slice(0, -2);
  if (/(ses|xes|ches|shes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function nameKey(s: string): string[] {
  return s.toLowerCase().replace(/\([^)]*\)/g, ' ').split(',')[0].replace(/[^a-z\s]/g, ' ')
    .split(/\s+/).filter((w) => w && !FILLER.has(w)).map(singular);
}

export function sameThing(a: string, b: string): boolean {
  const ka = nameKey(a), kb = nameKey(b);
  if (!ka.length || !kb.length) return false;
  const [small, big] = ka.length <= kb.length ? [ka, new Set(kb)] : [kb, new Set(ka)];
  return small.every((w) => big.has(w));
}

// ---------- TheMealDB, a free online recipe library ----------

const MEALDB = 'https://www.themealdb.com/api/json/v1/1';

export function fromMealDb(m: Record<string, string | null>): RecipeOut {
  const ingredients: Ingredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] ?? '').trim();
    if (!name) continue;
    const qty = (m[`strMeasure${i}`] ?? '').trim();
    ingredients.push({ name: name.charAt(0).toUpperCase() + name.slice(1), qty: qty || null });
  }
  return {
    id: 'mealdb:' + m.idMeal, title: m.strMeal ?? 'Recipe', image_url: m.strMealThumb ?? null,
    category: m.strCategory ?? null, area: m.strArea ?? null, ingredients,
    instructions: m.strInstructions ?? null, servings: null,
    source: 'mealdb', source_id: m.idMeal ?? null, source_url: m.strSource || m.strYoutube || null,
  };
}

export async function mealDb(path: string, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<any> {
  const url = MEALDB + path;
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(url);
  if (hit) return hit.json();
  const res = await fetch(url, { headers: { 'user-agent': 'HouseholdApp/1.0' } });
  if (!res.ok) throw new Error('Recipe library unavailable');
  const body = await res.text();
  ctx.waitUntil(cache.put(url, new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=86400' } })));
  return JSON.parse(body);
}

// ---------- Importing any recipe web page (schema.org Recipe data) ----------

function asText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return asText(v[0]);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return asText(o.url ?? o.text ?? o.name ?? o['@id']);
  }
  return null;
}

function decode(s: string) {
  return s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ').trim();
}

function instructionsText(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return decode(v);
  if (Array.isArray(v)) {
    const steps: string[] = [];
    for (const s of v) {
      if (typeof s === 'string') steps.push(decode(s));
      else if (s && typeof s === 'object') {
        const o = s as Record<string, unknown>;
        if (o['@type'] === 'HowToSection' && Array.isArray(o.itemListElement)) {
          const inner = instructionsText(o.itemListElement);
          if (inner) steps.push(inner);
        } else if (o.text) steps.push(decode(String(o.text)));
      }
    }
    return steps.map((s, i) => (s.includes('\n') ? s : `${i + 1}. ${s}`)).join('\n');
  }
  return null;
}

function findRecipe(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) { const r = findRecipe(n); if (r) return r; }
    return null;
  }
  const o = node as Record<string, unknown>;
  const type = o['@type'];
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return o;
  if (o['@graph']) return findRecipe(o['@graph']);
  if (o.mainEntity) return findRecipe(o.mainEntity);
  return null;
}

export async function importFromUrl(url: string): Promise<RecipeOut> {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`That site refused the request (${res.status}).`);
  const html = await res.text();
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const b of blocks) {
    let data: unknown;
    try { data = JSON.parse(b.trim()); } catch { continue; }
    const r = findRecipe(data);
    if (!r) continue;
    const ingredients = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : [])
      .map((x) => parseIngredient(decode(String(x))));
    return {
      id: 'url:' + url, title: decode(asText(r.name) ?? 'Recipe'), image_url: asText(r.image),
      category: asText(r.recipeCategory), area: asText(r.recipeCuisine), ingredients,
      instructions: instructionsText(r.recipeInstructions), servings: asText(r.recipeYield),
      source: 'url', source_id: null, source_url: url,
    };
  }
  throw new Error('No recipe found on that page. Try the link to a single recipe.');
}

// ---------- What we have versus what a recipe needs ----------

/** Things every kitchen has. Counted as at home without being listed. */
const BASICS = ['water', 'salt', 'pepper', 'black pepper', 'sea salt', 'ice', 'boiling water', 'cold water', 'salt and pepper'];
export const isBasic = (name: string) => BASICS.includes(nameKey(name).join(' ')) || BASICS.includes(name.trim().toLowerCase());

export type Coverage = { total: number; have: number; listed: number; need: number; missing: string[] };

export function coverage(items: Ingredient[], pantry: string[], listed: string[]): Coverage {
  const out: Coverage = { total: items.length, have: 0, listed: 0, need: 0, missing: [] };
  for (const i of items) {
    if (isBasic(i.name) || pantry.some((p) => sameThing(p, i.name))) out.have++;
    else if (listed.some((p) => sameThing(p, i.name))) out.listed++;
    else { out.need++; out.missing.push(i.name); }
  }
  return out;
}

/** Best first: fewest things to buy, then the largest share already at home. */
export const byReadiness = (a: Coverage, b: Coverage) =>
  a.need - b.need || b.have / Math.max(b.total, 1) - a.have / Math.max(a.total, 1);
