import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PasswordInput from '../../components/PasswordInput';
import { supabase } from '../../config/supabase';
import { getGroups } from '../../services/groupService';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    if (!email || !password) {
      return Alert.alert('Missing fields', 'Please enter email and password.');
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      return Alert.alert('Login Failed', error.message);
    }

    // Start the groups request before the Home transition. Home reuses the
    // same in-flight promise instead of creating a second request.
    void getGroups();

    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue using FairShare.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#94A3B8"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <View style={styles.spacing} />

        <PasswordInput placeholder="Password" value={password} onChangeText={setPassword} />

        <Pressable style={styles.forgotButton} onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </Pressable>

        <Pressable style={[styles.button, loading && { opacity: 0.7 }]} onPress={signIn} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Signing In...' : 'Sign In'}</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.footer}>
            Don't have an account? <Text style={styles.link}>Create Account</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#1E293B', borderRadius: 24, padding: 24 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#94A3B8', textAlign: 'center', marginTop: 10, marginBottom: 24, lineHeight: 22 },
  input: { backgroundColor: '#0F172A', color: '#FFFFFF', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16 },
  spacing: { height: 14 },
  forgotButton: { alignSelf: 'flex-end', marginTop: 12 },
  forgotText: { color: '#0EA5A4', fontWeight: '600' },
  button: { backgroundColor: '#0EA5A4', paddingVertical: 16, borderRadius: 14, marginTop: 24 },
  buttonText: { color: '#FFFFFF', textAlign: 'center', fontWeight: '700', fontSize: 16 },
  footer: { color: '#CBD5E1', textAlign: 'center', marginTop: 24 },
  link: { color: '#0EA5A4', fontWeight: '700' },
});
