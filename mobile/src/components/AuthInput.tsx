import React from 'react';
import { TextInput, StyleSheet } from 'react-native';

export default function AuthInput(props: any) {
  return <TextInput style={[s.input, props.style]} placeholderTextColor="#64748B" {...props} />;
}

const s = StyleSheet.create({
  input: {
    backgroundColor: '#06090F',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
});
