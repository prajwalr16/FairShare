import React from 'react';
import {SafeAreaView,View,Text,Pressable,StyleSheet} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
export default function GroupDetailsScreen({navigation}:any){
 return(
  <SafeAreaView style={s.c}>
   <Text style={s.h}>Group Details</Text>
   <View style={s.card}>
    <Text style={s.t}>Expenses</Text>
    <Text style={s.s}>No expenses yet.</Text>
   </View>
   <Pressable style={s.fab} onPress={()=>navigation.navigate('AddExpense')}>
    <Ionicons name='add' size={30} color='white'/>
   </Pressable>
  </SafeAreaView>);
}
const s=StyleSheet.create({c:{flex:1,backgroundColor:'#0F172A',padding:20},h:{color:'white',fontSize:30,fontWeight:'700',marginBottom:20},card:{backgroundColor:'#1E293B',padding:18,borderRadius:16},t:{color:'white',fontSize:20,fontWeight:'700'},s:{color:'#94A3B8',marginTop:8},fab:{position:'absolute',right:24,bottom:28,width:62,height:62,borderRadius:31,backgroundColor:'#0EA5A4',alignItems:'center',justifyContent:'center'}});