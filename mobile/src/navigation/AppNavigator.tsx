import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';

import { supabase } from '../config/supabase';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import HomeScreen from '../screens/home/HomeScreen';

const Stack = createNativeStackNavigator();
export const navigationRef = createNavigationContainerRef();

const linking = {
  prefixes: [
    Linking.createURL('/'),
    'fairshare://',
    'exp://192.168.29.185:8081'
  ],
  config: {
    screens: {
      Welcome: '',
      Login: 'login',
      SignUp: 'signup',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',
      Home: 'home',
    },
  },
};

export default function AppNavigator() {

  useEffect(() => {

    const checkInitialUrl = async () => {
      const url = await Linking.getInitialURL();

      if (
        url &&
        (url.includes('reset-password') || url.includes('type=recovery'))
      ) {
        if (navigationRef.isReady()) {
          navigationRef.navigate('ResetPassword');
        }
      }
    };

    checkInitialUrl();

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      if (
        url.includes('reset-password') ||
        url.includes('type=recovery')
      ) {
        if (navigationRef.isReady()) {
          navigationRef.navigate('ResetPassword');
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {

      if (
        event === 'PASSWORD_RECOVERY' &&
        navigationRef.isReady()
      ) {
        navigationRef.navigate('ResetPassword');
      }

    });

    return () => {
      linkSub.remove();
      subscription.unsubscribe();
    };

  }, []);

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}