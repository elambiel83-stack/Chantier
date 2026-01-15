import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function HomeScreen({ navigation }) {
  const categories = [
    { name: 'Ciment', icon: '🏗️', value: 'cement' },
    { name: 'Briques', icon: '🧱', value: 'bricks' },
    { name: 'Acier', icon: '🔩', value: 'steel' },
    { name: 'Bois', icon: '🪵', value: 'wood' },
    { name: 'Toiture', icon: '🏠', value: 'roofing' },
    { name: 'Outils', icon: '🔧', value: 'tools' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Bienvenue sur Chantier</Text>
          <Text style={styles.heroSubtitle}>
            Marketplace pour matériaux de construction
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catégories populaires</Text>
          <View style={styles.categoriesGrid}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.value}
                style={styles.categoryCard}
                onPress={() => navigation.navigate('Products', { category: category.value })}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text style={styles.categoryName}>{category.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nos services</Text>
          <View style={styles.featuresContainer}>
            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>🏪</Text>
              <Text style={styles.featureTitle}>Large sélection</Text>
              <Text style={styles.featureText}>
                Milliers de produits de construction disponibles
              </Text>
            </View>
            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>🚚</Text>
              <Text style={styles.featureTitle}>Livraison mondiale</Text>
              <Text style={styles.featureText}>
                Transport et suivi en temps réel
              </Text>
            </View>
            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>💳</Text>
              <Text style={styles.featureTitle}>Paiement sécurisé</Text>
              <Text style={styles.featureText}>
                Plusieurs options de paiement
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  hero: {
    backgroundColor: '#2196F3',
    padding: 32,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  categoryIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  featuresContainer: {
    gap: 12,
  },
  featureCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  featureText: {
    fontSize: 14,
    color: '#666',
  },
});

export default HomeScreen;
