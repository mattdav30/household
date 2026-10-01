import type { Ingredient } from './api';

/** Recipes saved by the first version hold plain strings; newer ones hold { name, qty }. */
export function readIngredients(raw: string | null | undefined): Ingredient[] {
  let list: unknown = [];
  try { list = JSON.parse(raw || '[]'); } catch { list = []; }
  if (!Array.isArray(list)) return [];
  return list.map((x) => (typeof x === 'string' ? { name: x, qty: null } : { name: String(x.name ?? ''), qty: x.qty ?? null }))
    .filter((i) => i.name);
}

export const ingredientLine = (i: Ingredient) => (i.qty ? `${i.qty} ${i.name}` : i.name);

const UNIT = '(?:kg|g|gr|grams?|ml|l|litres?|cups?|tbsp|tbs|tablespoons?|tsp|teaspoons?|cloves?|cans?|tins?|bunch(?:es)?|handfuls?|pinch(?:es)?|slices?|packets?|large|medium|small)';
const LINE = new RegExp(`^([\\d./½¼¾⅓⅔\\s-]+(?:\\s*x\\s*[\\d.]+\\s*(?:g|kg|ml|l))?\\s*${UNIT}?\\.?)\\s+(?:of\\s+)?(.+)$`, 'i');

/** "500g beef mince" -> { qty: "500g", name: "Beef mince" }. */
export function parseLine(line: string) {
  const s = line.trim();
  const m = s.match(LINE);
  const name = (m ? m[2] : s).trim();
  return { name: name.charAt(0).toUpperCase() + name.slice(1), qty: m ? m[1].trim() : null };
}

/** Joins the same ingredient from several recipes into one line. */
export function mergeIngredients(lists: { items: Ingredient[]; from: string }[]) {
  const map = new Map<string, Ingredient & { from: string[] }>();
  for (const { items, from } of lists) {
    for (const i of items) {
      const key = i.name.toLowerCase().replace(/s$/, '');
      const cur = map.get(key);
      if (cur) {
        if (i.qty) cur.qty = cur.qty ? `${cur.qty} + ${i.qty}` : i.qty;
        if (!cur.from.includes(from)) cur.from.push(from);
      } else map.set(key, { ...i, from: [from] });
    }
  }
  return [...map.values()];
}
