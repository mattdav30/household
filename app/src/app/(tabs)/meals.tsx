import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, changes, type Meal, type Recipe } from '../../lib/api';
import { useList } from '../../lib/useList';
import { Button, Card, Chips, ErrorBar, Field, Header, Icon, Sheet, styles as ui, useForm } from '../../components/ui';
import { addDays, dayName, dayNum, friendly, startOfWeek, today } from '../../lib/dates';
import { C, S } from '../../lib/theme';

const SLOTS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];
const slotOrder = (s: string) => SLOTS.findIndex((x) => x.value === s);

type Draft = { id?: string; date: string; slot: string; title: string; recipe_id: string | null; notes: string };

export default function Meals() {
  const router = useRouter();
  const [week, setWeek] = useState(startOfWeek(today()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const { data: meals, error, reload } = useList<Meal>(`/api/meals?from=${week}&to=${addDays(week, 6)}`, 'meals');
  const { data: recipes } = useList<Recipe>('/api/recipes', 'recipes');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const { form, set } = useForm<Draft>(draft ?? { date: today(), slot: 'dinner', title: '', recipe_id: null, notes: '' }, [draft]);

  const recipe = recipes.find((r) => r.id === form.recipe_id);
  const ingredientCount = recipe ? (JSON.parse(recipe.ingredients || '[]') as string[]).length : 0;

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const body = { date: form.date, slot: form.slot, title: form.title, recipe_id: form.recipe_id, notes: form.notes };
    try {
      if (form.id) await api(`/api/meals/${form.id}`, { method: 'PATCH', body });
      else await api('/api/meals', { method: 'POST', body });
      setDraft(null); reload(); changes.emit('meals');
    } finally { setSaving(false); }
  }
  async function remove() {
    if (!form.id) return;
    await api(`/api/meals/${form.id}`, { method: 'DELETE' }).catch(() => undefined);
    setDraft(null); reload();
  }
  async function toShopping() {
    if (!recipe) return;
    const r = await api<{ added: number }>(`/api/recipes/${recipe.id}/to-shopping`, { method: 'POST' });
    changes.emit('shopping_items');
    Alert.alert('Shopping list', r.added ? `Added ${r.added} item${r.added > 1 ? 's' : ''} for ${recipe.title}.` : 'Everything for this recipe sits on the list already.');
  }

  const isThisWeek = week === startOfWeek(today());

  return (
    <View style={{ flex: 1 }}>
      <Header title="Meals" subtitle={isThisWeek ? 'This week' : `Week of ${friendly(week)}`} right={
        <Pressable onPress={() => router.push('/recipes')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="book-open-variant" size={18} color={C.accent} />
          <Text style={{ color: C.accent, fontWeight: '600' }}>Recipes</Text>
        </Pressable>
      } />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: S.lg, paddingBottom: S.sm }}>
        <Pressable onPress={() => setWeek(addDays(week, -7))} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="chevron-left" color={C.accent} /><Text style={{ color: C.accent, fontWeight: '600' }}>Last week</Text>
        </Pressable>
        {!isThisWeek ? <Pressable onPress={() => setWeek(startOfWeek(today()))}><Text style={{ color: C.sub, fontWeight: '600' }}>This week</Text></Pressable> : null}
        <Pressable onPress={() => setWeek(addDays(week, 7))} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: C.accent, fontWeight: '600' }}>Next week</Text><Icon name="chevron-right" color={C.accent} />
        </Pressable>
      </View>
      <ErrorBar error={error} />
      <ScrollView contentContainerStyle={[ui.list, { gap: S.sm }]}>
        {days.map((d) => {
          const list = meals.filter((m) => m.date === d).sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));
          const isToday = d === today();
          return (
            <Card key={d} style={{ flexDirection: 'row', gap: S.lg, paddingVertical: S.md, ...(isToday ? { borderColor: C.accent, borderWidth: 1.5 } : {}) }}>
              <View style={{ width: 40, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: isToday ? C.accent : C.sub }}>{dayName(d).toUpperCase()}</Text>
                <Text style={{ fontSize: 22, fontWeight: '700', color: isToday ? C.accent : C.ink }}>{dayNum(d)}</Text>
              </View>
              <View style={{ flex: 1, justifyContent: 'center', gap: 6 }}>
                {list.map((m) => (
                  <Pressable key={m.id} onPress={() => setDraft({ id: m.id, date: m.date, slot: m.slot, title: m.title, recipe_id: m.recipe_id, notes: m.notes ?? '' })}>
                    <Text style={ui.rowTitle}>{m.title}</Text>
                    {m.slot !== 'dinner' ? <Text style={ui.rowSub}>{SLOTS[slotOrder(m.slot)]?.label}</Text> : null}
                  </Pressable>
                ))}
                <Pressable onPress={() => setDraft({ date: d, slot: list.some((m) => m.slot === 'dinner') ? 'lunch' : 'dinner', title: '', recipe_id: null, notes: '' })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="plus" size={16} color={C.faint} />
                  <Text style={{ color: C.faint, fontSize: 14 }}>{list.length ? 'Add another' : 'Plan a meal'}</Text>
                </Pressable>
              </View>
            </Card>
          );
        })}
      </ScrollView>

      <Sheet visible={!!draft} title={`${form.id ? 'Edit' : 'Plan'} ${friendly(form.date)}`} onClose={() => setDraft(null)} onSave={save} saving={saving} onDelete={form.id ? remove : undefined}>
        <Chips value={form.slot} onChange={(v) => set('slot', v)} options={SLOTS} />
        {recipes.length ? (
          <Chips label="From your recipes" value={form.recipe_id ?? ''} onChange={(id) => {
            const r = recipes.find((x) => x.id === id);
            if (form.recipe_id === id) { set('recipe_id', null); return; }
            set('recipe_id', id); if (r) set('title', r.title);
          }} options={recipes.map((r) => ({ value: r.id, label: r.title }))} />
        ) : null}
        <Field label="Meal" value={form.title} onChangeText={(v) => set('title', v)} placeholder="e.g. Chicken tacos" />
        <Field label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} placeholder="Optional" multiline />
        {recipe && ingredientCount ? <Button kind="ghost" icon="cart-plus" title={`Add ${ingredientCount} ingredients to shopping`} onPress={toShopping} /> : null}
      </Sheet>
    </View>
  );
}
