import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import PasswordInput from '../../components/PasswordInput';
import { signUp } from '../../services/authService';

export default function SignUpScreen() {
  const navigation = useNavigation<any>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const createAccount = async () => {
    if (!name.trim()) {
      return Alert.alert(
        'Missing name',
        'Please enter your full name.'
      );
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return Alert.alert(
        'Invalid email',
        'Please enter a valid email address.'
      );
    }

    if (password.length < 8) {
      return Alert.alert(
        'Weak password',
        'Password must be at least 8 characters.'
      );
    }

    if (password !== confirmPassword) {
      return Alert.alert(
        'Passwords do not match',
        'Enter the same password in both fields.'
      );
    }

    setLoading(true);

    const { error } = await signUp(
      email,
      password,
      name
    );

    setLoading(false);

    if (error) {
      return Alert.alert(
        'Sign Up Failed',
        error.message
      );
    }

    Alert.alert(
      'Account created',
      'Check your email for verification.',
      [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Login'),
        },
      ]
    );
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>
            Create Account
          </Text>

          <Text style={styles.subtitle}>
            Set up your FairShare profile.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#64748B"
            value={name}
            onChangeText={setName}
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

          <Pressable
            style={[
              styles.button,
              loading && styles.disabled,
            ]}
            onPress={createAccount}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                Create Account
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.footer}>
              Already have an account?{' '}
              <Text style={styles.link}>
                Sign In
              </Text>
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

  button: {
    backgroundColor: '#0EA5A4',
    minHeight: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  disabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
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
