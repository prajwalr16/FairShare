import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
export default function ExpenseCard({title,amount,split}:{title:string,amount:number,split:string}){return <View style={s.c}><Text style={s.t}>{title}</Text><Text style={s.m}>₹{amount} • {split}</Text></View>}
const s=StyleSheet.create({c:{backgroundColor:'#1E293B',padding:16,borderRadius:16,marginBottom:12},t:{color:'white',fontWeight:'700'},m:{color:'#94A3B8',marginTop:4}});