import React from 'react';
import {View,Pressable,Text,StyleSheet} from 'react-native';
const types=['Equal','Exact','Percent'];
export default function SplitTypeSelector({value,onChange}){return <View style={s.r}>{types.map(t=><Pressable key={t} style={[s.b,value===t&&s.a]} onPress={()=>onChange(t)}><Text style={value===t?s.at:s.t}>{t}</Text></Pressable>)}</View>}
const s=StyleSheet.create({r:{flexDirection:'row',gap:8},b:{padding:10,borderRadius:20,backgroundColor:'#1E293B'},a:{backgroundColor:'#0EA5A4'},t:{color:'#CBD5E1'},at:{color:'white',fontWeight:'700'}});