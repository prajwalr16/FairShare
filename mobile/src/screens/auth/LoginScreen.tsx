import React,{useState} from 'react';
import {SafeAreaView,View,Text,TextInput,StyleSheet,Pressable} from 'react-native';

export default function LoginScreen(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [show,setShow]=useState(false);

  return(
    <SafeAreaView style={s.container}>
      <View>
        <Text style={s.title}>Welcome Back</Text>
        <Text style={s.sub}>Sign in to continue using FairShare.</Text>

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor="#94A3B8"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <View style={s.passwordBox}>
          <TextInput
            style={s.passwordInput}
            placeholder="Password"
            placeholderTextColor="#94A3B8"
            secureTextEntry={!show}
            value={password}
            onChangeText={setPassword}
          />
          <Pressable onPress={()=>setShow(!show)}>
            <Text style={s.eye}>{show?'Hide':'Show'}</Text>
          </Pressable>
        </View>

        <Pressable style={s.signIn}>
          <Text style={s.signText}>Sign In</Text>
        </Pressable>

        <Pressable>
          <Text style={s.link}>Forgot Password?</Text>
        </Pressable>
      </View>

      <Pressable>
        <Text style={s.bottom}>Don't have an account? Create Account</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  container:{flex:1,backgroundColor:'#0F172A',padding:24,justifyContent:'space-between'},
  title:{fontSize:32,fontWeight:'700',color:'white',marginTop:40},
  sub:{fontSize:16,color:'#94A3B8',marginTop:8,marginBottom:28},
  input:{backgroundColor:'#1E293B',color:'white',padding:16,borderRadius:14,marginBottom:16},
  passwordBox:{backgroundColor:'#1E293B',borderRadius:14,paddingHorizontal:16,flexDirection:'row',alignItems:'center'},
  passwordInput:{flex:1,color:'white',paddingVertical:16},
  eye:{color:'#0EA5A4',fontWeight:'600'},
  signIn:{backgroundColor:'#0EA5A4',padding:16,borderRadius:14,alignItems:'center',marginTop:24},
  signText:{color:'white',fontSize:16,fontWeight:'700'},
  link:{color:'#0EA5A4',textAlign:'center',marginTop:20},
  bottom:{color:'#94A3B8',textAlign:'center',marginBottom:20}
});
