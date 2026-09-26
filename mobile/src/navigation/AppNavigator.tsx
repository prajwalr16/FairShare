import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../config/supabase';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import AcceptInviteScreen from '../screens/auth/AcceptInviteScreen';
import HomeScreen from '../screens/home/HomeScreen';
import ProfileScreen from '../screens/account/ProfileScreen';
import GroupDetailsScreen from '../screens/group/GroupDetailsScreen';
import GroupSettingsScreen from '../screens/group/GroupSettingsScreen';
import HistoryScreen from '../screens/group/HistoryScreen';
import SettlementDetailsScreen from '../screens/group/SettlementDetailsScreen';
import TripDetailsScreen from '../screens/group/TripDetailsScreen';
import TripMapScreen from '../screens/group/TripMapScreen';
import AddExpenseScreen from '../screens/expense/AddExpenseScreen';
import ExpenseDetailsScreen from '../screens/expense/ExpenseDetailsScreen';
import EditExpenseScreen from '../screens/expense/EditExpenseScreen';

type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  AcceptInvite: undefined;
  Home: undefined;
  Profile: undefined;
  GroupDetails: { groupId?: string; groupName?: string; initialTab?: string } | undefined;
  TripDetails: { groupId?: string; groupName?: string } | undefined;
  TripMap: { groupId?: string; groupName?: string; dayNumber?: number | null} | undefined;
  AddExpense: { groupId?: string; groupName?: string } | undefined;
  ExpenseDetails: { expenseId?: string; groupId?: string } | undefined;
  EditExpense: { expenseId?: string; groupId?: string } | undefined;
  GroupHistory: { groupId?: string; groupName?: string } | undefined;
  GroupSettings: { groupId?: string; groupName?: string } | undefined;
  SettlementDetails: { settlementId?: string; groupId?: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const linking = {
  prefixes: [Linking.createURL('/'), 'fairshare://'],
  config: {
    screens: {
      Welcome: '',
      Login: 'login',
      SignUp: 'signup',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',
      AcceptInvite: 'accept-invite',
      Home: 'home',
      Profile: 'profile',
      GroupDetails: 'group-details',
      TripDetails: 'trip-details',
      TripMap: 'trip-map',
      AddExpense: 'add-expense',
      ExpenseDetails: 'expense-details',
      EditExpense: 'edit-expense',
      GroupHistory: 'group-history',
      GroupSettings: 'group-settings',
      SettlementDetails: 'settlement-details',
    },
  },
};

function getUrlParams(url: string) {
  const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const hashPart = url.includes('#') ? url.split('#')[1] : '';

  const parse = (value: string) => {
    const params: Record<string, string> = {};
    if (!value) return params;

    value.split('&').forEach((pair) => {
      const [rawKey, ...rawValueParts] = pair.split('=');
      const rawValue = rawValueParts.join('=');
      if (!rawKey) return;

      try {
        params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue || '');
      } catch {
        params[rawKey] = rawValue || '';
      }
    });

    return params;
  };

  return { ...parse(queryPart), ...parse(hashPart) };
}

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingLogo}>FS</Text>
      <Text style={styles.loadingTitle}>FairShare</Text>
      <ActivityIndicator size="small" color="#0EA5A4" style={styles.loadingIndicator} />
    </View>
  );
}

export default function AppNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const pendingUrl = useRef<string | null>(null);

  const routeFromUrl = useCallback((url: string) => {
    if (!navigationRef.isReady()) {
      pendingUrl.current = url;
      return;
    }

    if (url.includes('reset-password') || url.includes('type=recovery')) {
      navigationRef.navigate('ResetPassword');
      return;
    }

    if (url.includes('accept-invite') || url.includes('type=invite')) {
      navigationRef.navigate('AcceptInvite');
    }
  }, []);

  const handleDeepLink = useCallback(
    async (url: string) => {
      const params = getUrlParams(url);

      if (params.access_token && params.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });

        if (error) {
          console.warn('[FairShare] Failed to restore deep-link session:', error.message);
        }
      } else if (params.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(params.code);

        if (error) {
          console.warn('[FairShare] Failed to exchange deep-link code:', error.message);
        }
      }

      routeFromUrl(url);
    },
    [routeFromUrl],
  );

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();

        if (initialUrl) {
          await handleDeepLink(initialUrl);
        }

        const {
          data: { session: restoredSession },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.warn('[FairShare] Failed to restore session:', error.message);
        }

        setSession(restoredSession ?? null);
      } finally {
        if (mounted) {
          setAuthReady(true);
        }
      }
    };

    void bootstrapAuth();

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      void handleDeepLink(url);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession ?? null);

      if (event === 'SIGNED_OUT' && navigationRef.isReady()) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'Welcome' }],
        });
      }
    });

    return () => {
      mounted = false;
      linkSub.remove();
      subscription.unsubscribe();
    };
  }, [handleDeepLink]);

  const handleNavigationReady = () => {
    const url = pendingUrl.current;

    if (url) {
      pendingUrl.current = null;
      routeFromUrl(url);
    }
  };

  if (!authReady) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={handleNavigationReady}
    >
      <Stack.Navigator
        initialRouteName={session ? 'Home' : 'Welcome'}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen}/>
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="AcceptInvite" component={AcceptInviteScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
        <Stack.Screen name="TripDetails" component={TripDetailsScreen} />
        <Stack.Screen name="TripMap" component={TripMapScreen} />
        <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
        <Stack.Screen name="ExpenseDetails" component={ExpenseDetailsScreen}/>
        <Stack.Screen name="EditExpense" component={EditExpenseScreen} />
        <Stack.Screen name="GroupHistory" component={HistoryScreen} />
        <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} />
        <Stack.Screen name="SettlementDetails" component={SettlementDetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  loadingLogo: {
    fontSize: 48,
    fontWeight: '900',
    color: '#0EA5A4',
  },
  loadingTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  loadingIndicator: {
    marginTop: 18,
  },
});
