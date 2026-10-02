import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, changes, type Recipe, type RecipeHit, type WebRecipe } from '../lib/api';
import { useList } from '../lib/useList';
import { BackHeader } from '../components/BackHeader';
import { Empty, ErrorBar, Fab, Field, HeaderButton, Icon, Segmented, Sheet, styles as ui, tap } from '../components/ui';
import { parseLine, readIngredients } from '../lib/ingredients';
import { webRecipes } from '../lib/recipeCache';
import { C, S } from '../lib/theme';

type View_ = 'ours' | 'discover';

function RecipeTile({ title, image, sub, onPress }: { title: string; image: string | null; sub?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={sub ? `${title}, ${sub}` : title} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ aspectRatio: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: C.raised, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
        {image ? <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessible={false} /> : <Icon name="silverware-fork-knife" size={34} color={C.faint} />}
      </View>
      <Text style={[ui.rowTitle, { marginTop: 8, fontSize: 15 }]} numberOfLines={2}>{title}</Text>
      {sub ? <Text style={[ui.rowSub, { marginTop: 1 }]} numberOfLines={1}>{sub}</Text> : null}
    </Pressable>
  );
}

function Grid<T>({ data, render, empty, header }: { data: T[]; render: (t: T) => React.ReactElement; empty?: React.ReactElement; header?: React.ReactElement }) {
  return (
    <FlatList
      data={data}
      numColumns={2}
      keyExtractor={(_, i) => String(i)}
      columnWrapperStyle={{ gap: S.md }}
      contentContainerStyle={[ui.list, { gap: S.lg }]}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item }) => (
        <View style={{ flex: 1, maxWidth: '50%' }}>{render(item)}</View>
      )}
    />
  );
}

export default function Recipes() {
  const router = useRouter();
  const [view, setView] = useState<View_>('ours');
  const { data: saved, error, reload } = useList<Recipe>('/api/recipes', 'recipes');
  const [cats, setCats] = useState<string[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<RecipeHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [link, setLink] = useState('');
  const [importing, setImporting] = useState(false);
  const [manual, setManual] = useState(false);
  const [mForm, setMForm] = useState({ title: '', ingredients: '', instructions: '', url: '' });

  const savedIds = useMemo(() => new Set(saved.map((r) => r.source_id && `mealdb:${r.source_id}`)), [saved]);

  async function search(query: string, category: string | null) {
    setSearching(true); setDiscoverError(null);
    try {
      const qs = category ? `c=${encodeURIComponent(category)}` : `q=${encodeURIComponent(query)}`;
      setHits(await api<RecipeHit[]>(`/api/discover/search?${qs}`));
    } catch (e) { setDiscoverError((e as Error).message); } finally { setSearching(false); }
  }

  useEffect(() => {
    if (view !== 'discover' || cats.length) return;
    api<{ name: string }[]>('/api/discover/categories').then((c) => setCats(c.map((x) => x.name))).catch(() => undefined);
    if (!hits) search('', null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function doImport() {
    setImporting(true);
    try {
      const r = await api<WebRecipe>('/api/discover/import', { method: 'POST', body: { url: link } });
      webRecipes.set(r.id, r);
      setImportOpen(false); setLink('');
      router.push({ pathname: '/recipe', params: { id: r.id } });
    } catch (e) {
      Alert.alert('Could not import', (e as Error).message);
    } finally { setImporting(false); }
  }

  async function saveManual() {
    if (!mForm.title.trim()) return;
    const ingredients = mForm.ingredients.split('\n').map((s) => s.trim()).filter(Boolean).map(parseLine);
    await api('/api/recipes', { method: 'POST', body: { title: mForm.title, ingredients, instructions: mForm.instructions, url: mForm.url, source: 'manual' } })
      .catch((e) => Alert.alert('Could not save', (e as Error).message));
    setManual(false); setMForm({ title: '', ingredients: '', instructions: '', url: '' }); reload(); changes.emit('recipes');
  }

  return (
    <View style={{ flex: 1 }}>
      <BackHeader title="Recipes" right={<HeaderButton icon="link-variant" label="Import link" onPress={() => setImportOpen(true)} />} />
      <View style={{ paddingHorizontal: S.lg, paddingBottom: S.md }}>
        <Segmented value={view} onChange={setView} options={[{ value: 'ours', label: `Our recipes${saved.length ? ` · ${saved.length}` : ''}` }, { value: 'discover', label: 'Discover' }]} />
      </View>

      {view === 'ours' ? (
        <>
          <ErrorBar error={error} />
          <Grid
            data={saved}
            render={(r) => (
              <RecipeTile title={r.title} image={r.image_url} sub={`${readIngredients(r.ingredients).length} ingredients`}
                onPress={() => router.push({ pathname: '/recipe', params: { id: r.id } })} />
            )}
            empty={<Empty icon="book-open-variant" title="No saved recipes yet" text="Find one in Discover, paste a link from any recipe site with Import link, or add your own with the plus button." />}
          />
          <Fab onPress={() => setManual(true)} />
        </>
      ) : (
        <>
          <View style={{ paddingHorizontal: S.lg, gap: S.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingLeft: S.md }}>
              <Icon name="magnify" color={C.sub} />
              <TextInput value={q} onChangeText={setQ} placeholder="Search a dish or ingredient, e.g. chicken…" placeholderTextColor={C.faint}
                returnKeyType="search" onSubmitEditing={() => { setCat(null); search(q, null); }} selectionColor={C.accent}
                style={{ flex: 1, fontSize: 16, paddingVertical: 13, paddingHorizontal: S.sm, color: C.ink }} />
              {searching ? <ActivityIndicator color={C.accent} style={{ marginRight: S.md }} /> : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm, paddingVertical: S.xs }}>
              {cats.map((c) => {
                const on = c === cat;
                return (
                  <Pressable key={c} onPress={() => { tap(); const next = on ? null : c; setCat(next); setQ(''); search('', next); }}
                    style={[ui.chip, on && { backgroundColor: C.accent, borderColor: C.accent }]}>
                    <Text style={[ui.chipText, on && { color: C.onAccent, fontWeight: '700' }]}>{c}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <ErrorBar error={discoverError} />
          <Grid
            data={hits ?? []}
            header={<Text style={[ui.rowSub, { marginTop: S.sm }]}>{cat ? `${cat} recipes` : q ? `Results for "${q}"` : 'A few ideas to start. Search or pick a category for more.'}</Text>}
            render={(h) => (
              <RecipeTile title={h.title} image={h.image_url} sub={savedIds.has(h.id) ? 'Saved' : h.category ?? undefined}
                onPress={() => router.push({ pathname: '/recipe', params: { id: h.id } })} />
            )}
            empty={hits && !searching ? <Empty icon="magnify" title="No matches" text="Try a simpler word, like beef, pasta or curry." /> : undefined}
          />
        </>
      )}

      <Sheet visible={importOpen} title="Import a recipe" onClose={() => setImportOpen(false)} onSave={doImport} saving={importing} saveLabel="Import">
        <Text style={ui.rowSub}>Paste the link to a recipe page from sites like RecipeTin Eats, taste.com.au or BBC Good Food. The app pulls in the photo, ingredients and method.</Text>
        <Field label="Recipe link" value={link} onChangeText={setLink} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" autoFocus />
      </Sheet>

      <Sheet visible={manual} title="New recipe" onClose={() => setManual(false)} onSave={saveManual}>
        <Field label="Name" value={mForm.title} onChangeText={(v) => setMForm((f) => ({ ...f, title: v }))} placeholder="e.g. Mum's lasagne" />
        <Field label="Ingredients, one per line" value={mForm.ingredients} onChangeText={(v) => setMForm((f) => ({ ...f, ingredients: v }))} multiline placeholder={'500g beef mince\n1 brown onion\n2 cans diced tomatoes'} style={{ minHeight: 140 }} />
        <Field label="Method" value={mForm.instructions} onChangeText={(v) => setMForm((f) => ({ ...f, instructions: v }))} multiline placeholder="Optional" />
        <Field label="Link" value={mForm.url} onChangeText={(v) => setMForm((f) => ({ ...f, url: v }))} placeholder="Optional" autoCapitalize="none" keyboardType="url" />
      </Sheet>
    </View>
  );
}
