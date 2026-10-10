import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
export const color = { black: '#000000', surface: '#111111', raised: '#1d1d1f', line: '#29292b', text: '#f5f5f7', muted: '#a1a1a6', blue: '#2997ff', error: '#ff8c82' };
export function Icon({ name, size = 20, color: tint = color.text }: { name: React.ComponentProps<typeof Feather>['name']; size?: number; color?: string }) { return <Feather name={name} size={size} color={tint} />; }
export function Button({ title, onPress, secondary, disabled, danger }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, disabled && { opacity: .4 }, pressed && { transform: [{ scale: .98 }] }]}><Text style={[s.buttonText, secondary && { color: color.blue }, danger && { color: color.error }]}>{title}</Text></Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 8 }}><Text style={s.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor="#77777d" selectionColor={color.blue} style={[s.input, props.multiline && { minHeight: 100, textAlignVertical: 'top' }, props.style]} /></View>;
}
export function State({ on }: { on: boolean }) {
  return <View style={s.row} accessibilityLabel={on ? 'Status: On' : 'Status: Off'}><View style={[s.indicator, on ? { backgroundColor: color.text } : { borderWidth: 1.5, borderColor: color.muted }]} /><Text style={{ color: on ? color.text : color.muted, fontSize: 14 }}>{on ? 'On' : 'Off'}</Text></View>;
}
export const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: color.black },
  page: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 48 },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.line, paddingHorizontal: 24, gap: 16 },
  brand: { fontSize: 20, color: color.text, fontWeight: '600', letterSpacing: -.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 34, fontWeight: '600', letterSpacing: -.7, color: color.text, lineHeight: 41 },
  heading: { fontSize: 21, fontWeight: '600', letterSpacing: -.3, color: color.text, lineHeight: 28 },
  body: { fontSize: 17, lineHeight: 25, color: color.text },
  muted: { fontSize: 15, lineHeight: 23, color: color.muted },
  caption: { fontSize: 12, lineHeight: 18, color: color.muted },
  label: { fontSize: 14, fontWeight: '600', color: color.text },
  input: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, borderRadius: 11, padding: 14, minHeight: 50, color: color.text, fontSize: 17 },
  button: { backgroundColor: '#0071e3', borderRadius: 999, minHeight: 48, paddingVertical: 13, paddingHorizontal: 22, justifyContent: 'center', alignItems: 'center' },
  secondary: { backgroundColor: color.raised },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: color.blue, fontSize: 15, lineHeight: 22 },
  linkButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  error: { color: color.error, fontSize: 14, lineHeight: 21 },
  panel: { backgroundColor: color.surface, padding: 24, borderRadius: 18, gap: 16 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: color.line },
  indicator: { width: 7, height: 7, borderRadius: 7 },
  iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  empty: { paddingVertical: 48, gap: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.8)', padding: 20, alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 480, maxHeight: '92%', borderRadius: 18, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
  pills: { flexDirection: 'row', backgroundColor: color.raised, borderRadius: 9, padding: 3, gap: 3 },
  pill: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 7, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  selectedPill: { backgroundColor: '#38383a' },
});
