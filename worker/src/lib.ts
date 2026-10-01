// Shared helpers: ids, hashing, dates, aisle guessing, push.

export const now = () => Date.now();

export function uid(prefix = ''): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return prefix + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function inviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return [...b].map((x) => alphabet[x % alphabet.length]).join('');
}

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');

export async function hashPassword(password: string, salt?: string) {
  salt = salt ?? uid();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 },
    key,
    256,
  );
  return { hash: toHex(bits), salt };
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Queensland has no daylight saving, so UTC+10 all year.
export function localDate(offsetMin: number, d = new Date()): string {
  return new Date(d.getTime() + offsetMin * 60000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function advance(date: string, repeat: string): string | null {
  const d = new Date(date + 'T00:00:00Z');
  switch (repeat) {
    case 'daily': return addDays(date, 1);
    case 'weekly': return addDays(date, 7);
    case 'fortnightly': return addDays(date, 14);
    case 'monthly': {
      const day = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + 1);
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(day, last));
      return d.toISOString().slice(0, 10);
    }
    case 'quarterly': {
      let out = date;
      for (let i = 0; i < 3; i++) out = advance(out, 'monthly')!;
      return out;
    }
    case 'yearly': {
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      return d.toISOString().slice(0, 10);
    }
    default: return null;
  }
}

const AISLES: [string, string[]][] = [
  ['Produce', ['apple', 'banana', 'lettuce', 'tomato', 'onion', 'garlic', 'potato', 'carrot', 'avocado', 'lemon', 'lime', 'spinach', 'capsicum', 'broccoli', 'cucumber', 'mushroom', 'herb', 'basil', 'coriander', 'parsley', 'ginger', 'zucchini', 'berries', 'strawberr', 'blueberr', 'grape', 'orange', 'mango', 'pear', 'celery', 'kale', 'corn', 'pumpkin', 'salad', 'chilli', 'fruit', 'veg']],
  ['Meat & Seafood', ['chicken', 'beef', 'mince', 'steak', 'pork', 'lamb', 'bacon', 'ham', 'sausage', 'salmon', 'fish', 'prawn', 'tuna', 'turkey', 'chorizo']],
  ['Dairy & Eggs', ['milk', 'cheese', 'butter', 'yoghurt', 'yogurt', 'cream', 'egg', 'feta', 'parmesan', 'mozzarella', 'halloumi']],
  ['Bakery', ['bread', 'loaf', 'roll', 'wrap', 'bagel', 'croissant', 'muffin', 'tortilla', 'bun']],
  ['Frozen', ['frozen', 'ice cream', 'peas', 'ice']],
  ['Pantry', ['rice', 'pasta', 'flour', 'sugar', 'oil', 'sauce', 'stock', 'tin', 'can ', 'beans', 'lentil', 'cereal', 'oats', 'spice', 'salt', 'pepper', 'honey', 'jam', 'vinegar', 'noodle', 'coconut', 'nuts', 'chips', 'biscuit', 'chocolate', 'coffee', 'tea']],
  ['Drinks', ['water', 'juice', 'soda', 'wine', 'beer', 'kombucha', 'soft drink', 'coke']],
  ['Household', ['toilet', 'paper towel', 'detergent', 'soap', 'shampoo', 'conditioner', 'toothpaste', 'bin bag', 'cleaner', 'sponge', 'foil', 'cling', 'tissue', 'battery', 'dishwash', 'laundry', 'deodorant', 'razor']],
];

export function guessAisle(name: string): string {
  const n = ' ' + name.toLowerCase() + ' ';
  if (/\b(stock|sauce|powder|paste|seasoning|dried|spice|tinned|canned)\b/.test(n)) return 'Pantry';
  for (const [aisle, words] of AISLES) if (words.some((w) => n.includes(w))) return aisle;
  return 'Other';
}

export interface PushMsg { to: string; title: string; body: string; data?: Record<string, unknown> }

export async function sendPush(msgs: PushMsg[]) {
  if (!msgs.length) return;
  for (let i = 0; i < msgs.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(msgs.slice(i, i + 100).map((m) => ({ sound: 'default', channelId: 'default', ...m }))),
    }).catch(() => undefined);
  }
}
