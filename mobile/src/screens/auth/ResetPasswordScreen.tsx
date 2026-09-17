import React,{useState} from 'react';
import {SafeAreaView,ScrollView,Text,StyleSheet,Pressable,ActivityIndicator,Alert} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {supabase} from '../../config/supabase';
import PasswordInput from '../../components/PasswordInput';

export default function ResetPasswordScreen(){
  const navigation=useNavigation<any>();
  const[p,setP]=useState('');
  const[c,setC]=useState('');
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

        <PasswordInput placeholder='New Password' value={p} onChangeText={setP}/>

        <PasswordInput placeholder='Confirm Password' value={c} onChangeText={setC}/>

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
  
  button:{backgroundColor:'#0EA5A4',padding:16,borderRadius:14,alignItems:'center'},
  buttonText:{color:'white',fontWeight:'700'}
});
