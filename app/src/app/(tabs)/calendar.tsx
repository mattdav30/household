import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { api, changes, type Bill, type CalEvent, type Chore } from '../../lib/api';
import { useList } from '../../lib/useList';
import { useSession } from '../../lib/session';
import { Card, Chips, DateField, ErrorBar, Fab, Field, Header, Icon, SectionTitle, Sheet, TimeField, styles as ui, useForm } from '../../components/ui';
import { friendly, iso, money, monthLabel, parse, time12, today } from '../../lib/dates';
import { C, S } from '../../lib/theme';

type Draft = { id?: string; title: string; date: string; start_time: string | null; end_time: string | null; who: string; location: string; notes: string };

function monthGrid(month: string) {
  const first = parse(month.slice(0, 7) + '-01');
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return iso(d); });
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
  const { data: events, error, reload } = useList<CalEvent>(`/api/events?from=${grid[0]}&to=${grid[41]}`, 'events');
  const { data: bills } = useList<Bill>('/api/bills', 'bills');
  const { data: chores } = useList<Chore>('/api/chores', 'chores');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const { form, set } = useForm<Draft>(draft ?? { title: '', date: selected, start_time: null, end_time: null, who: 'both', location: '', notes: '' }, [draft]);

  const dayEvents = events.filter((e) => e.date === selected);
  const dayBills = bills.filter((b) => b.due_date === selected);
  const dayChores = chores.filter((c) => c.due_date === selected && !c.done_at);
  const whoOptions = [{ value: 'both', label: 'Both of us' }, ...(profile?.members ?? []).map((m) => ({ value: m.id, label: m.name, color: m.color }))];

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const { id, ...body } = form;
    try {
      if (id) await api(`/api/events/${id}`, { method: 'PATCH', body });
      else await api('/api/events', { method: 'POST', body });
      setSelected(form.date); setDraft(null); reload(); changes.emit('events');
    } finally { setSaving(false); }
  }
  async function remove() {
    if (!form.id) return;
    await api(`/api/events/${form.id}`, { method: 'DELETE' }).catch(() => undefined);
    setDraft(null); reload(); changes.emit('events');
  }

  return (
    <View style={{ flex: 1 }}>
      <Header title="Calendar" subtitle={monthLabel(month)} right={
        <View style={{ flexDirection: 'row', gap: S.lg }}>
          <Pressable hitSlop={10} onPress={() => setMonth(shiftMonth(month, -1))}><Icon name="chevron-left" color={C.accent} size={28} /></Pressable>
          <Pressable hitSlop={10} onPress={() => { setMonth(today().slice(0, 7) + '-01'); setSelected(today()); }}><Icon name="calendar-today" color={C.accent} size={24} /></Pressable>
          <Pressable hitSlop={10} onPress={() => setMonth(shiftMonth(month, 1))}><Icon name="chevron-right" color={C.accent} size={28} /></Pressable>
        </View>
      } />
      <ErrorBar error={error} />
      <ScrollView contentContainerStyle={ui.list}>
        <Card style={{ padding: S.sm }}>
          <View style={{ flexDirection: 'row' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: C.faint, paddingVertical: 6 }}>{d}</Text>
            ))}
          </View>
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <View key={row} style={{ flexDirection: 'row' }}>
              {grid.slice(row * 7, row * 7 + 7).map((d) => {
                const inMonth = d.slice(0, 7) === month.slice(0, 7);
                const isSel = d === selected;
                const isToday = d === today();
                const ev = events.filter((e) => e.date === d);
                const hasBill = bills.some((b) => b.due_date === d);
                return (
                  <Pressable key={d} onPress={() => setSelected(d)} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: isSel ? C.accent : isToday ? C.accentSoft : 'transparent' }}>
                      <Text style={{ fontSize: 15, fontWeight: isToday || isSel ? '700' : '500', color: isSel ? '#fff' : inMonth ? C.ink : C.faint }}>{parse(d).getDate()}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 3, height: 6, marginTop: 2 }}>
                      {ev.slice(0, 3).map((e) => <View key={e.id} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: e.who === 'both' ? C.accent : memberColor(e.who) }} />)}
                      {hasBill ? <View style={{ width: 5, height: 5, borderRadius: 1, backgroundColor: C.warm }} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Card>

        <SectionTitle>{friendly(selected)}</SectionTitle>
        <Card style={{ paddingVertical: S.xs }}>
          {!dayEvents.length && !dayBills.length && !dayChores.length ? (
            <Pressable onPress={() => setDraft({ title: '', date: selected, start_time: null, end_time: null, who: 'both', location: '', notes: '' })} style={ui.row}>
              <Icon name="plus" size={18} color={C.faint} /><Text style={{ color: C.faint, fontSize: 15 }}>Nothing on. Tap to add.</Text>
            </Pressable>
          ) : null}
          {dayEvents.map((e, i) => (
            <View key={e.id}>
              {i ? <View style={ui.sep} /> : null}
              <Pressable style={ui.row} onPress={() => setDraft({ id: e.id, title: e.title, date: e.date, start_time: e.start_time, end_time: e.end_time, who: e.who, location: e.location ?? '', notes: e.notes ?? '' })}>
                <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: e.who === 'both' ? C.accent : memberColor(e.who) }} />
                <View style={{ width: 64 }}>
                  <Text style={{ fontWeight: '600', color: C.ink }}>{e.start_time ? time12(e.start_time) : 'All day'}</Text>
                  {e.end_time ? <Text style={ui.rowSub}>{time12(e.end_time)}</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ui.rowTitle}>{e.title}</Text>
                  <Text style={ui.rowSub}>{[e.who === 'both' ? 'Both' : memberName(e.who), e.location].filter(Boolean).join(' · ')}</Text>
                </View>
              </Pressable>
            </View>
          ))}
          {dayBills.map((b) => (
            <View key={b.id}>
              <View style={ui.sep} />
              <View style={ui.row}>
                <Icon name="receipt-text-outline" color={C.warm} size={20} />
                <Text style={[ui.rowTitle, { flex: 1 }]}>{b.name} due</Text>
                <Text style={ui.rowTitle}>{money(b.amount_cents)}</Text>
              </View>
            </View>
          ))}
          {dayChores.map((c) => (
            <View key={c.id}>
              <View style={ui.sep} />
              <View style={ui.row}>
                <Icon name="broom" color={C.sub} size={20} />
                <Text style={[ui.rowTitle, { flex: 1 }]}>{c.title}</Text>
                <Text style={ui.rowSub}>{memberName(c.assignee_id)}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>

      <Fab onPress={() => setDraft({ title: '', date: selected, start_time: null, end_time: null, who: 'both', location: '', notes: '' })} />

      <Sheet visible={!!draft} title={form.id ? 'Edit event' : 'New event'} onClose={() => setDraft(null)} onSave={save} saving={saving} onDelete={form.id ? remove : undefined}>
        <Field label="What" value={form.title} onChangeText={(v) => set('title', v)} placeholder="e.g. Dinner with friends" />
        <DateField label="Date" value={form.date} onChange={(v) => v && set('date', v)} />
        <View style={{ flexDirection: 'row', gap: S.md }}>
          <TimeField label="Starts" value={form.start_time} onChange={(v) => set('start_time', v)} />
          <TimeField label="Ends" value={form.end_time} onChange={(v) => set('end_time', v)} />
        </View>
        <Chips label="Who" value={form.who} onChange={(v) => set('who', v)} options={whoOptions} />
        <Field label="Where" value={form.location} onChangeText={(v) => set('location', v)} placeholder="Optional" />
        <Field label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} placeholder="Optional" multiline />
      </Sheet>
    </View>
  );
}

