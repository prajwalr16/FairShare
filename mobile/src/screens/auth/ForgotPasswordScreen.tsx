import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../../config/supabase';
import StatusBanner, { StatusBannerType } from '../../components/StatusBanner';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: StatusBannerType; message: string } | null>(null);

  const sendReset = async () => {
    setStatus(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return setStatus({ type: 'error', message: 'Please enter a valid email address.' });
    }

    setLoading(true);

    const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}/reset-password`
      : Linking.createURL('reset-password');

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      return setStatus({
        type: 'error',
        message: error.message || 'Unable to send reset email.',
      });
    }

    setStatus({
      type: 'success',
      message: 'Password reset link sent! Check your email inbox.',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          Enter your email to receive a reset link.
        </Text>

        <StatusBanner
          type={status?.type}
          message={status?.message}
          onDismiss={() => setStatus(null)}
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (status) setStatus(null);
          }}
          editable={!loading}
        />

        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={sendReset}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Send Reset Link</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.goBack()} disabled={loading}>
          <Text style={styles.link}>Back to Login</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 60,
    justifyContent: 'center',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    marginBottom: 24,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    color: '#F8FAFC',
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    height: 52,
    backgroundColor: '#0EA5A4',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
  link: {
    color: '#0EA5A4',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});
