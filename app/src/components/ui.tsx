import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View, type TextInputProps, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { C, R, S } from '../lib/theme';
import { friendly, iso, parse, time12 } from '../lib/dates';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
export const Icon = ({ name, size = 22, color = C.ink }: { name: IconName; size?: number; color?: string }) => (
  <MaterialCommunityIcons name={name} size={size} color={color} />
);

export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + S.md }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.h1}>{title}</Text>
        {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {right}
    </View>
  );
}

export function Check({ on, onPress, color = C.accent }: { on: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable hitSlop={10} onPress={() => { tap(); onPress(); }} style={[styles.check, on && { backgroundColor: color, borderColor: color }]}>
      {on ? <Icon name="check" size={16} color="#fff" /> : null}
    </Pressable>
  );
}

export function Fab({ onPress, icon = 'plus' }: { onPress: () => void; icon?: IconName }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={[styles.fab, { bottom: insets.bottom + 20 }]}>
      <Icon name={icon} size={28} color="#fff" />
    </Pressable>
  );
}

export function Empty({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={40} color={C.faint} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
    </View>
  );
}

export function Loading() {
  return <View style={styles.empty}><ActivityIndicator color={C.accent} /></View>;
}

export function ErrorBar({ error }: { error: string | null }) {
  if (!error) return null;
  return <View style={styles.errorBar}><Text style={styles.errorText}>{error}</Text></View>;
}

export function Pill({ label, color = C.sub, bg = C.line }: { label: string; color?: string; bg?: string }) {
  return <View style={[styles.pill, { backgroundColor: bg }]}><Text style={[styles.pillText, { color }]}>{label}</Text></View>;
}

export function Button({ title, onPress, kind = 'primary', busy, icon }: {
  title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; busy?: boolean; icon?: IconName;
}) {
  const bg = kind === 'primary' ? C.accent : 'transparent';
  const fg = kind === 'primary' ? '#fff' : kind === 'danger' ? C.danger : C.accent;
  return (
    <Pressable disabled={busy} onPress={onPress} style={({ pressed }) => [styles.btn, { backgroundColor: bg, opacity: pressed || busy ? 0.7 : 1 }, kind !== 'primary' && styles.btnGhost]}>
      {busy ? <ActivityIndicator color={fg} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={C.faint} {...props} style={[styles.input, props.multiline && { minHeight: 80, textAlignVertical: 'top' }, props.style]} />
    </View>
  );
}

export function Chips<T extends string>({ label, value, options, onChange }: {
  label?: string; value: T; options: { value: T; label: string; color?: string }[]; onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.chips}>
        {options.map((o) => {
          const on = o.value === value;
          const col = o.color ?? C.accent;
          return (
            <Pressable key={o.value} onPress={() => { tap(); onChange(o.value); }}
              style={[styles.chip, on && { backgroundColor: col, borderColor: col }]}>
              <Text style={[styles.chipText, on && { color: '#fff' }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function DateField({ label, value, onChange, optional }: {
  label: string; value: string | null; onChange: (v: string | null) => void; optional?: boolean;
}) {
  const open = () => DateTimePickerAndroid.open({
    value: value ? parse(value) : new Date(),
    mode: 'date',
    onChange: (e, d) => { if (e.type === 'set' && d) onChange(iso(d)); },
  });
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: S.sm }}>
        <Pressable onPress={open} style={[styles.input, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
          <Icon name="calendar-blank-outline" size={18} color={C.sub} />
          <Text style={{ color: value ? C.ink : C.faint, fontSize: 16 }}>{value ? friendly(value) : 'Pick a date'}</Text>
        </Pressable>
        {optional && value ? (
          <Pressable onPress={() => onChange(null)} style={[styles.input, { justifyContent: 'center' }]}>
            <Icon name="close" size={18} color={C.sub} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function TimeField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const open = () => {
    const d = new Date();
    if (value) { const [h, m] = value.split(':').map(Number); d.setHours(h, m, 0, 0); } else d.setHours(9, 0, 0, 0);
    DateTimePickerAndroid.open({
      value: d, mode: 'time', is24Hour: false,
      onChange: (e, t) => {
        if (e.type === 'set' && t) onChange(`${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`);
      },
    });
  };
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: S.sm }}>
        <Pressable onPress={open} style={[styles.input, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
          <Icon name="clock-outline" size={18} color={C.sub} />
          <Text style={{ color: value ? C.ink : C.faint, fontSize: 16 }}>{value ? time12(value) : 'Any time'}</Text>
        </Pressable>
        {value ? (
          <Pressable onPress={() => onChange(null)} style={[styles.input, { justifyContent: 'center' }]}>
            <Icon name="close" size={18} color={C.sub} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Bottom sheet used for every add and edit form. */
export function Sheet({ visible, title, onClose, onSave, onDelete, saving, children }: {
  visible: boolean; title: string; onClose: () => void; onSave?: () => void; onDelete?: () => void;
  saving?: boolean; children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + S.lg }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Text style={styles.h2}>{title}</Text>
            <Pressable hitSlop={12} onPress={onClose}><Icon name="close" color={C.sub} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: S.lg, paddingBottom: S.md }}>
            {children}
          </ScrollView>
          <View style={{ gap: S.sm }}>
            {onSave ? <Button title="Save" onPress={onSave} busy={saving} /> : null}
            {onDelete ? <Button title="Delete" kind="danger" onPress={onDelete} /> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Small helper for form state inside sheets. */
export function useForm<T extends Record<string, any>>(initial: T, deps: unknown[]) {
  const [form, setForm] = useState<T>(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setForm(initial), deps);
  const set = <K extends keyof T>(k: K, v: T[K]) => setForm((f) => ({ ...f, [k]: v }));
  return { form, set, setForm };
}

export const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: S.lg, paddingBottom: S.md, backgroundColor: C.bg },
  h1: { fontSize: 30, fontWeight: '700', color: C.ink, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700', color: C.ink },
  headerSub: { fontSize: 14, color: C.sub, marginTop: 2 },
  card: { backgroundColor: C.card, borderRadius: R.card, padding: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: S.lg, marginBottom: S.sm, paddingHorizontal: S.xs },
  section: { fontSize: 13, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.8 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.faint, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: S.xl, gap: S.sm },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.ink },
  emptyText: { fontSize: 14, color: C.sub, textAlign: 'center' },
  errorBar: { backgroundColor: C.warmSoft, padding: S.md, marginHorizontal: S.lg, borderRadius: R.input },
  errorText: { color: C.warm, fontSize: 14 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '600' },
  btn: { height: 50, borderRadius: R.input, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.lg },
  btnGhost: { borderWidth: 0 },
  btnText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: C.sub },
  input: { backgroundColor: C.bg, borderRadius: R.input, paddingHorizontal: S.md, paddingVertical: 12, fontSize: 16, color: C.ink, borderWidth: 1, borderColor: C.line },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  chipText: { fontSize: 14, fontWeight: '500', color: C.ink },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: S.lg, paddingTop: S.sm, maxHeight: '90%' },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginBottom: S.sm },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md },
  rowTitle: { fontSize: 16, color: C.ink, fontWeight: '500' },
  rowSub: { fontSize: 13, color: C.sub, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
  list: { paddingHorizontal: S.lg, paddingBottom: 120 },
});
