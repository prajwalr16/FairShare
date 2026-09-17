import React from 'react';
import {TextInput,StyleSheet} from 'react-native';
export default function AuthInput(props:any){return <TextInput style={s.i} placeholderTextColor="#94A3B8" {...props}/>;}
const s=StyleSheet.create({i:{backgroundColor:'#1E293B',color:'#fff',padding:16,borderRadius:14,marginBottom:16}});
