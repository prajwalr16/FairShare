import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type SplitType = 'Equal' | 'Exact' | 'Percentage' | 'Shares';

type Props = {
  value: SplitType;
  onChange: (value: SplitType) => void;
};

const types: SplitType[] = ['Equal', 'Exact', 'Percentage', 'Shares'];

export default function SplitTypeSelector({ value, onChange }: Props) {
  return (
    <View style={s.r}>
      {types.map((type) => (
        <Pressable
          key={type}
          style={[s.b, value === type && s.a]}
          onPress={() => onChange(type)}
        >
          <Text style={value === type ? s.at : s.t}>{type}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  r: { flexDirection: 'row', gap: 8 },
  b: { padding: 10, borderRadius: 20, backgroundColor: '#1E293B' },
  a: { backgroundColor: '#0EA5A4' },
  t: { color: '#CBD5E1' },
  at: { color: 'white', fontWeight: '700' },
});