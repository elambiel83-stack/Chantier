import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import CommerceHomeScreen from './screens/HomeScreen';
import ProductsScreen from './screens/ProductsScreen';
import CartScreen from './screens/CartScreen';
import OrdersScreen from './screens/OrdersScreen';
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
  link: { color: '#3B82F6', textDecorationLine: 'underline', marginTop: 12, textAlign: 'center' },
  buttonDisabled: { opacity: 0.6 },
  hint: { color: '#666', fontSize: 12, marginTop: 16, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: { marginHorizontal: 8, color: '#999' },
});

function notifyGoogleNotConfigured() {
  Alert.alert(
    'Connexion Google indisponible',
    "La connexion Google n'est pas configurée sur cet appareil. Utilisez votre e-mail et votre mot de passe."
  );
}

// L'utilisateur a fermé la fenêtre de connexion lui-même: pas une erreur à signaler.
function isUserCancellation(error) {
  return error?.code === 'ERR_REQUEST_CANCELED' || error?.code === 'ERR_CANCELED';
}

// Écran de connexion
function LoginScreen({ navigation }) {
  const { login, loginWithGoogle, loginWithApple, continueAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [request, , promptAsync] = Google.useAuthRequest({
    ...GOOGLE_AUTH_CONFIG,
    responseType: 'id_token',
    scopes: ['openid', 'profile', 'email']
  });

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
    if (!request) return notifyGoogleNotConfigured();
    try {
      const result = await promptAsync();
      if (result.type !== 'success') return;
      const idToken = result.params?.id_token;
      if (!idToken) throw new Error('Jeton Google manquant');
      await loginWithGoogle(idToken);
    } catch (error) {
      Alert.alert('Connexion Google impossible', error.message || 'Réessayez.');
    }
  };

  const handleApplePress = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL]
      });
      // Apple ne renvoie le nom qu'à la toute première connexion: à transmettre maintenant,
      // le backend ne le reverra plus jamais dans le jeton lui-même.
      const fullName = credential.fullName?.givenName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
        : undefined;
      await loginWithApple(credential.identityToken, fullName);
    } catch (error) {
      if (isUserCancellation(error)) return;
      Alert.alert('Connexion Apple impossible', error.message || 'Réessayez.');
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

      {/* Apple / iCloud: uniquement sur iOS, exige le bouton officiel Apple (règles du
          App Store) plutôt qu'un bouton personnalisé. */}
      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={{ height: 44, marginTop: 10 }}
          onPress={handleApplePress}
        />
      )}

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
  const { register, loginWithGoogle, loginWithApple } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [request, , promptAsync] = Google.useAuthRequest({
    ...GOOGLE_AUTH_CONFIG,
    responseType: 'id_token',
    scopes: ['openid', 'profile', 'email']
  });

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
    if (!request) return notifyGoogleNotConfigured();
    try {
      const result = await promptAsync();
      if (result.type !== 'success') return;
      const idToken = result.params?.id_token;
      if (!idToken) throw new Error('Jeton Google manquant');
      await loginWithGoogle(idToken);
    } catch (error) {
      Alert.alert('Inscription Google impossible', error.message || 'Réessayez.');
    }
  };

  const handleApplePress = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL]
      });
      const fullName = credential.fullName?.givenName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
        : undefined;
      await loginWithApple(credential.identityToken, fullName);
    } catch (error) {
      if (isUserCancellation(error)) return;
      Alert.alert('Inscription Apple impossible', error.message || 'Réessayez.');
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

      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={{ height: 44, marginTop: 10 }}
          onPress={handleApplePress}
        />
      )}

      {/* Connexion */}
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Déjà inscrit? Se connecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
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
      <Stack.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ title: 'Mes commandes' }}
      />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { session, user, restoring } = useAuth();

  // Le temps de restaurer une éventuelle session persistée: évite un flash de l'écran
  // de connexion avant de savoir si un compte est déjà connecté (voir AuthContext).
  if (restoring) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

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
