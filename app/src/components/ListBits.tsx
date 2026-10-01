import { Pressable, Text, TextInput, View } from 'react-native';
import { Icon } from './ui';
import { C, R, S } from '../lib/theme';

/** Grouped rounded list rows, shared with the At home list. */
export function groupRowStyle(index: number, count: number) {
  return {
    backgroundColor: C.card, paddingHorizontal: S.lg, borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.line,
    borderTopWidth: index === 0 ? 1 : 0, borderBottomWidth: index === count - 1 ? 1 : 0,
    borderTopLeftRadius: index === 0 ? R.card : 0, borderTopRightRadius: index === 0 ? R.card : 0,
    borderBottomLeftRadius: index === count - 1 ? R.card : 0, borderBottomRightRadius: index === count - 1 ? R.card : 0,
  };
}

export function AddBar({ value, onChange, onSubmit, placeholder }: { value: string; onChange: (t: string) => void; onSubmit: () => void; placeholder: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingLeft: S.md }}>
      <Icon name="plus" color={C.accent} />
      <TextInput value={value} onChangeText={onChange} onSubmitEditing={onSubmit} submitBehavior="submit"
        placeholder={placeholder} placeholderTextColor={C.faint} returnKeyType="done" selectionColor={C.accent}
        style={{ flex: 1, fontSize: 16, paddingVertical: 14, paddingHorizontal: S.sm, color: C.ink }} />
      {value ? <Pressable onPress={onSubmit} style={{ padding: S.md }}><Text style={{ color: C.accent, fontWeight: '800' }}>Add</Text></Pressable> : null}
    </View>
  );
}

