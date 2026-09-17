import React,{useState} from 'react';
import {SafeAreaView,ScrollView,View,Text,TextInput,StyleSheet,Pressable,ActivityIndicator,Alert} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {supabase} from '../../config/supabase';

export default function ResetPasswordScreen(){
  const navigation=useNavigation<any>();
  const[p,setP]=useState('');
  const[c,setC]=useState('');
  const[show1,setShow1]=useState(false);
  const[show2,setShow2]=useState(false);
  const[loading,setLoading]=useState(false);

  const updatePassword=async()=>{
    if(p.length<8) return Alert.alert('Error','Password must be at least 8 characters.');
    if(p!==c) return Alert.alert('Error','Passwords do not match.');

    setLoading(true);
    const {error}=await supabase.auth.updateUser({password:p});
    setLoading(false);

    if(error) return Alert.alert('Reset Failed',error.message);

    Alert.alert('Success','Password updated.',[
      {text:'Login',onPress:()=>navigation.navigate('Login')}
    ]);
  };

  return(
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>Reset Password</Text>

        <View style={s.passwordBox}>
          <TextInput style={s.passwordInput} placeholder='New Password' placeholderTextColor='#94A3B8' secureTextEntry={!show1} value={p} onChangeText={setP}/>
          <Pressable onPress={()=>setShow1(!show1)}><Text style={s.eye}>{show1?'🙈':'👁️'}</Text></Pressable>
        </View>

        <View style={s.passwordBox}>
          <TextInput style={s.passwordInput} placeholder='Confirm Password' placeholderTextColor='#94A3B8' secureTextEntry={!show2} value={c} onChangeText={setC}/>
          <Pressable onPress={()=>setShow2(!show2)}><Text style={s.eye}>{show2?'🙈':'👁️'}</Text></Pressable>
        </View>

        <Pressable style={s.button} onPress={updatePassword}>
          {loading ? <ActivityIndicator color='white'/> : <Text style={s.buttonText}>Update Password</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  container:{flex:1,backgroundColor:'#0F172A'},
  content:{flexGrow:1,padding:24,justifyContent:'center'},
  title:{color:'white',fontSize:30,fontWeight:'700',marginBottom:24},
  passwordBox:{backgroundColor:'#1E293B',borderRadius:14,paddingHorizontal:16,flexDirection:'row',alignItems:'center',marginBottom:16},
  passwordInput:{flex:1,color:'white',paddingVertical:16},
  eye:{fontSize:20,paddingLeft:12},
  button:{backgroundColor:'#0EA5A4',padding:16,borderRadius:14,alignItems:'center'},
  buttonText:{color:'white',fontWeight:'700'}
});
