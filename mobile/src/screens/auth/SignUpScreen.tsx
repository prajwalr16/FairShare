import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import PasswordInput from '../../components/PasswordInput';
import { signUp } from '../../services/authService';

type Status = {
  type: 'error' | 'success';
  message: string;
} | null;

export default function SignUpScreen() {
  const navigation = useNavigation<any>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const createAccount = async () => {
    setStatus(null);

    if (!name.trim()) {
      return setStatus({ type: 'error', message: 'Please enter your full name.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return setStatus({ type: 'error', message: 'Please enter a valid email address.' });
    }

    if (password.length < 8) {
      return setStatus({
        type: 'error',
        message: 'Password must be at least 8 characters.',
      });
    }

    if (password !== confirmPassword) {
      return setStatus({
        type: 'error',
        message: 'Enter the same password in both fields.',
      });
    }

    setLoading(true);

    try {
      const { data, error } = await signUp(normalizedEmail, password, name);

      if (error) {
        setStatus({
          type: 'error',
          message: error.message || 'Unable to create your account.',
        });
        return;
      }

      if (data.session) {
        setStatus({
          type: 'success',
          message: 'Account created successfully. Opening FairShare…',
        });

        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        }, 250);
        return;
      }

      setStatus({
        type: 'success',
        message:
          'Account created. Check your email and verify your address before signing in.',
      });
    } catch (error: any) {
      setStatus({
        type: 'error',
        message: error?.message || 'Unable to create your account.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Create Account</Text>

          <Text style={styles.subtitle}>
            Set up your FairShare profile.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#64748B"
            value={name}
            onChangeText={setName}
            editable={!loading}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#64748B"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />

          <PasswordInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
          />

          <PasswordInput
            placeholder="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {status ? (
            <View
              style={[
                styles.statusBox,
                status.type === 'error'
                  ? styles.statusError
                  : styles.statusSuccess,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  status.type === 'error'
                    ? styles.statusErrorText
                    : styles.statusSuccessText,
                ]}
              >
                {status.message}
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.button, loading && styles.disabled]}
            onPress={createAccount}
            disabled={loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.loadingText}>Creating account…</Text>
              </>
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.footer}>
              Already have an account?{' '}
              <Text style={styles.link}>Sign In</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },

  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  card: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },

  subtitle: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 9,
    marginBottom: 24,
  },

  input: {
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    marginBottom: 16,
  },

  statusBox: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 2,
    marginBottom: 12,
  },

  statusError: {
    backgroundColor: '#3B1720',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },

  statusSuccess: {
    backgroundColor: '#12332F',
    borderWidth: 1,
    borderColor: '#115E59',
  },

  statusText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },

  statusErrorText: {
    color: '#FCA5A5',
  },

  statusSuccessText: {
    color: '#99F6E4',
  },

  button: {
    backgroundColor: '#0EA5A4',
    minHeight: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    flexDirection: 'row',
    gap: 9,
  },

  disabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  loadingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  footer: {
    color: '#CBD5E1',
    textAlign: 'center',
    marginTop: 22,
  },

  link: {
    color: '#0EA5A4',
    fontWeight: '700',
  },
});
