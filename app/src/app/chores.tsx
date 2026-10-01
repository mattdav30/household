import { useMemo, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { api, changes, type Chore } from '../lib/api';
import { useList } from '../lib/useList';
import { useSession } from '../lib/session';
import { BackHeader } from '../components/BackHeader';
import { Check, Chips, DateField, Empty, ErrorBar, Fab, Field, Icon, Loading, Pill, Sheet, styles as ui, useForm } from '../components/ui';
import { REPEATS, daysUntil, friendly, repeatLabel, today } from '../lib/dates';
import { C, R, S } from '../lib/theme';

type Draft = { id?: string; title: string; assignee_id: string; due_date: string | null; repeat: string; notes: string };
const blank = (): Draft => ({ title: '', assignee_id: '', due_date: today(), repeat: 'none', notes: '' });

export default function Chores() {
  const { profile, memberName, memberColor } = useSession();
  const { data, setData, loading, error, reload } = useList<Chore>('/api/chores', 'chores');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const { form, set } = useForm<Draft>(draft ?? blank(), [draft]);

  const sections = useMemo(() => {
    const open = data.filter((c) => !c.done_at && (filter === 'all' || c.assignee_id === filter || !c.assignee_id));
    const t = today();
    const groups = [
      { title: 'Overdue', data: open.filter((c) => c.due_date && c.due_date < t) },
      { title: 'Today', data: open.filter((c) => c.due_date === t) },
      { title: 'This week', data: open.filter((c) => c.due_date && c.due_date > t && daysUntil(c.due_date) <= 7) },
      { title: 'Later', data: open.filter((c) => c.due_date && daysUntil(c.due_date) > 7) },
      { title: 'Anytime', data: open.filter((c) => !c.due_date) },
      { title: 'Done', data: data.filter((c) => c.done_at).slice(0, 15) },
    ];
    return groups.filter((g) => g.data.length);
  }, [data, filter]);

  async function complete(c: Chore) {
    if (c.done_at) {
      setData((d) => d.map((x) => (x.id === c.id ? { ...x, done_at: null } : x)));
      await api(`/api/chores/${c.id}`, { method: 'PATCH', body: { done_at: null } }).catch(reload);
      return;
    }
    const updated = await api<Chore>(`/api/chores/${c.id}/complete`, { method: 'POST' }).catch(() => null);
    if (updated) setData((d) => d.map((x) => (x.id === c.id ? updated : x)));
    changes.emit('chores');
  }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const { id, ...rest } = form;
    const body = { ...rest, assignee_id: rest.assignee_id || null };
    try {
      if (id) await api(`/api/chores/${id}`, { method: 'PATCH', body });
      else await api('/api/chores', { method: 'POST', body });
      setDraft(null); reload(); changes.emit('chores');
    } finally { setSaving(false); }
  }
  async function remove() {
    if (!form.id) return;
    await api(`/api/chores/${form.id}`, { method: 'DELETE' }).catch(() => undefined);
    setDraft(null); reload(); changes.emit('chores');
  }

  const people = [{ value: '', label: 'Either' }, ...(profile?.members ?? []).map((m) => ({ value: m.id, label: m.name, color: m.color }))];

  return (
    <View style={{ flex: 1 }}>
      <BackHeader title="Chores" subtitle="Ticking a repeating chore moves it to the next date." />
      <View style={{ paddingHorizontal: S.lg }}>
        <Chips value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Everyone' }, ...(profile?.members ?? []).map((m) => ({ value: m.id, label: m.name, color: m.color }))]} />
      </View>
      <ErrorBar error={error} />
      {loading ? <Loading /> : (
        <SectionList
          sections={sections}
          keyExtractor={(c) => c.id}
          contentContainerStyle={ui.list}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={<Empty icon="broom" title="No chores yet" text="Add the regular jobs, like bins on Tuesday or the car service each year, and the app reminds whoever owns them." />}
          renderSectionHeader={({ section }) => <Text style={[ui.section, { marginTop: S.lg, marginBottom: S.sm, paddingHorizontal: S.xs }, section.title === 'Overdue' && { color: C.warm }]}>{section.title}</Text>}
          renderItem={({ item, index, section }) => (
            <View style={{
              backgroundColor: C.card, paddingHorizontal: S.lg,
              borderTopLeftRadius: index === 0 ? R.card : 0, borderTopRightRadius: index === 0 ? R.card : 0,
              borderBottomLeftRadius: index === section.data.length - 1 ? R.card : 0, borderBottomRightRadius: index === section.data.length - 1 ? R.card : 0,
            }}>
              {index ? <View style={ui.sep} /> : null}
              <View style={ui.row}>
                <Check on={!!item.done_at} onPress={() => complete(item)} color={item.assignee_id ? memberColor(item.assignee_id) : C.accent} />
                <Pressable style={{ flex: 1 }} onPress={() => setDraft({ id: item.id, title: item.title, assignee_id: item.assignee_id ?? '', due_date: item.due_date, repeat: item.repeat, notes: item.notes ?? '' })}>
                  <Text style={[ui.rowTitle, !!item.done_at && { color: C.faint, textDecorationLine: 'line-through' }]}>{item.title}</Text>
                  <Text style={ui.rowSub}>{[item.due_date ? friendly(item.due_date) : null, memberName(item.assignee_id)].filter(Boolean).join(' · ')}</Text>
                </Pressable>
                {item.repeat !== 'none' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Icon name="repeat" size={14} color={C.sub} />
                    <Pill label={repeatLabel(item.repeat)} />
                  </View>
                ) : null}
              </View>
            </View>
          )}
        />
      )}
      <Fab onPress={() => setDraft(blank())} />
      <Sheet visible={!!draft} title={form.id ? 'Edit chore' : 'New chore'} onClose={() => setDraft(null)} onSave={save} saving={saving} onDelete={form.id ? remove : undefined}>
        <Field label="What" value={form.title} onChangeText={(v) => set('title', v)} placeholder="e.g. Bins out" />
        <Chips label="Who" value={form.assignee_id} onChange={(v) => set('assignee_id', v)} options={people} />
        <DateField label="Due" value={form.due_date} onChange={(v) => set('due_date', v)} optional />
        <Chips label="Repeats" value={form.repeat} onChange={(v) => set('repeat', v)} options={REPEATS.map((r) => ({ value: r, label: repeatLabel(r) }))} />
        <Field label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} placeholder="Optional" multiline />
      </Sheet>
    </View>
  );
}
