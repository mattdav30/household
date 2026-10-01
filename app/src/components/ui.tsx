import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View, type TextInputProps, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { C, R, S, tint } from '../lib/theme';
import { friendly, iso, parse, time12 } from '../lib/dates';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
export const Icon = ({ name, size = 22, color = C.ink }: { name: IconName; size?: number; color?: string }) => (
  <MaterialCommunityIcons name={name} size={size} color={color} />
);

export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

/** Rounded square with a tinted background, used beside list rows and on tiles. */
export function IconBadge({ name, color = C.accent, size = 40 }: { name: IconName; color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: tint(color, 0.16), alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size * 0.52} color={color} />
    </View>
  );
}

export function Header({ title, eyebrow, subtitle, right }: { title: string; eyebrow?: string; subtitle?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + S.lg }]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.h1}>{title}</Text>
        {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style as ViewStyle]}>{children}</View>;
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
      {on ? <Icon name="check" size={16} color={C.onAccent} /> : null}
    </Pressable>
  );
}

export function Fab({ onPress, icon = 'plus' }: { onPress: () => void; icon?: IconName }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 20, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
      <Icon name={icon} size={28} color={C.onAccent} />
    </Pressable>
  );
}

export function Empty({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <IconBadge name={icon} color={C.faint} size={56} />
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

export function Pill({ label, color = C.sub, bg = C.raised }: { label: string; color?: string; bg?: string }) {
  return <View style={[styles.pill, { backgroundColor: bg }]}><Text style={[styles.pillText, { color }]}>{label}</Text></View>;
}

export function Button({ title, onPress, kind = 'primary', busy, icon }: {
  title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'soft'; busy?: boolean; icon?: IconName;
}) {
  const bg = kind === 'primary' ? C.accent : kind === 'soft' ? C.accentSoft : 'transparent';
  const fg = kind === 'primary' ? C.onAccent : kind === 'danger' ? C.danger : C.accent;
  return (
    <Pressable disabled={busy} onPress={onPress} style={({ pressed }) => [styles.btn, { backgroundColor: bg, opacity: pressed || busy ? 0.75 : 1 }]}>
      {busy ? <ActivityIndicator color={fg} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Icon name={icon} size={19} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Small rounded text button for headers. */
export function HeaderButton({ icon, label, onPress }: { icon: IconName; label?: string; onPress: () => void }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} hitSlop={8} style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }, !label && { paddingHorizontal: 10 }]}>
      <Icon name={icon} size={19} color={C.accent} />
      {label ? <Text style={{ color: C.accent, fontWeight: '700', fontSize: 14 }}>{label}</Text> : null}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={C.faint} selectionColor={C.accent} {...props}
        style={[styles.input, props.multiline && { minHeight: 84, textAlignVertical: 'top' }, props.style]} />
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
          const style = !on ? null : o.color
            ? { backgroundColor: tint(o.color, 0.2), borderColor: o.color }
            : { backgroundColor: C.accent, borderColor: C.accent };
          return (
            <Pressable key={o.value} onPress={() => { tap(); onChange(o.value); }} style={[styles.chip, style]}>
              {o.color ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: o.color }} /> : null}
              <Text style={[styles.chipText, on && { color: o.color ? C.ink : C.onAccent, fontWeight: '700' }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Two to four options in a pill track, for switching views. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.segTrack}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => { tap(); onChange(o.value); }} style={[styles.segItem, on && styles.segOn]}>
            <Text style={[styles.segText, on && { color: C.ink }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Row of colour dots. */
export function Swatches({ label, value, colors, onChange }: { label: string; value: string | null; colors: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {colors.map((c) => {
          const on = c.value === value;
          return (
            <Pressable key={c.value} accessibilityLabel={c.label} onPress={() => { tap(); onChange(c.value); }}
              style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: on ? C.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.value, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <Icon name="check" size={16} color="#0B0F0E" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function DateField({ label, value, onChange, optional, placeholder = 'Pick a date' }: {
  label: string; value: string | null; onChange: (v: string | null) => void; optional?: boolean; placeholder?: string;
}) {
  const open = () => DateTimePickerAndroid.open({
    value: value ? parse(value) : new Date(),
    mode: 'date',
    onChange: (e, d) => { if (e.type === 'set' && d) onChange(iso(d)); },
  });
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: S.sm }}>
        <Pressable onPress={open} style={[styles.input, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
          <Icon name="calendar-blank-outline" size={18} color={C.sub} />
          <Text style={{ color: value ? C.ink : C.faint, fontSize: 16 }}>{value ? friendly(value) : placeholder}</Text>
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
          <Text style={{ color: value ? C.ink : C.faint, fontSize: 16 }}>{value ? time12(value) : 'All day'}</Text>
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
export function Sheet({ visible, title, onClose, onSave, onDelete, saving, children, saveLabel = 'Save', extra }: {
  visible: boolean; title: string; onClose: () => void; onSave?: () => void; onDelete?: () => void;
  saving?: boolean; children: ReactNode; saveLabel?: string; extra?: ReactNode;
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
            <Pressable hitSlop={12} onPress={onClose} style={styles.closeBtn}><Icon name="close" size={20} color={C.sub} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: S.lg, paddingBottom: S.md }}>
            {children}
          </ScrollView>
          <View style={{ gap: S.xs, paddingTop: S.sm }}>
            {onSave ? <Button title={saveLabel} onPress={onSave} busy={saving} /> : null}
            {extra}
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
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: S.lg + 4, paddingBottom: S.md, backgroundColor: C.bg },
  eyebrow: { fontSize: 13, fontWeight: '700', color: C.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  h1: { fontSize: 32, fontWeight: '800', color: C.ink, letterSpacing: -0.8 },
  h2: { fontSize: 21, fontWeight: '800', color: C.ink, letterSpacing: -0.3 },
  headerSub: { fontSize: 15, color: C.sub, marginTop: 4 },
  card: { backgroundColor: C.card, borderRadius: R.card, padding: S.lg, borderWidth: 1, borderColor: C.line },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: S.xl, marginBottom: S.sm + 2, paddingHorizontal: S.xs },
  section: { fontSize: 17, fontWeight: '800', color: C.ink, letterSpacing: -0.2 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.faint, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 20, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: S.xl, gap: S.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.ink, marginTop: S.sm },
  emptyText: { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 20 },
  errorBar: { backgroundColor: C.warmSoft, padding: S.md, marginHorizontal: S.lg, borderRadius: R.input },
  errorText: { color: C.warm, fontSize: 14 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  btn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.lg },
  btnText: { fontSize: 16, fontWeight: '700' },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 38, borderRadius: R.pill, backgroundColor: C.accentSoft },
  label: { fontSize: 13, fontWeight: '700', color: C.sub },
  input: { backgroundColor: C.raised, borderRadius: R.input, paddingHorizontal: S.md + 2, paddingVertical: 13, fontSize: 16, color: C.ink, borderWidth: 1, borderColor: C.line },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.raised },
  chipText: { fontSize: 14, fontWeight: '500', color: C.ink },
  segTrack: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.line },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  segOn: { backgroundColor: C.raised },
  segText: { fontSize: 14, fontWeight: '700', color: C.sub },
  backdrop: { flex: 1, backgroundColor: C.backdrop },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: S.lg + 4, paddingTop: S.sm, maxHeight: '92%', borderWidth: 1, borderColor: C.line, borderBottomWidth: 0 },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginBottom: S.md },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md + 2 },
  rowTitle: { fontSize: 16, color: C.ink, fontWeight: '600' },
  rowSub: { fontSize: 13, color: C.sub, marginTop: 3 },
  sep: { height: 1, backgroundColor: C.line },
  list: { paddingHorizontal: S.lg, paddingBottom: 120 },
});
