import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PasswordInput(props: any) {
  const [show, setShow] = useState(false);
  return (
    <View style={s.box}>
      <TextInput
        {...props}
        style={[s.input, props.style]}
        secureTextEntry={!show}
        placeholderTextColor="#64748B"
      />
      <Pressable onPress={() => setShow(!show)} hitSlop={10}>
        <Ionicons name={show ? 'eye-off' : 'eye'} size={20} color="#94A3B8" />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    backgroundColor: '#06090F',
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    paddingVertical: 15,
    fontSize: 15,
  },
});
