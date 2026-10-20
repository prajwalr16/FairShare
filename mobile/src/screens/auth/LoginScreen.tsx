import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BrandLogo from '../../components/BrandLogo';
import PasswordInput from '../../components/PasswordInput';
import StatusBanner, { StatusBannerType } from '../../components/StatusBanner';
import { supabase } from '../../config/supabase';
import { getGroups } from '../../services/groupService';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: StatusBannerType; message: string } | null>(null);

  const signIn = async () => {
    setStatus(null);
    if (!email || !password) {
      return setStatus({ type: 'error', message: 'Please enter both email and password.' });
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      return setStatus({ type: 'error', message: error.message || 'Login failed. Please check your credentials.' });
    }

    void getGroups();

    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoWrap}>
          <BrandLogo size="md" showText={false} />
        </View>

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue using FairShare.</Text>

        <StatusBanner
          type={status?.type}
          message={status?.message}
          onDismiss={() => setStatus(null)}
        />

        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor="#64748B"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (status) setStatus(null);
          }}
          editable={!loading}
        />

        <View style={styles.spacing} />

        <PasswordInput
          placeholder="Password"
          value={password}
          onChangeText={(text: string) => {
            setPassword(text);
            if (status) setStatus(null);
          }}
          editable={!loading}
        />

        <Pressable style={styles.forgotButton} onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </Pressable>

        <Pressable style={[styles.button, loading && { opacity: 0.7 }]} onPress={signIn} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#06090F" />
          ) : (
            <Text style={styles.buttonText}>SIGN IN</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('SignUp')} disabled={loading}>
          <Text style={styles.footer}>
            Don't have an account? <Text style={styles.link}>Create Account</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06090F',
    justifyContent: 'center',
    padding: 24,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#0E1524',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    fontSize: 13,
  },
  input: {
    backgroundColor: '#06090F',
    color: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  spacing: {
    height: 12,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotText: {
    color: '#00E5FF',
    fontWeight: '700',
    fontSize: 12,
  },
  button: {
    backgroundColor: '#00E5FF',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#06090F',
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1,
  },
  footer: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 13,
  },
  link: {
    color: '#00E5FF',
    fontWeight: '800',
  },
});
