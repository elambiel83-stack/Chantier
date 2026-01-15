import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ScrollView, Linking, StyleSheet, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

const Stack = createNativeStackNavigator();

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F8FAFC' },
  header: { fontWeight: '800', fontSize: 24, marginBottom: 8 },
  description: { marginBottom: 12, color: '#666' },
  input: { backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#ddd' },
  button: { padding: 14, borderRadius: 8, marginTop: 12, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  socialButton: { padding: 12, borderRadius: 8, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: '#ddd' },
  socialButtonText: { fontWeight: '600', marginLeft: 8, color: '#333' },
  productCard: { backgroundColor: 'white', borderRadius: 8, padding: 12, marginBottom: 12 },
  productName: { fontWeight: '700', fontSize: 16 },
  productPrice: { fontWeight: '700', color: '#22C55E', marginTop: 4 },
  link: { color: '#3B82F6', textDecorationLine: 'underline', marginTop: 12, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: { marginHorizontal: 8, color: '#999' },
});

const PRODUCTS = [
  { id: '1', name_fr: 'Brique', name_en: 'Brick', unit: 'pcs', price: 0.45 },
  { id: '2', name_fr: 'Sable', name_en: 'Sand', unit: 'm3', price: 18.00 },
  { id: '3', name_fr: 'Moellon', name_en: 'Stone', unit: 'ton', price: 22.00 },
  { id: '4', name_fr: 'Ciment', name_en: 'Cement', unit: 'bag', price: 11.50 },
  { id: '5', name_fr: 'Pavé', name_en: 'Paver', unit: 'sqm', price: 14.00 },
];

// Écran de connexion
function LoginScreen({ navigation, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // À remplacer
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleLogin(authentication);
    }
  }, [response]);

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    onLogin({ email, name: email.split('@')[0], loginMethod: 'email' });
  };

  const handleGoogleLogin = (authentication) => {
    if (authentication?.accessToken) {
      // En production, vérifier le token avec le backend
      onLogin({ 
        email: 'user@gmail.com', 
        name: 'Google User',
        loginMethod: 'google'
      });
    }
  };

  const handleGooglePress = async () => {
    try {
      const result = await promptAsync();
      if (result?.type !== 'success') {
        Alert.alert('Erreur', 'Connexion Google annulée');
      }
    } catch (err) {
      Alert.alert('Erreur', 'Erreur de connexion Google');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={{ marginTop: 40 }}>
        <Text style={styles.header}>MonChantier</Text>
        <Text style={styles.description}>Connectez-vous à votre compte</Text>
      </View>

      {/* Connexion classique */}
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        style={styles.input}
      />

      <TextInput
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#3B82F6' }]}
        onPress={handleLogin}
      >
        <Text style={styles.buttonText}>Se connecter</Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OU</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Google Sign In */}
      <TouchableOpacity
        style={styles.socialButton}
        onPress={handleGooglePress}
        disabled={!request}
      >
        <Text style={{ fontSize: 20 }}>🔵</Text>
        <Text style={styles.socialButtonText}>Se connecter avec Google</Text>
      </TouchableOpacity>

      {/* Gmail Sign In (alias Google) */}
      <TouchableOpacity
        style={styles.socialButton}
        onPress={handleGooglePress}
        disabled={!request}
      >
        <Text style={{ fontSize: 20 }}>📧</Text>
        <Text style={styles.socialButtonText}>Se connecter avec Gmail</Text>
      </TouchableOpacity>

      {/* Facebook */}
      <TouchableOpacity
        style={styles.socialButton}
        onPress={() => Alert.alert('Info', 'Facebook login à venir')}
      >
        <Text style={{ fontSize: 20 }}>f</Text>
        <Text style={styles.socialButtonText}>Se connecter avec Facebook</Text>
      </TouchableOpacity>

      {/* Inscription */}
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Créer un compte</Text>
      </TouchableOpacity>

      {/* Visiteur */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#6B7280', marginTop: 30 }]}
        onPress={() => {
          onLogin({ email: 'guest@monchantier.com', name: 'Visiteur', loginMethod: 'guest' });
        }}
      >
        <Text style={styles.buttonText}>Continuer en tant que visiteur</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// Écran d'inscription
function RegisterScreen({ navigation, onLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        onLogin({ 
          email: 'user@gmail.com', 
          name: 'Google User',
          loginMethod: 'google'
        });
      }
    }
  }, [response]);

  const handleRegister = () => {
    if (!name || !email || !password || !phone) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    Alert.alert('Succès', 'Compte créé avec succès!');
    onLogin({ email, name, loginMethod: 'email' });
  };

  const handleGooglePress = async () => {
    try {
      const result = await promptAsync();
      if (result?.type !== 'success') {
        Alert.alert('Erreur', 'Connexion Google annulée');
      }
    } catch (err) {
      Alert.alert('Erreur', 'Erreur de connexion Google');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={{ marginTop: 20 }}>
        <Text style={styles.header}>Créer un compte</Text>
        <Text style={styles.description}>Rejoignez MonChantier</Text>
      </View>

      {/* Inscription classique */}
      <TextInput
        placeholder="Nom complet"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        style={styles.input}
      />

      <TextInput
        placeholder="Téléphone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={styles.input}
      />

      <TextInput
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#10B981' }]}
        onPress={handleRegister}
      >
        <Text style={styles.buttonText}>S'inscrire</Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OU</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Google Sign Up */}
      <TouchableOpacity
        style={styles.socialButton}
        onPress={handleGooglePress}
        disabled={!request}
      >
        <Text style={{ fontSize: 20 }}>🔵</Text>
        <Text style={styles.socialButtonText}>S'inscrire avec Google</Text>
      </TouchableOpacity>

      {/* Gmail Sign Up */}
      <TouchableOpacity
        style={styles.socialButton}
        onPress={handleGooglePress}
        disabled={!request}
      >
        <Text style={{ fontSize: 20 }}>📧</Text>
        <Text style={styles.socialButtonText}>S'inscrire avec Gmail</Text>
      </TouchableOpacity>

      {/* Connexion */}
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Déjà inscrit? Se connecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// Écran d'accueil
function HomeScreen({ navigation, user }) {
  const [searchText, setSearchText] = useState('');
  const [language, setLanguage] = useState('fr');

  const filteredProducts = PRODUCTS.filter(p =>
    (p.name_fr + ' ' + p.name_en).toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View>
          <Text style={styles.header}>MonChantier</Text>
          <Text style={{ color: '#666' }}>Bienvenue, {user.name}!</Text>
          <Text style={{ color: '#999', fontSize: 12 }}>({user.loginMethod})</Text>
        </View>
        <TouchableOpacity style={{ backgroundColor: '#EF4444', padding: 8, borderRadius: 6 }}>
          <Text style={{ color: 'white', fontWeight: '600' }}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <TouchableOpacity onPress={() => setLanguage('fr')}>
          <Text style={{ fontWeight: language === 'fr' ? 'bold' : 'normal' }}>FR</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setLanguage('en')}>
          <Text style={{ fontWeight: language === 'en' ? 'bold' : 'normal' }}>EN</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        placeholder={language === 'fr' ? 'Rechercher...' : 'Search...'}
        value={searchText}
        onChangeText={setSearchText}
        style={styles.input}
      />

      <FlatList
        data={filteredProducts}
        keyExtractor={item => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.productCard}
            onPress={() => navigation.navigate('Product', { product: item, lang: language })}
          >
            <Text style={styles.productName}>{language === 'fr' ? item.name_fr : item.name_en}</Text>
            <Text style={{ color: '#999' }}>{item.unit}</Text>
            <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

// Écran détail du produit
function ProductScreen({ route, navigation }) {
  try {
    const { product, lang } = route.params;

    const handleWhatsApp = () => {
      const message = encodeURIComponent(
        (lang === 'fr' ? 'Bonjour, je veux commander: ' : 'Hello, I want to order: ') +
        (lang === 'fr' ? product.name_fr : product.name_en)
      );
      const wa = `https://wa.me/243999972466?text=${message}`;
      Linking.openURL(wa).catch(() => Alert.alert('Erreur', 'WhatsApp non disponible'));
    };

    return (
      <ScrollView style={styles.container}>
        <Text style={styles.header}>{lang === 'fr' ? product.name_fr : product.name_en}</Text>
        <Text style={{ color: '#999', marginBottom: 12 }}>{product.unit}</Text>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#22C55E' }}>${product.price.toFixed(2)}</Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#25D366' }]}
          onPress={handleWhatsApp}
        >
          <Text style={styles.buttonText}>
            {lang === 'fr' ? 'Commander via WhatsApp' : 'Order via WhatsApp'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#666' }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>{lang === 'fr' ? 'Retour' : 'Back'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  } catch (error) {
    return (
      <View style={styles.container}>
        <Text style={{ color: 'red' }}>Erreur: {error.message}</Text>
      </View>
    );
  }
}

// Navigation
function AuthStack({ onLogin }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login">
        {props => <LoginScreen {...props} onLogin={onLogin} />}
      </Stack.Screen>
      <Stack.Screen name="Register">
        {props => <RegisterScreen {...props} onLogin={onLogin} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function AppStack({ user }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#f5f5f5' },
        headerTintColor: '#000',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="Home" options={{ headerShown: false }}>
        {props => <HomeScreen {...props} user={user} />}
      </Stack.Screen>
      <Stack.Screen
        name="Product"
        component={ProductScreen}
        options={{ title: 'Détails du produit' }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  return (
    <NavigationContainer>
      {user ? (
        <AppStack user={user} />
      ) : (
        <AuthStack onLogin={setUser} />
      )}
    </NavigationContainer>
  );
}
