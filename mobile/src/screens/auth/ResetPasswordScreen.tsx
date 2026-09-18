import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import PasswordInput from '../../components/PasswordInput';
import { supabase } from '../../config/supabase';

export default function ResetPasswordScreen() {
  const navigation = useNavigation<any>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const updatePassword = async () => {
    if (!password || !confirmPassword) {
      return Alert.alert('Missing fields', 'Please enter both passwords.');
    }

    if (password !== confirmPassword) {
      return Alert.alert('Passwords do not match');
    }

    if (password.length < 6) {
      return Alert.alert(
        'Weak password',
        'Password must be at least 6 characters.'
      );
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      return Alert.alert('Error', error.message);
    }

    Alert.alert(
      'Success',
      'Password updated successfully.',
      [
        {
          text: 'Continue',
          onPress: () =>
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            }),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Reset Password</Text>

        <Text style={styles.subtitle}>
          Create a new password for your FairShare account.
        </Text>

        <PasswordInput
          placeholder="New Password"
          value={password}
          onChangeText={setPassword}
        />

        <View style={styles.spacing} />

        <PasswordInput
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <Pressable style={styles.button} onPress={updatePassword}>
          <Text style={styles.buttonText}>Update Password</Text>
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
    padding: 24,
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
    marginTop: 10,
    marginBottom: 24,
    lineHeight: 22,
  },

  spacing: {
    height: 14,
  },

  button: {
    backgroundColor: '#0EA5A4',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 24,
  },

  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
});