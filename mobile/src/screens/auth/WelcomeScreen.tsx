import React from 'react';
import {SafeAreaView,View,Text,Pressable,StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
export default function WelcomeScreen(){const n=useNavigation<any>();return <SafeAreaView style={s.c}><View style={s.m}><Text style={s.l}>FS</Text><Text style={s.t}>FairShare</Text><Text style={s.g}>Split expenses. Share memories.</Text></View><Pressable style={s.b} onPress={()=>n.navigate('Login')}><Text style={s.bt}>Get Started</Text></Pressable></SafeAreaView>}
const s=StyleSheet.create({c:{flex:1,backgroundColor:'#0F172A',padding:24,justifyContent:'space-between'},m:{flex:1,justifyContent:'center',alignItems:'center'},l:{fontSize:60,fontWeight:'800',color:'#0EA5A4'},t:{fontSize:34,fontWeight:'700',color:'#fff'},g:{color:'#94A3B8',marginTop:12},b:{backgroundColor:'#0EA5A4',padding:16,borderRadius:14,marginBottom:20},bt:{color:'#fff',textAlign:'center',fontWeight:'700'}});
