import React,{useState} from 'react';
import {Modal,View,Text,TextInput,Pressable,StyleSheet,ScrollView} from 'react-native';
import {GROUP_TYPES} from '../constants/groupTypes';

export default function CreateGroupModal({visible,onClose,onCreate}:{visible:boolean,onClose:()=>void,onCreate:(g:any)=>void}){
 const[name,setName]=useState('');
 const[type,setType]=useState('Trip');
 const[desc,setDesc]=useState('');
 const submit=()=>{if(!name.trim())return;onCreate({name,type,currency:'INR',description:desc});setName('');setDesc('');setType('Trip');onClose();};
 return(
 <Modal visible={visible} animationType='slide' transparent>
  <View style={s.overlay}><View style={s.box}>
   <Text style={s.title}>Create Group</Text>
   <TextInput style={s.input} placeholder='Group Name' placeholderTextColor='#94A3B8' value={name} onChangeText={setName}/>
   <Text style={s.label}>Group Type</Text>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:16}}>
    {GROUP_TYPES.map(g=><Pressable key={g} style={[s.chip,type===g&&s.active]} onPress={()=>setType(g)}><Text style={type===g?s.activeText:s.chipText}>{g}</Text></Pressable>)}
   </ScrollView>
   <TextInput style={[s.input,{height:90}]} multiline placeholder='Description (optional)' placeholderTextColor='#94A3B8' value={desc} onChangeText={setDesc}/>
   <Pressable style={s.btn} onPress={submit}><Text style={s.btnText}>Create</Text></Pressable>
   <Pressable onPress={onClose}><Text style={s.cancel}>Cancel</Text></Pressable>
  </View></View></Modal>);
}
const s=StyleSheet.create({overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.55)',justifyContent:'flex-end'},box:{backgroundColor:'#0F172A',padding:24,borderTopLeftRadius:26,borderTopRightRadius:26},title:{color:'white',fontSize:28,fontWeight:'700',marginBottom:20},label:{color:'#94A3B8',marginBottom:10},input:{backgroundColor:'#1E293B',color:'white',borderRadius:14,padding:16,marginBottom:16},chip:{paddingHorizontal:16,paddingVertical:10,borderRadius:999,backgroundColor:'#1E293B',marginRight:10},active:{backgroundColor:'#0EA5A4'},chipText:{color:'#CBD5E1'},activeText:{color:'white',fontWeight:'700'},btn:{backgroundColor:'#0EA5A4',padding:16,borderRadius:14,alignItems:'center'},btnText:{color:'white',fontWeight:'700'},cancel:{color:'#94A3B8',textAlign:'center',marginTop:18}});
