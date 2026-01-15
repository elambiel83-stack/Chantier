import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function ProfileScreen({ navigation }) {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Profil</Text>
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.welcomeText}>
            Connectez-vous pour accéder à votre profil
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('Login')}>
            <Text style={styles.buttonText}>Se connecter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => navigation.navigate('Register')}>
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              S'inscrire
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profil</Text>
      </View>
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('Orders')}>
          <Text style={styles.menuText}>Mes commandes</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Paramètres</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Aide</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.menuItem, styles.logoutItem]}
          onPress={() => setIsLoggedIn(false)}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 4,
    marginBottom: 12,
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  secondaryButtonText: {
    color: '#2196F3',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  menuItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
  },
  menuText: {
    fontSize: 16,
    color: '#333',
  },
  menuArrow: {
    fontSize: 24,
    color: '#999',
  },
  logoutItem: {
    marginTop: 16,
  },
  logoutText: {
    fontSize: 16,
    color: '#d32f2f',
    fontWeight: '600',
  },
});

export default ProfileScreen;
