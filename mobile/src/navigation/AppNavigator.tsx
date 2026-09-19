import React, {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';

import { supabase } from '../config/supabase';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import AcceptInviteScreen from '../screens/auth/AcceptInviteScreen';
import HomeScreen from '../screens/home/HomeScreen';
import GroupDetailsScreen from '../screens/group/GroupDetailsScreen';
import AddExpenseScreen from '../screens/expense/AddExpenseScreen';
import ExpenseDetailsScreen from '../screens/expense/ExpenseDetailsScreen';
import EditExpenseScreen from '../screens/expense/EditExpenseScreen';
import HistoryScreen from '../screens/group/HistoryScreen';
import GroupSettingsScreen from '../screens/group/GroupSettingsScreen';

const Stack = createNativeStackNavigator();
export const navigationRef = createNavigationContainerRef();

const linking = {
  prefixes: [
    Linking.createURL('/'),
    'fairshare://',
    'exp://192.168.29.185:8081',
  ],
  config: {
    screens: {
      Welcome: '',
      Login: 'login',
      SignUp: 'signup',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',
      AcceptInvite: 'accept-invite',
      Home: 'home',
      GroupDetails: 'group-details',
      AddExpense: 'add-expense',
      ExpenseDetails: 'expense-details',
      EditExpense: 'edit-expense',
      GroupHistory: 'group-history',
      GroupSettings: 'group-settings',
    },
  },
};

function getUrlParams(url: string) {
  const queryPart = url.includes('?')
    ? url.split('?')[1].split('#')[0]
    : '';

  const hashPart = url.includes('#')
    ? url.split('#')[1]
    : '';

  const parse = (value: string) => {
    const params: Record<string, string> = {};

    if (!value) return params;

    value.split('&').forEach((pair) => {
      const [rawKey, ...rawValueParts] = pair.split('=');
      const rawValue = rawValueParts.join('=');

      if (!rawKey) return;

      try {
        params[decodeURIComponent(rawKey)] =
          decodeURIComponent(rawValue || '');
      } catch {
        params[rawKey] = rawValue || '';
      }
    });

    return params;
  };

  return {
    ...parse(queryPart),
    ...parse(hashPart),
  };
}

export default function AppNavigator() {
  const pendingUrl = useRef<string | null>(null);

  const routeFromUrl = useCallback((url: string) => {
    if (!navigationRef.isReady()) {
      pendingUrl.current = url;
      return;
    }

    if (
      url.includes('reset-password') ||
      url.includes('type=recovery')
    ) {
      navigationRef.navigate('ResetPassword');
      return;
    }

    if (
      url.includes('accept-invite') ||
      url.includes('type=invite')
    ) {
      navigationRef.navigate('AcceptInvite');
    }
  }, []);

  const handleDeepLink = useCallback(
    async (url: string) => {
      const params = getUrlParams(url);

      if (
        params.access_token &&
        params.refresh_token
      ) {
        await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
      } else if (params.code) {
        await supabase.auth.exchangeCodeForSession(
          params.code
        );
      }

      routeFromUrl(url);
    },
    [routeFromUrl]
  );

  useEffect(() => {
    const checkInitialUrl = async () => {
      const url = await Linking.getInitialURL();

      if (url) {
        await handleDeepLink(url);
      }
    };

    checkInitialUrl();

    const linkSub = Linking.addEventListener(
      'url',
      ({ url }) => {
        handleDeepLink(url);
      }
    );

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
  }, [handleDeepLink]);

  const handleNavigationReady = () => {
    const url = pendingUrl.current;

    if (url) {
      pendingUrl.current = null;
      routeFromUrl(url);
    }
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={handleNavigationReady}
    >
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="AcceptInvite" component={AcceptInviteScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
        <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
        <Stack.Screen name="ExpenseDetails" component={ExpenseDetailsScreen} />
        <Stack.Screen name="EditExpense" component={EditExpenseScreen} />
        <Stack.Screen name="GroupHistory" component={HistoryScreen} />
        <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}