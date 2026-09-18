import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <View style={styles.main}>
        <Text style={styles.logo}>FS</Text>

        <Text style={styles.title}>
          FairShare
        </Text>

        <Text style={styles.tagline}>
          Split expenses. Share memories.
        </Text>
      </View>

      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.buttonText}>
          Get Started
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
  },

  main: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  logo: {
    fontSize: 60,
    fontWeight: '800',
    color: '#0EA5A4',
  },

  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },

  tagline: {
    color: '#94A3B8',
    fontSize: 15,
    marginTop: 12,
  },

  button: {
    backgroundColor: '#0EA5A4',
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 8,
  },

  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
});