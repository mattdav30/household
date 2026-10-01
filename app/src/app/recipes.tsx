import { useState } from 'react';
import { FlatList, Linking, Pressable, Text, View } from 'react-native';
import { api, changes, type Recipe } from '../lib/api';
import { useList } from '../lib/useList';
import { Card, Empty, ErrorBar, Fab, Field, Icon, Sheet, styles as ui, useForm } from '../components/ui';
import { BackHeader } from '../components/BackHeader';
import { C, S } from '../lib/theme';

type Draft = { id?: string; title: string; ingredients: string; url: string; notes: string };
const blank: Draft = { title: '', ingredients: '', url: '', notes: '' };

export default function Recipes() {
  const { data, error, reload } = useList<Recipe>('/api/recipes', 'recipes');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const { form, set } = useForm<Draft>(draft ?? blank, [draft]);

  const open = (r: Recipe) => setDraft({
    id: r.id, title: r.title, url: r.url ?? '', notes: r.notes ?? '',
    ingredients: (JSON.parse(r.ingredients || '[]') as string[]).join('\n'),
  });

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const body = { title: form.title, url: form.url, notes: form.notes, ingredients: form.ingredients.split('\n').map((s) => s.trim()).filter(Boolean) };
    try {
      if (form.id) await api(`/api/recipes/${form.id}`, { method: 'PATCH', body });
      else await api('/api/recipes', { method: 'POST', body });
      setDraft(null); reload(); changes.emit('recipes');
    } finally { setSaving(false); }
  }
  async function remove() {
    if (!form.id) return;
    await api(`/api/recipes/${form.id}`, { method: 'DELETE' }).catch(() => undefined);
    setDraft(null); reload(); changes.emit('recipes');
  }

  return (
    <View style={{ flex: 1 }}>
      <BackHeader title="Recipes" />
      <ErrorBar error={error} />
      <FlatList
        data={data}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[ui.list, { gap: S.sm }]}
        ListEmptyComponent={<Empty icon="book-open-variant" title="No recipes yet" text="Save your regular meals with their ingredients, then send them to the shopping list in one tap." />}
        renderItem={({ item }) => {
          const n = (JSON.parse(item.ingredients || '[]') as string[]).length;
          return (
            <Pressable onPress={() => open(item)}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={ui.rowTitle}>{item.title}</Text>
                  <Text style={ui.rowSub}>{n} ingredient{n === 1 ? '' : 's'}</Text>
                </View>
                {item.url ? (
                  <Pressable hitSlop={10} onPress={() => Linking.openURL(item.url!)}><Icon name="open-in-new" size={20} color={C.accent} /></Pressable>
                ) : null}
              </Card>
            </Pressable>
          );
        }}
      />
      <Fab onPress={() => setDraft({ ...blank })} />
      <Sheet visible={!!draft} title={form.id ? 'Edit recipe' : 'New recipe'} onClose={() => setDraft(null)} onSave={save} saving={saving} onDelete={form.id ? remove : undefined}>
        <Field label="Name" value={form.title} onChangeText={(v) => set('title', v)} placeholder="e.g. Beef tacos" />
        <Field label="Ingredients, one per line" value={form.ingredients} onChangeText={(v) => set('ingredients', v)} multiline placeholder={'Tortillas\nBeef mince\nLettuce'} style={{ minHeight: 140 }} />
        <Field label="Link" value={form.url} onChangeText={(v) => set('url', v)} placeholder="Optional recipe link" autoCapitalize="none" keyboardType="url" />
        <Field label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} multiline placeholder="Optional" />
      </Sheet>
    </View>
  );
}
