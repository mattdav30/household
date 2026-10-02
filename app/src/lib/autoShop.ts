import { Alert } from 'react-native';
import { api, changes, type Coverage } from './api';

/**
 * Puts a saved recipe's missing ingredients on the shopping list, skipping
 * anything at home or already listed, then offers an undo.
 */
export async function addMissingFor(recipeId: string, note: string) {
  try {
    const r = await api<{ added: number; ids: string[]; names: string[] }>(`/api/recipes/${recipeId}/to-shopping`, { method: 'POST', body: { note } });
    changes.emit('shopping_items');
    if (!r.added) {
      Alert.alert('Shopping list', 'You have everything for this, or it is on the list already.');
      return;
    }
    const shown = r.names.slice(0, 4).join(', ') + (r.names.length > 4 ? ` and ${r.names.length - 4} more` : '');
    Alert.alert(`Added ${r.added} to shopping`, shown, [
      { text: 'Undo', style: 'cancel', onPress: async () => {
        await api('/api/shopping_items/remove-many', { method: 'POST', body: { ids: r.ids } }).catch(() => undefined);
        changes.emit('shopping_items');
      } },
      { text: 'OK' },
    ]);
  } catch (e) {
    Alert.alert('Could not add to shopping', (e as Error).message);
  }
}

/** "All at home", "2 to buy", "On the list". */
export function readiness(c: Coverage | undefined) {
  if (!c || !c.total) return null;
  if (c.need === 0 && c.listed === 0) return { label: 'All at home', tone: 'good' as const };
  if (c.need === 0) return { label: `${c.listed} on the list`, tone: 'mid' as const };
  return { label: `${c.need} to buy`, tone: c.need <= 2 ? 'mid' as const : 'low' as const };
}
