import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import HomeScreen from '../screens/home/HomeScreen';
const Stack=createNativeStackNavigator();
const linking={prefixes:[Linking.createURL('/'),'fairshare://'],config:{screens:{Welcome:'',Login:'login',SignUp:'signup',ForgotPassword:'forgot-password',ResetPassword:'reset-password',Home:'home'}}};
export default function AppNavigator(){return(<NavigationContainer linking={linking}><Stack.Navigator screenOptions={{headerShown:false}}><Stack.Screen name='Welcome' component={WelcomeScreen}/><Stack.Screen name='Login' component={LoginScreen}/><Stack.Screen name='SignUp' component={SignUpScreen}/><Stack.Screen name='ForgotPassword' component={ForgotPasswordScreen}/><Stack.Screen name='ResetPassword' component={ResetPasswordScreen}/><Stack.Screen name='Home' component={HomeScreen}/></Stack.Navigator></NavigationContainer>);}
