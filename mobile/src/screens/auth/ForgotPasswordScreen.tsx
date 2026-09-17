import React,{useState} from 'react';
import {SafeAreaView,ScrollView,Text,TextInput,StyleSheet,Pressable,ActivityIndicator,Alert} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {supabase} from '../../config/supabase';

export default function ForgotPasswordScreen(){
  const navigation=useNavigation<any>();
  const[email,setEmail]=useState('');
  const[loading,setLoading]=useState(false);

  const sendReset=async()=>{
    if(!/^\S+@\S+\.\S+$/.test(email)){
      return Alert.alert('Invalid Email','Please enter a valid email.');
    }

    setLoading(true);

    const {error}=await supabase.auth.resetPasswordForEmail(email,{
      redirectTo:'exp://192.168.29.185:8081/--/reset-password'
    });

    setLoading(false);

    if(error){
      return Alert.alert('Reset Failed',error.message);
    }

    Alert.alert('Email Sent','Check your inbox for the reset link.');
  };

  return(
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>Forgot Password</Text>
        <Text style={s.sub}>Enter your email to receive a reset link.</Text>

        <TextInput
          style={s.input}
          placeholder='Email'
          placeholderTextColor='#94A3B8'
          autoCapitalize='none'
          keyboardType='email-address'
          value={email}
          onChangeText={setEmail}
        />

        <Pressable style={s.button} onPress={sendReset} disabled={loading}>
          {loading ? <ActivityIndicator color='white'/> : <Text style={s.buttonText}>Send Reset Link</Text>}
        </Pressable>

        <Pressable onPress={()=>navigation.goBack()}>
          <Text style={s.link}>Back to Login</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  container:{flex:1,backgroundColor:'#0F172A'},
  content:{flexGrow:1,padding:24,paddingBottom:60,justifyContent:'center'},
  title:{color:'white',fontSize:32,fontWeight:'700'},
  sub:{color:'#94A3B8',marginTop:8,marginBottom:24},
  input:{backgroundColor:'#1E293B',color:'white',padding:16,borderRadius:14,marginBottom:20},
  button:{backgroundColor:'#0EA5A4',padding:16,borderRadius:14,alignItems:'center'},
  buttonText:{color:'white',fontWeight:'700'},
  link:{color:'#0EA5A4',textAlign:'center',marginTop:24}
});
