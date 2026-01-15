import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';

function ProductsScreen({ navigation, route }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const category = route.params?.category;

  useEffect(() => {
    fetchProducts();
  }, [category]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = category ? { category } : {};
      const response = await api.get('/products', { params });
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderProduct = ({ item }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => navigation.navigate('ProductDetail', { productId: item._id })}>
      <View style={styles.productPlaceholder}>
        <Text style={styles.placeholderIcon}>📦</Text>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.productCategory}>{item.category}</Text>
        <Text style={styles.productPrice}>
          {item.price.amount} {item.price.currency} / {item.price.unit}
        </Text>
        {item.rating.count > 0 && (
          <Text style={styles.productRating}>
            ⭐ {item.rating.average.toFixed(1)} ({item.rating.count})
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Produits</Text>
        {category && (
          <Text style={styles.subtitle}>Catégorie: {category}</Text>
        )}
      </View>
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item._id}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun produit trouvé</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  listContainer: {
    padding: 8,
  },
  productCard: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 8,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productPlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  productRating: {
    fontSize: 12,
    color: '#FF9800',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});

export default ProductsScreen;
