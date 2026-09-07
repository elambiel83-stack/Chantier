import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ScrollView, Linking, StyleSheet, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import CommerceHomeScreen from './screens/HomeScreen';
import ProductsScreen from './screens/ProductsScreen';
import CartScreen from './screens/CartScreen';
import { CartProvider } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GOOGLE_AUTH_CONFIG } from './config';

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
  buttonDisabled: { opacity: 0.6 },
  hint: { color: '#666', fontSize: 12, marginTop: 16, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: { marginHorizontal: 8, color: '#999' },
});

function notifyGoogleUnavailable() {
  Alert.alert(
    'Connexion Google indisponible',
    "La connexion Google n'est pas encore reliée au serveur MonChantier. Utilisez votre e-mail et votre mot de passe."
  );
}

const PRODUCTS = [
  { id: '1', name_fr: 'Brique', name_en: 'Brick', unit: 'pcs', price: 0.45 },
  { id: '2', name_fr: 'Sable', name_en: 'Sand', unit: 'm3', price: 18.00 },
  { id: '3', name_fr: 'Moellon', name_en: 'Stone', unit: 'ton', price: 22.00 },
  { id: '4', name_fr: 'Ciment', name_en: 'Cement', unit: 'bag', price: 11.50 },
  { id: '5', name_fr: 'Pavé', name_en: 'Paver', unit: 'sqm', price: 14.00 },
];

// Écran de connexion
function LoginScreen({ navigation }) {
  const { login, continueAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [request, response, promptAsync] = Google.useAuthRequest(GOOGLE_AUTH_CONFIG);

  React.useEffect(() => {
    if (response?.type === 'success') {
      notifyGoogleUnavailable();
    }
  }, [response]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (error) {
      Alert.alert('Connexion impossible', error.message || 'Vérifiez vos identifiants.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGooglePress = async () => {
    // Le backend n'expose pas encore d'échange de jeton Google: pas de session factice.
    notifyGoogleUnavailable();
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
        style={[styles.button, { backgroundColor: '#3B82F6' }, submitting && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={submitting}
      >
        <Text style={styles.buttonText}>{submitting ? 'Connexion...' : 'Se connecter'}</Text>
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

      <Text style={styles.hint}>Le mode visiteur donne accès au catalogue; la commande demande un compte.</Text>

      {/* Visiteur */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#6B7280', marginTop: 30 }]}
        onPress={continueAsGuest}
      >
        <Text style={styles.buttonText}>Continuer en tant que visiteur</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// Écran d'inscription
function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [request, response, promptAsync] = Google.useAuthRequest(GOOGLE_AUTH_CONFIG);

  React.useEffect(() => {
    if (response?.type === 'success') {
      notifyGoogleUnavailable();
    }
  }, [response]);

  const handleRegister = async () => {
    if (!name || !email || !password || !phone) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    if (password.length < 12) {
      Alert.alert('Mot de passe trop court', 'Le mot de passe doit contenir au moins 12 caractères.');
      return;
    }
    setSubmitting(true);
    try {
      await register({ fullName: name.trim(), email: email.trim(), phone: phone.trim(), password });
    } catch (error) {
      Alert.alert('Inscription impossible', error.message || 'Vérifiez les informations saisies.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGooglePress = async () => {
    notifyGoogleUnavailable();
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
        placeholder="Mot de passe (12 caractères minimum)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#10B981' }, submitting && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={submitting}
      >
        <Text style={styles.buttonText}>{submitting ? 'Création...' : "S'inscrire"}</Text>
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
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
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
        {props => <CommerceHomeScreen {...props} user={user} />}
      </Stack.Screen>
      <Stack.Screen
        name="Products"
        component={ProductsScreen}
        options={{ title: 'Catalogue' }}
      />
      <Stack.Screen
        name="Cart"
        component={CartScreen}
        options={{ title: 'Panier' }}
      />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { session, user } = useAuth();

  return (
    <NavigationContainer>
      {session ? <AppStack user={user} /> : <AuthStack />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RootNavigator />
      </CartProvider>
    </AuthProvider>
  );
}
