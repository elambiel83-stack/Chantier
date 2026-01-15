import * as React from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, TextInput } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const PRODUCTS = [
  { id: 'BRQ-001', name_fr: 'Brique en bloc ciment', name_en: 'Cement block brick', unit: 'pcs', price: 0.45, img: 'https://images.unsplash.com/photo-1496247749665-49cf5b1022e9?q=80&w=1200&auto=format&fit=crop' },
  { id: 'SAB-001', name_fr: 'Sable concassé (m³)', name_en: 'Crushed sand (m³)', unit: 'm3', price: 18.00, img: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?q=80&w=1200&auto=format&fit=crop' },
  { id: 'MOL-001', name_fr: 'Moellon', name_en: 'Rubble stone', unit: 'ton', price: 22.00, img: 'https://images.unsplash.com/photo-1606761568499-6d2451b23c85?q=80&w=1200&auto=format&fit=crop' },
  { id: 'PAV-001', name_fr: 'Pavé', name_en: 'Paver', unit: 'sqm', price: 14.00, img: 'https://images.unsplash.com/photo-1599842055622-5b164b4a9490?q=80&w=1200&auto=format&fit=crop' },
  { id: 'CIM-001', name_fr: 'Ciment (sac 50kg)', name_en: 'Cement (50kg)', unit: 'bag', price: 11.50, img: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=1200&auto=format&fit=crop' },
  { id: 'CAR-001', name_fr: 'Carreaux (m²)', name_en: 'Tiles (sqm)', unit: 'sqm', price: 19.00, img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200&auto=format&fit=crop' }
];

const Stack = createNativeStackNavigator();

function HomeScreen({ navigation }) {
  const [q, setQ] = React.useState('');
  const [lang, setLang] = React.useState<'fr'|'en'>('fr');
  const data = PRODUCTS.filter(p => (p.name_fr + ' ' + p.name_en).toLowerCase().includes(q.toLowerCase()));
  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#F8FAFC' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '800', fontSize: 24 }}>MonChantier</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => setLang('fr')}><Text>FR</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setLang('en')}><Text>EN</Text></TouchableOpacity>
        </View>
      </View>

      <Text style={{ marginTop: 8, color: '#475569' }}>
        {lang==='fr' ? 'Achetez agrégats et matériaux, livrés à votre chantier.' : 'Buy aggregates and materials, delivered to your site.'}
      </Text>

      <TextInput
        placeholder={lang==='fr'?'Rechercher...':'Search...'}
        value={q}
        onChangeText={setQ}
        style={{ backgroundColor: 'white', padding: 12, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0' }}
      />

      <FlatList
        style={{ marginTop: 12 }}
        data={data}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('Product', { item, lang })} style={{ backgroundColor: 'white', borderRadius: 16, padding: 12, marginBottom: 12, flexDirection: 'row', gap: 12 }}>
            <Image source={{ uri: item.img }} style={{ width: 64, height: 64, borderRadius: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{lang==='fr'?item.name_fr:item.name_en}</Text>
              <Text style={{ color: '#64748B' }}>{item.id} · {item.unit}</Text>
              <Text style={{ marginTop: 4, fontWeight: '700' }}>${item.price.toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function ProductScreen({ route }) {
  const { item, lang } = route.params;
  const message = encodeURIComponent((lang==='fr'?'Bonjour, je souhaite commander: ':'Hello, I want to order: ') + `${item.id} ${lang==='fr'?item.name_fr:item.name_en}`);
  const wa = `https://wa.me/243999972466?text=${message}`;
  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#F8FAFC' }}>
      <Image source={{ uri: item.img }} style={{ width: '100%', height: 220, borderRadius: 16 }} />
      <Text style={{ fontWeight: '800', fontSize: 22, marginTop: 12 }}>{lang==='fr'?item.name_fr:item.name_en}</Text>
      <Text style={{ color: '#64748B' }}>{item.id} · {item.unit}</Text>
      <Text style={{ marginTop: 8, fontWeight: '800', fontSize: 18 }}>${item.price.toFixed(2)}</Text>
      <TouchableOpacity onPress={() => { /* Linking.openURL(wa) would be used in a real app */ }} style={{ backgroundColor: '#DC2626', padding: 14, borderRadius: 14, marginTop: 16 }}>
        <Text style={{ textAlign: 'center', color: 'white', fontWeight: '700' }}>{lang==='fr'?'Commander via WhatsApp':'Order via WhatsApp'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Product" component={ProductScreen} options={{ title: 'Produit' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
