import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { useCart } from '../context/CartContext';
import { API_CONFIG } from '../config';

export default function HomeScreen({ navigation, user }) {
  const { getItemCount } = useCart();

  const openWhatsApp = () => {
    const url = `whatsapp://send?phone=${API_CONFIG.whatsappNumber.replace(/\D/g, '')}`;
    Linking.openURL(url).catch(() => Alert.alert('Erreur', 'WhatsApp non disponible'));
  };

  return (
    <ScrollView style={styles.container}>
      {/* Hero Section */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>
          Achetez <Text style={styles.heroHighlight}>agrégats</Text> et matériaux de construction
        </Text>
        <Text style={styles.heroSubtitle}>
          Livrés à votre chantier. Paiement flexible, livraison rapide.
        </Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Products')}
          >
            <Text style={styles.primaryButtonText}>Parcourir le catalogue</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={openWhatsApp}
          >
            <Text style={styles.secondaryButtonText}>📱 WhatsApp</Text>
          </TouchableOpacity>

          {user?.role === 'customer' && (
            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={() => navigation.navigate('Orders')}
            >
              <Text style={styles.tertiaryButtonText}>Mes commandes</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Categories */}
      <View style={styles.categories}>
        <Text style={styles.sectionTitle}>Catégories</Text>
        
        <TouchableOpacity
          style={styles.categoryCard}
          onPress={() => navigation.navigate('Products', { category: 'produits' })}
        >
          <Text style={styles.categoryEmoji}>🧱</Text>
          <Text style={styles.categoryTitle}>Produits</Text>
          <Text style={styles.categoryDesc}>Briques, sable, ciment, carreaux...</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.categoryCard}
          onPress={() => navigation.navigate('Products', { category: 'services' })}
        >
          <Text style={styles.categoryEmoji}>🚚</Text>
          <Text style={styles.categoryTitle}>Services</Text>
          <Text style={styles.categoryDesc}>Livraison, pose, installation...</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.categoryCard}
          onPress={() => navigation.navigate('Products', { category: 'facilitation' })}
        >
          <Text style={styles.categoryEmoji}>🤝</Text>
          <Text style={styles.categoryTitle}>Facilitation</Text>
          <Text style={styles.categoryDesc}>Assistance achat, conseil technique...</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.categoryCard}
          onPress={() => navigation.navigate('Products', { category: 'partenaires' })}
        >
          <Text style={styles.categoryEmoji}>🏗️</Text>
          <Text style={styles.categoryTitle}>Partenaires</Text>
          <Text style={styles.categoryDesc}>Transport et équipements partenaires...</Text>
        </TouchableOpacity>
      </View>

      {/* Cart Badge */}
      {getItemCount() > 0 && (
        <TouchableOpacity
          style={styles.cartBadge}
          onPress={() => navigation.navigate('Cart')}
        >
          <Text style={styles.cartBadgeText}>🛒 {getItemCount()}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  hero: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  heroHighlight: {
    color: '#dc2626',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
  },
  buttonContainer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tertiaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  tertiaryButtonText: {
    color: '#1e293b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  categories: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1e293b',
  },
  categoryCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  categoryDesc: {
    fontSize: 14,
    color: '#64748b',
  },
  cartBadge: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
