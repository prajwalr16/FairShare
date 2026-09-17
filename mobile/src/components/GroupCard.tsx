import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
export default function GroupCard({name,type,currency}:{name:string,type:string,currency:string}){
return(<View style={s.card}><Text style={s.name}>{name}</Text><Text style={s.meta}>{type} • {currency}</Text></View>);}
const s=StyleSheet.create({card:{backgroundColor:'#1E293B',padding:18,borderRadius:16,marginBottom:14},name:{color:'white',fontSize:18,fontWeight:'700'},meta:{color:'#94A3B8',marginTop:6}});
