import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, changes, type Coverage, type Meal, type Recipe } from '../../lib/api';
import { useList, useObject } from '../../lib/useList';
import { addMissingFor, readiness } from '../../lib/autoShop';
import { Button, Card, Check, Chips, ErrorBar, Field, Header, HeaderButton, Icon, IconBadge, Sheet, styles as ui, tap, useForm } from '../../components/ui';
import { ShopSheet } from '../../components/ShopSheet';
import { Appear } from '../../components/Appear';
import { mergeIngredients, readIngredients } from '../../lib/ingredients';
import { addDays, dayName, dayNum, friendly, startOfWeek, today } from '../../lib/dates';
import { C, S } from '../../lib/theme';

const SLOTS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];
const slotOrder = (s: string) => SLOTS.findIndex((x) => x.value === s);

type Draft = { id?: string; date: string; slot: string; title: string; recipe_id: string | null; notes: string; origRecipe?: string | null; autoAdd?: boolean };

const toneColor = (t?: 'good' | 'mid' | 'low') => (t === 'good' ? C.accent : t === 'mid' ? C.sub : C.warm);

export default function Meals() {
  const router = useRouter();
  const [week, setWeek] = useState(startOfWeek(today()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const { data: meals, error, reload } = useList<Meal>(`/api/meals?from=${week}&to=${addDays(week, 6)}`, 'meals');
  const { data: recipes } = useList<Recipe>('/api/recipes', 'recipes');
  const { data: cover } = useObject<Record<string, Coverage>>('/api/recipes/coverage', ['pantry_items', 'shopping_items', 'recipes']);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [shop, setShop] = useState<{ items: ReturnType<typeof mergeIngredients>; note: string } | null>(null);
  const { form, set } = useForm<Draft>(draft ? { autoAdd: true, ...draft, origRecipe: draft.recipe_id } : { date: today(), slot: 'dinner', title: '', recipe_id: null, notes: '', autoAdd: true }, [draft]);

  const recipeById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const body = { date: form.date, slot: form.slot, title: form.title, recipe_id: form.recipe_id, notes: form.notes };
    try {
      if (form.id) await api(`/api/meals/${form.id}`, { method: 'PATCH', body });
      else await api('/api/meals', { method: 'POST', body });
      const addFor = form.recipe_id && form.autoAdd && form.recipe_id !== form.origRecipe ? form.recipe_id : null;
      setDraft(null); reload(); changes.emit('meals');
      // Picking a recipe puts what we lack straight onto the shopping list.
      if (addFor) addMissingFor(addFor, form.title);
    } finally { setSaving(false); }
  }
  async function remove() {
    if (!form.id) return;
    await api(`/api/meals/${form.id}`, { method: 'DELETE' }).catch(() => undefined);
    setDraft(null); reload();
  }

  // Everything this week's planned recipes need, merged into one list.
  function shopWeek() {
    const planned = meals.filter((m) => m.recipe_id && recipeById.has(m.recipe_id) && m.date >= today());
    if (!planned.length) {
      Alert.alert('Shop for the week', 'Plan meals from saved recipes first, then this gathers everything they need.');
      return;
    }
    const lists = planned.map((m) => ({ items: readIngredients(recipeById.get(m.recipe_id!)!.ingredients), from: m.title }));
    setShop({ items: mergeIngredients(lists), note: planned.map((m) => m.title).join(', ') });
  }

  const isThisWeek = week === startOfWeek(today());
  const linked = form.recipe_id ? recipeById.get(form.recipe_id) : undefined;
  const linkedCover = form.recipe_id ? cover?.[form.recipe_id] : undefined;

  return (
    <View style={{ flex: 1 }}>
      <Header eyebrow={isThisWeek ? 'This week' : `Week of ${friendly(week)}`} title="Meals" right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <HeaderButton icon="cart-arrow-down" label="Shop" onPress={shopWeek} />
          <HeaderButton icon="book-open-variant" label="Recipes" onPress={() => router.push('/recipes')} />
        </View>
      } />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, paddingBottom: S.sm }}>
        <Pressable onPress={() => setWeek(addDays(week, -7))} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="chevron-left" color={C.accent} /><Text style={{ color: C.accent, fontWeight: '700' }}>Last week</Text>
        </Pressable>
        {!isThisWeek ? <Pressable onPress={() => setWeek(startOfWeek(today()))}><Text style={{ color: C.sub, fontWeight: '700' }}>This week</Text></Pressable> : null}
        <Pressable onPress={() => setWeek(addDays(week, 7))} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: C.accent, fontWeight: '700' }}>Next week</Text><Icon name="chevron-right" color={C.accent} />
        </Pressable>
      </View>
      <ErrorBar error={error} />
      <ScrollView contentContainerStyle={[ui.list, { gap: S.sm + 2 }]}>
        <Pressable onPress={() => router.push('/ideas')} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.accentSoft, borderColor: 'transparent' }}>
            <IconBadge name="lightbulb-on-outline" color={C.accent} />
            <View style={{ flex: 1 }}>
              <Text style={ui.rowTitle}>Cook with what we have</Text>
              <Text style={ui.rowSub}>Meal ideas ranked by what's in the fridge and pantry</Text>
            </View>
            <Icon name="chevron-right" color={C.accent} />
          </Card>
        </Pressable>
        {days.map((d, di) => {
          const list = meals.filter((m) => m.date === d).sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));
          const isToday = d === today();
          return (
            <Appear key={week + d} index={di + 1}>
            <Card style={[{ flexDirection: 'row', gap: S.lg, paddingVertical: S.md }, isToday ? { borderColor: C.accent } : {}]}>
              <View style={{ width: 42, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: isToday ? C.accent : C.sub, letterSpacing: 0.5 }}>{dayName(d).toUpperCase()}</Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: isToday ? C.accent : C.ink }}>{dayNum(d)}</Text>
              </View>
              <View style={{ flex: 1, justifyContent: 'center', gap: 10 }}>
                {list.map((m) => {
                  const r = m.recipe_id ? recipeById.get(m.recipe_id) : undefined;
                  const ready = m.recipe_id && m.date >= today() ? readiness(cover?.[m.recipe_id]) : null;
                  return (
                    <Pressable key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}
                      onPress={() => setDraft({ id: m.id, date: m.date, slot: m.slot, title: m.title, recipe_id: m.recipe_id, notes: m.notes ?? '' })}>
                      {r?.image_url ? <Image source={{ uri: r.image_url }} style={{ width: 44, height: 44, borderRadius: 12 }} accessible={false} /> : null}
                      <View style={{ flex: 1 }}>
                        <Text style={ui.rowTitle} numberOfLines={1}>{m.title}</Text>
                        {m.slot !== 'dinner' || ready ? (
                          <Text style={ui.rowSub}>
                            {m.slot !== 'dinner' ? SLOTS[slotOrder(m.slot)]?.label : null}
                            {m.slot !== 'dinner' && ready ? ', ' : null}
                            {ready ? <Text style={{ color: toneColor(ready.tone), fontWeight: '700' }}>{ready.label}</Text> : null}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => setDraft({ date: d, slot: list.some((m) => m.slot === 'dinner') ? 'lunch' : 'dinner', title: '', recipe_id: null, notes: '' })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="plus" size={16} color={C.faint} />
                  <Text style={{ color: C.faint, fontSize: 14, fontWeight: '600' }}>{list.length ? 'Add another' : 'Plan a meal'}</Text>
                </Pressable>
              </View>
            </Card>
            </Appear>
          );
        })}
      </ScrollView>

      <Sheet visible={!!draft} title={`${form.id ? 'Edit' : 'Plan'} ${friendly(form.date)}`} onClose={() => setDraft(null)} onSave={save} saving={saving} onDelete={form.id ? remove : undefined}
        extra={linked ? <Button kind="ghost" icon="book-open-page-variant-outline" title="View recipe" onPress={() => { setDraft(null); router.push({ pathname: '/recipe', params: { id: linked.id } }); }} /> : null}>
        <Chips value={form.slot} onChange={(v) => set('slot', v)} options={SLOTS} />
        <View style={{ gap: 6 }}>
          <Text style={ui.label}>From our recipes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm }}>
            {recipes.map((r) => {
              const on = form.recipe_id === r.id;
              return (
                <Pressable key={r.id} onPress={() => { tap(); if (on) set('recipe_id', null); else { set('recipe_id', r.id); set('title', r.title); } }}
                  style={{ width: 96, gap: 4 }}>
                  <View style={{ width: 96, height: 72, borderRadius: 12, overflow: 'hidden', backgroundColor: C.raised, borderWidth: 2, borderColor: on ? C.accent : C.line, alignItems: 'center', justifyContent: 'center' }}>
                    {r.image_url ? <Image source={{ uri: r.image_url }} style={{ width: '100%', height: '100%' }} /> : <Icon name="silverware-fork-knife" color={C.faint} />}
                  </View>
                  <Text numberOfLines={2} style={{ fontSize: 12, color: on ? C.accent : C.ink, fontWeight: on ? '800' : '500' }}>{r.title}</Text>
                  {readiness(cover?.[r.id]) ? <Text style={{ fontSize: 11, fontWeight: '700', color: toneColor(readiness(cover?.[r.id])!.tone) }}>{readiness(cover?.[r.id])!.label}</Text> : null}
                </Pressable>
              );
            })}
            <Pressable onPress={() => { setDraft(null); router.push('/recipes'); }} style={{ width: 96, gap: 4 }}>
              <View style={{ width: 96, height: 72, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="magnify" color={C.accent} />
              </View>
              <Text style={{ fontSize: 12, color: C.accent, fontWeight: '700' }}>Find a recipe</Text>
            </Pressable>
          </ScrollView>
        </View>
        {linkedCover && linkedCover.total ? (
          <View style={{ backgroundColor: C.raised, borderRadius: 14, padding: S.md, gap: 8, borderWidth: 1, borderColor: C.line }}>
            <Text style={ui.rowTitle}>{linkedCover.have} of {linkedCover.total} at home{linkedCover.listed ? `, ${linkedCover.listed} on the list` : ''}</Text>
            {linkedCover.missing.length ? (
              <Text style={ui.rowSub}>Still need: {linkedCover.missing.join(', ')}</Text>
            ) : <Text style={[ui.rowSub, { color: C.accent }]}>Nothing to buy for this one.</Text>}
            {linkedCover.missing.length && form.recipe_id !== form.origRecipe ? (
              <Pressable onPress={() => set('autoAdd', !form.autoAdd)} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingTop: 4 }}>
                <Check on={!!form.autoAdd} onPress={() => set('autoAdd', !form.autoAdd)} label="Add what we need to the shopping list" />
                <Text style={[ui.rowSub, { color: C.ink, marginTop: 0, flex: 1 }]}>Add {linkedCover.missing.length === 1 ? 'it' : `these ${linkedCover.missing.length}`} to the shopping list when I save</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <Field label="Meal" value={form.title} onChangeText={(v) => set('title', v)} placeholder="e.g. Chicken tacos" />
        <Field label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} placeholder="Optional" multiline />
      </Sheet>

      <ShopSheet visible={!!shop} items={shop?.items ?? []} note={shop?.note ?? ''} onClose={() => setShop(null)} />
    </View>
  );
}
