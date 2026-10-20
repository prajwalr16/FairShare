import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PasswordInput from '../../components/PasswordInput';
import StatusBanner, { StatusBannerType } from '../../components/StatusBanner';
import { supabase } from '../../config/supabase';

export default function ResetPasswordScreen() {
  const navigation = useNavigation<any>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: StatusBannerType; message: string } | null>(null);

  const updatePassword = async () => {
    setStatus(null);

    if (!password || !confirmPassword) {
      return setStatus({ type: 'error', message: 'Please enter both password fields.' });
    }

    if (password !== confirmPassword) {
      return setStatus({ type: 'error', message: 'Passwords do not match.' });
    }

    if (password.length < 6) {
      return setStatus({ type: 'error', message: 'Password must be at least 6 characters.' });
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      return setStatus({ type: 'error', message: error.message || 'Unable to update password.' });
    }

    setStatus({
      type: 'success',
      message: 'Password updated successfully! Redirecting to login...',
    });

    setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Reset Password</Text>

        <Text style={styles.subtitle}>
          Create a new password for your FairShare account.
        </Text>

        <StatusBanner
          type={status?.type}
          message={status?.message}
          onDismiss={() => setStatus(null)}
        />

        <PasswordInput
          placeholder="New Password"
          value={password}
          onChangeText={(text: string) => {
            setPassword(text);
            if (status) setStatus(null);
          }}
          editable={!loading}
        />

        <View style={styles.spacing} />

        <PasswordInput
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={(text: string) => {
            setConfirmPassword(text);
            if (status) setStatus(null);
          }}
          editable={!loading}
        />

        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={updatePassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Update Password</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Login')} disabled={loading} style={styles.linkWrap}>
          <Text style={styles.link}>Back to Login</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E293B',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 20,
  },
  spacing: {
    height: 16,
  },
  button: {
    height: 50,
    backgroundColor: '#0EA5A4',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
  linkWrap: {
    marginTop: 20,
    alignItems: 'center',
  },
  link: {
    color: '#0EA5A4',
    fontSize: 14,
    fontWeight: '500',
  },
});
