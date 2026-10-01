import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { api, changes, type Bill, type CalEvent, type Chore } from '../../lib/api';
import { useList } from '../../lib/useList';
import { useSession } from '../../lib/session';
import {
  Button, Card, Chips, DateField, ErrorBar, Fab, Field, Header, HeaderButton, Icon, SectionTitle, Sheet, Swatches, TimeField, styles as ui, useForm,
} from '../../components/ui';
import { friendly, friendlyInline, iso, money, parse, repeatLabel, time12, today } from '../../lib/dates';
import { C, EVENT_COLORS, S, tint } from '../../lib/theme';

type Draft = {
  id?: string; occurrence?: string; title: string; date: string; start_time: string | null; end_time: string | null;
  who: string; location: string; notes: string; color: string | null; repeat: string; repeat_until: string | null;
};
type Chip = { key: string; label: string; color: string; time: string; kind: 'event' | 'chore' | 'bill'; ev?: CalEvent; sub?: string };

const EVENT_REPEATS = ['none', 'daily', 'weekly', 'fortnightly', 'monthly', 'yearly'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthGrid(month: string) {
  const first = parse(month.slice(0, 7) + '-01');
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const rows = Math.ceil((offset + daysInMonth) / 7);
  const start = new Date(first);
  start.setDate(1 - offset);
  return Array.from({ length: rows * 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return iso(d); });
}
function shiftMonth(month: string, n: number) {
  const d = parse(month.slice(0, 7) + '-01');
  d.setMonth(d.getMonth() + n);
  return iso(d);
}

export default function Calendar() {
  const { profile, memberName, memberColor } = useSession();
  const [month, setMonth] = useState(today().slice(0, 7) + '-01');
  const [selected, setSelected] = useState(today());
  const grid = useMemo(() => monthGrid(month), [month]);
  const { data: events, error, reload } = useList<CalEvent>(`/api/events?from=${grid[0]}&to=${grid[grid.length - 1]}`, 'events');
  const { data: bills } = useList<Bill>('/api/bills', 'bills');
  const { data: chores } = useList<Chore>('/api/chores', 'chores');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const blank = (date: string): Draft => ({ title: '', date, start_time: null, end_time: null, who: 'both', location: '', notes: '', color: null, repeat: 'none', repeat_until: null });
  const { form, set } = useForm<Draft>(draft ?? blank(selected), [draft]);

  const evColor = (e: { color: string | null; who: string }) => e.color ?? (e.who === 'both' ? C.accent : memberColor(e.who));

  // Everything that lands on each day, as small coloured chips.
  const byDay = useMemo(() => {
    const map: Record<string, Chip[]> = {};
    const push = (d: string | null, c: Chip) => { if (d) (map[d] ??= []).push(c); };
    for (const e of events) push(e.date, { key: e.id + e.date, label: e.title, color: evColor(e), time: e.start_time ?? '', kind: 'event', ev: e });
    for (const c of chores) if (!c.done_at) push(c.due_date, { key: c.id, label: c.title, color: c.assignee_id ? memberColor(c.assignee_id) : '#8C9A95', time: '99', kind: 'chore', sub: memberName(c.assignee_id) });
    for (const b of bills) push(b.due_date, { key: b.id, label: b.name, color: C.warm, time: '98', kind: 'bill', sub: money(b.amount_cents) });
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.time || '00').localeCompare(b.time || '00'));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, chores, bills, profile]);

  const whoOptions = [{ value: 'both', label: 'Both of us' }, ...(profile?.members ?? []).map((m) => ({ value: m.id, label: m.name, color: memberColor(m.id) }))];
  const openEvent = (e: CalEvent) => setDraft({
    id: e.id, occurrence: e.date, title: e.title, date: e.series_date ?? e.date, start_time: e.start_time, end_time: e.end_time,
    who: e.who, location: e.location ?? '', notes: e.notes ?? '', color: e.color, repeat: e.repeat || 'none', repeat_until: e.repeat_until,
  });

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const { id, occurrence, ...body } = form;
    if (body.repeat === 'none') body.repeat_until = null;
    try {
      if (id) await api(`/api/events/${id}`, { method: 'PATCH', body });
      else await api('/api/events', { method: 'POST', body });
      if (!id) setSelected(form.date);
      setDraft(null); reload(); changes.emit('events');
    } catch (e) { Alert.alert('Could not save', (e as Error).message); } finally { setSaving(false); }
  }
  async function removeAll() {
    if (!form.id) return;
    await api(`/api/events/${form.id}`, { method: 'DELETE' }).catch(() => undefined);
    setDraft(null); reload(); changes.emit('events');
  }
  const remove = () => {
    if (form.repeat === 'none') return removeAll();
    Alert.alert('Delete repeating event', 'This removes every date in the series.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete all', style: 'destructive', onPress: removeAll },
    ]);
  };
  async function skipOne() {
    if (!form.id || !form.occurrence) return;
    await api(`/api/events/${form.id}/skip`, { method: 'POST', body: { date: form.occurrence } }).catch(() => undefined);
    setDraft(null); reload(); changes.emit('events');
  }

  const m = parse(month);
  const isThisMonth = month.slice(0, 7) === today().slice(0, 7);
  const dayItems = byDay[selected] ?? [];

  return (
    <View style={{ flex: 1 }}>
      <Header eyebrow={String(m.getFullYear())} title={MONTHS[m.getMonth()]} right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <HeaderButton icon="chevron-left" onPress={() => setMonth(shiftMonth(month, -1))} />
          {!isThisMonth ? <HeaderButton icon="calendar-today" label="Today" onPress={() => { setMonth(today().slice(0, 7) + '-01'); setSelected(today()); }} /> : null}
          <HeaderButton icon="chevron-right" onPress={() => setMonth(shiftMonth(month, 1))} />
        </View>
      } />
      <ErrorBar error={error} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: 6 }}>
          <View style={{ flexDirection: 'row', paddingBottom: 6 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: C.faint, letterSpacing: 0.5 }}>{d.toUpperCase()}</Text>
            ))}
          </View>
          <View style={{ borderTopWidth: 1, borderLeftWidth: 1, borderColor: C.line, borderRadius: 14, overflow: 'hidden', backgroundColor: C.card }}>
            {Array.from({ length: grid.length / 7 }, (_, row) => (
              <View key={row} style={{ flexDirection: 'row' }}>
                {grid.slice(row * 7, row * 7 + 7).map((d) => {
                  const inMonth = d.slice(0, 7) === month.slice(0, 7);
                  const isSel = d === selected;
                  const isToday = d === today();
                  const items = byDay[d] ?? [];
                  const shown = items.slice(0, 3);
                  return (
                    <Pressable key={d} onPress={() => setSelected(d)}
                      style={{ flex: 1, minHeight: 92, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.line, padding: 2, backgroundColor: isSel ? C.raised : inMonth ? 'transparent' : tint('#000000', 0.12) }}>
                      <View style={{ alignItems: 'center', marginBottom: 2 }}>
                        <View style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? C.accent : 'transparent' }}>
                          <Text style={{ fontSize: 13, fontWeight: isToday || isSel ? '800' : '600', color: isToday ? C.onAccent : inMonth ? C.ink : C.faint }}>{parse(d).getDate()}</Text>
                        </View>
                      </View>
                      {shown.map((c) => (
                        <View key={c.key} style={{ backgroundColor: tint(c.color, c.kind === 'event' ? 0.28 : 0.16), borderLeftWidth: 2, borderLeftColor: c.color, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1, marginBottom: 2 }}>
                          <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '600', color: inMonth ? C.ink : C.sub }}>{c.label}</Text>
                        </View>
                      ))}
                      {items.length > 3 ? <Text style={{ fontSize: 10, color: C.sub, fontWeight: '700', paddingLeft: 3 }}>+{items.length - 3} more</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: S.lg }}>
          <SectionTitle>{friendly(selected)}</SectionTitle>
          <Card style={{ paddingVertical: S.xs }}>
            {!dayItems.length ? (
              <Pressable onPress={() => setDraft(blank(selected))} style={ui.row}>
                <Icon name="plus" size={18} color={C.faint} /><Text style={{ color: C.sub, fontSize: 15 }}>Nothing on. Tap to add an event.</Text>
              </Pressable>
            ) : null}
            {dayItems.map((c, i) => (
              <View key={c.key}>
                {i ? <View style={ui.sep} /> : null}
                <Pressable style={ui.row} disabled={!c.ev} onPress={() => c.ev && openEvent(c.ev)}>
                  <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: c.color }} />
                  <View style={{ width: 62 }}>
                    {c.kind === 'event' ? (
                      <>
                        <Text style={{ fontWeight: '700', color: C.ink }}>{c.ev?.start_time ? time12(c.ev.start_time) : 'All day'}</Text>
                        {c.ev?.end_time ? <Text style={ui.rowSub}>{time12(c.ev.end_time)}</Text> : null}
                      </>
                    ) : <Icon name={c.kind === 'bill' ? 'receipt-text-outline' : 'broom'} size={20} color={c.color} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={ui.rowTitle}>{c.label}{c.kind === 'bill' ? ' due' : ''}</Text>
                    <Text style={ui.rowSub}>
                      {c.ev ? [c.ev.who === 'both' ? 'Both' : memberName(c.ev.who), c.ev.location, c.ev.repeat !== 'none' ? repeatLabel(c.ev.repeat) : null].filter(Boolean).join(' · ') : c.sub}
                    </Text>
                  </View>
                  {c.ev?.repeat && c.ev.repeat !== 'none' ? <Icon name="repeat" size={16} color={C.faint} /> : null}
                </Pressable>
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>

      <Fab onPress={() => setDraft(blank(selected))} />

      <Sheet visible={!!draft} title={form.id ? 'Edit event' : 'New event'} onClose={() => setDraft(null)} onSave={save} saving={saving} onDelete={form.id ? remove : undefined}
        extra={form.id && form.repeat !== 'none' && form.occurrence ? <Button kind="ghost" icon="calendar-remove-outline" title={`Skip ${friendlyInline(form.occurrence)} only`} onPress={skipOne} /> : null}>
        <Field label="What" value={form.title} onChangeText={(v) => set('title', v)} placeholder="e.g. Dinner with friends" />
        <DateField label={form.repeat !== 'none' ? 'First date' : 'Date'} value={form.date} onChange={(v) => v && set('date', v)} />
        <View style={{ flexDirection: 'row', gap: S.md }}>
          <TimeField label="From" value={form.start_time} onChange={(v) => set('start_time', v)} />
          <TimeField label="To" value={form.end_time} onChange={(v) => set('end_time', v)} />
        </View>
        <Swatches label="Colour" value={form.color ?? evColor(form)} colors={EVENT_COLORS} onChange={(v) => set('color', v)} />
        <Chips label="Repeats" value={form.repeat} onChange={(v) => set('repeat', v)} options={EVENT_REPEATS.map((r) => ({ value: r, label: repeatLabel(r) }))} />
        {form.repeat !== 'none' ? (
          <DateField label="Until" value={form.repeat_until} onChange={(v) => set('repeat_until', v)} optional placeholder="Forever" />
        ) : null}
        <Chips label="Who" value={form.who} onChange={(v) => set('who', v)} options={whoOptions} />
        <Field label="Where" value={form.location} onChangeText={(v) => set('location', v)} placeholder="Optional" />
        <Field label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} placeholder="Optional" multiline />
      </Sheet>
    </View>
  );
}
