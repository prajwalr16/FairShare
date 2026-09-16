
import { View, Text } from 'react-native';
export default function Home(){
 return (
  <View style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#0F172A'}}>
    <Text style={{fontSize:34,color:'#14B8A6',fontWeight:'700'}}>FairShare</Text>
    <Text style={{color:'white',marginTop:10}}>Split expenses. Share memories.</Text>
  </View>
 );
}
