import React,{useState} from 'react';
import {View,TextInput,Pressable,StyleSheet} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
export default function PasswordInput(props:any){
 const[show,setShow]=useState(false);
 return(
  <View style={s.box}>
   <TextInput {...props} style={[s.input,props.style]} secureTextEntry={!show} placeholderTextColor='#94A3B8'/>
   <Pressable onPress={()=>setShow(!show)} hitSlop={10}>
    <Ionicons name={show?'eye-off':'eye'} size={22} color='#94A3B8'/>
   </Pressable>
  </View>
 );
}
const s=StyleSheet.create({box:{backgroundColor:'#1E293B',borderRadius:14,paddingHorizontal:16,flexDirection:'row',alignItems:'center',marginBottom:16},input:{flex:1,color:'white',paddingVertical:16,fontSize:16}});
