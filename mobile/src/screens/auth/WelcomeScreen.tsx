import React from 'react';
import {SafeAreaView,View,Text,StyleSheet,Pressable} from 'react-native';
import {useNavigation} from '@react-navigation/native';

export default function WelcomeScreen(){
  const navigation=useNavigation();
  return(
    <SafeAreaView style={s.container}>
      <View style={s.center}>
        <Text style={s.logo}>FS</Text>
        <Text style={s.title}>FairShare</Text>
        <Text style={s.tag}>Split expenses. Share memories.</Text>
      </View>
      <Pressable style={s.button} onPress={()=>navigation.navigate('Login')}>
        <Text style={s.buttonText}>Get Started</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  container:{flex:1,backgroundColor:'#0F172A',padding:24,justifyContent:'space-between'},
  center:{flex:1,justifyContent:'center',alignItems:'center'},
  logo:{fontSize:60,fontWeight:'800',color:'#0EA5A4'},
  title:{fontSize:34,fontWeight:'700',color:'white',marginTop:12},
  tag:{fontSize:16,color:'#94A3B8',marginTop:12,textAlign:'center'},
  button:{backgroundColor:'#0EA5A4',padding:16,borderRadius:14,alignItems:'center',marginBottom:20},
  buttonText:{color:'white',fontSize:16,fontWeight:'600'}
});
