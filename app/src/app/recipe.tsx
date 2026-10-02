import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { api, changes, type CheckedIngredient, type Ingredient, type Recipe, type WebRecipe } from '../lib/api';
import { BackHeader } from '../components/BackHeader';
import { ShopSheet } from '../components/ShopSheet';
import { Button, Card, Field, Icon, Pill, SectionTitle, Sheet, styles as ui } from '../components/ui';
import { ingredientLine, parseLine, readIngredients } from '../lib/ingredients';
import { webRecipes } from '../lib/recipeCache';
import { friendlyInline, iso } from '../lib/dates';
import { C, S } from '../lib/theme';

type Model = {
  title: string; image_url: string | null; ingredients: Ingredient[]; instructions: string | null; servings: string | null;
  source_url: string | null; category: string | null; source: string | null; source_id: string | null; savedId: string | null;
};

const fromSaved = (r: Recipe): Model => ({
  title: r.title, image_url: r.image_url, ingredients: readIngredients(r.ingredients), instructions: r.instructions ?? r.notes,
  servings: r.servings, source_url: r.url, category: null, source: r.source, source_id: r.source_id, savedId: r.id,
});
const fromWeb = (r: WebRecipe): Model => ({
  title: r.title, image_url: r.image_url, ingredients: r.ingredients, instructions: r.instructions, servings: r.servings,
  source_url: r.source_url, category: [r.category, r.area].filter(Boolean).join(' · ') || null, source: r.source, source_id: r.source_id, savedId: null,
});

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CheckedIngredient[] | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', ingredients: '', instructions: '', url: '' });

  const load = useCallback(async () => {
    try {
      const saved = await api<Recipe[]>('/api/recipes');
      if (id.startsWith('mealdb:')) {
        const mine = saved.find((r) => r.source === 'mealdb' && `mealdb:${r.source_id}` === id);
        setModel(mine ? fromSaved(mine) : fromWeb(await api<WebRecipe>(`/api/discover/meal/${encodeURIComponent(id)}`)));
      } else if (id.startsWith('url:')) {
        const mine = saved.find((r) => r.url && `url:${r.url}` === id);
        const web = webRecipes.get(id);
        if (mine) setModel(fromSaved(mine));
        else if (web) setModel(fromWeb(web));
        else setError('Import the link again from Recipes.');
      } else {
        const mine = saved.find((r) => r.id === id);
        if (mine) setModel(fromSaved(mine)); else setError('This recipe has been deleted.');
      }
    } catch (e) { setError((e as Error).message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Mark each ingredient as at home, on the list, or needed.
  useEffect(() => {
    if (!model?.ingredients.length) return;
    const check = () => api<CheckedIngredient[]>('/api/ingredients/check', { method: 'POST', body: { items: model.ingredients } }).then(setStatus).catch(() => undefined);
    check();
    return changes.on((t) => { if (t === 'pantry_items' || t === 'shopping_items') check(); });
  }, [model]);

  async function ensureSaved(m: Model): Promise<string> {
    if (m.savedId) return m.savedId;
    const row = await api<Recipe>('/api/recipes', {
      method: 'POST',
      body: { title: m.title, ingredients: m.ingredients, image_url: m.image_url, instructions: m.instructions, servings: m.servings, url: m.source_url, source: m.source, source_id: m.source_id },
    });
    setModel({ ...m, savedId: row.id });
    changes.emit('recipes');
    return row.id;
  }

  async function save() {
    if (!model) return;
    setBusy(true);
    try { await ensureSaved(model); Alert.alert('Saved', `${model.title} is in Our recipes.`); } catch (e) { Alert.alert('Could not save', (e as Error).message); } finally { setBusy(false); }
  }

  function plan() {
    if (!model) return;
    DateTimePickerAndroid.open({
      value: new Date(), mode: 'date',
      onChange: async (e, d) => {
        if (e.type !== 'set' || !d) return;
        try {
          const recipeId = await ensureSaved(model);
          await api('/api/meals', { method: 'POST', body: { date: iso(d), slot: 'dinner', title: model.title, recipe_id: recipeId } });
          changes.emit('meals');
          Alert.alert('Planned', `${model.title} for ${friendlyInline(iso(d))}.`, [
            { text: 'OK' }, { text: 'Add ingredients to list', onPress: () => setShopOpen(true) },
          ]);
        } catch (err) { Alert.alert('Could not plan', (err as Error).message); }
      },
    });
  }

  function openEdit() {
    if (!model) return;
    setForm({ title: model.title, ingredients: model.ingredients.map(ingredientLine).join('\n'), instructions: model.instructions ?? '', url: model.source_url ?? '' });
    setEditOpen(true);
  }
  async function saveEdit() {
    if (!model?.savedId) return;
    const ingredients = form.ingredients.split('\n').map((s) => s.trim()).filter(Boolean).map(parseLine);
    await api(`/api/recipes/${model.savedId}`, { method: 'PATCH', body: { title: form.title, ingredients, instructions: form.instructions, url: form.url } })
      .catch((e) => Alert.alert('Could not save', (e as Error).message));
    setEditOpen(false); changes.emit('recipes'); load();
  }
  function remove() {
    if (!model?.savedId) return;
    Alert.alert(`Delete ${model.title}?`, 'Meals already planned keep their name.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await api(`/api/recipes/${model.savedId}`, { method: 'DELETE' }).catch(() => undefined);
        changes.emit('recipes'); setEditOpen(false); router.back();
      } },
    ]);
  }

  if (error) return <View style={{ flex: 1 }}><BackHeader title="Recipe" /><Text style={[ui.rowSub, { padding: S.lg }]}>{error}</Text></View>;
  if (!model) return <View style={{ flex: 1 }}><BackHeader title="Recipe" /><ActivityIndicator color={C.accent} style={{ marginTop: 60 }} /></View>;

  const need = status?.filter((s) => s.status === 'need').length;
  const steps = (model.instructions ?? '').split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {model.image_url ? (
          <View style={{ height: 300, backgroundColor: C.card }}>
            <Image source={{ uri: model.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={`Photo of ${model.title}`} />
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.45)' }} />
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"
              style={{ position: 'absolute', top: insets.top + 10, left: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="chevron-left" color="#fff" size={26} />
            </Pressable>
            <View style={{ position: 'absolute', left: 20, right: 20, bottom: 18 }}>
              {model.category ? <Text style={{ color: '#fff', opacity: 0.85, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>{model.category.toUpperCase()}</Text> : null}
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>{model.title}</Text>
            </View>
          </View>
        ) : <BackHeader title={model.title} subtitle={model.category ?? undefined} />}

        <View style={{ paddingHorizontal: S.lg, gap: S.sm, marginTop: S.lg }}>
          <Button icon="cart-plus" title={need === undefined ? 'Add to shopping list' : need ? `Add ${need} missing to shopping list` : 'Check the shopping list'} onPress={() => setShopOpen(true)} />
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <View style={{ flex: 1 }}><Button kind="soft" icon="calendar-plus" title="Plan it" onPress={plan} /></View>
            <View style={{ flex: 1 }}>
              {model.savedId
                ? <Button kind="soft" icon="pencil-outline" title="Edit" onPress={openEdit} />
                : <Button kind="soft" icon="bookmark-plus-outline" title="Save" onPress={save} busy={busy} />}
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: S.lg }}>
          <SectionTitle right={status ? <Text style={ui.rowSub}>{status.filter((s) => s.status === 'have').length} of {status.length} at home</Text> : null}>
            Ingredients
          </SectionTitle>
          <Card style={{ paddingVertical: S.xs }}>
            {!model.ingredients.length ? <Text style={[ui.rowSub, { paddingVertical: S.md }]}>No ingredients listed.</Text> : null}
            {model.ingredients.map((ing, i) => {
              const st = status?.[i];
              return (
                <View key={i} style={[ui.row, { paddingVertical: 11 }, i ? { borderTopWidth: 1, borderTopColor: C.line } : null]}>
                  <Icon name={st?.status === 'have' ? 'check-circle' : st?.status === 'listed' ? 'cart-outline' : 'circle-outline'} size={20}
                    color={st?.status === 'have' ? C.accent : st?.status === 'listed' ? C.sub : C.faint} />
                  <Text style={[ui.rowTitle, { flex: 1, fontWeight: '500' }]}>{ing.name}</Text>
                  {ing.qty ? <Text style={{ color: C.sub, fontSize: 14, maxWidth: '40%', textAlign: 'right' }}>{ing.qty}</Text> : null}
                  {st?.status === 'listed' ? <Pill label="On list" /> : null}
                </View>
              );
            })}
          </Card>

          {steps.length ? (
            <>
              <SectionTitle right={model.servings ? <Text style={ui.rowSub}>Serves {model.servings}</Text> : null}>Method</SectionTitle>
              <Card style={{ gap: S.md }}>
                {steps.map((s, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: S.md }}>
                    <Text style={{ color: C.accent, fontWeight: '800', width: 22 }}>{i + 1}</Text>
                    <Text style={{ color: C.ink, fontSize: 15, lineHeight: 22, flex: 1 }}>{s.replace(/^(step\s*)?\d+[.):]\s*/i, '')}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {model.source_url ? (
            <Pressable onPress={() => Linking.openURL(model.source_url!)} style={[ui.row, { justifyContent: 'center', marginTop: S.md }]}>
              <Icon name="open-in-new" size={18} color={C.accent} />
              <Text style={{ color: C.accent, fontWeight: '700' }}>Open original recipe</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <ShopSheet visible={shopOpen} items={model.ingredients} note={model.title} onClose={() => setShopOpen(false)} />

      <Sheet visible={editOpen} title="Edit recipe" onClose={() => setEditOpen(false)} onSave={saveEdit} onDelete={remove} confirmDelete={false}>
        <Field label="Name" value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} />
        <Field label="Ingredients, one per line" value={form.ingredients} onChangeText={(v) => setForm((f) => ({ ...f, ingredients: v }))} multiline style={{ minHeight: 160 }} />
        <Field label="Method" value={form.instructions} onChangeText={(v) => setForm((f) => ({ ...f, instructions: v }))} multiline />
        <Field label="Link" value={form.url} onChangeText={(v) => setForm((f) => ({ ...f, url: v }))} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      </Sheet>
    </View>
  );
}
