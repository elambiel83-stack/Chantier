import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import api from '../services/api';

function ProductDetailScreen({ route }) {
  const { productId } = route.params;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/products/${productId}`);
      setProduct(response.data.product);
    } catch (error) {
      console.error('Error fetching product:', error);
      Alert.alert('Erreur', 'Impossible de charger le produit');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    // In a real app, this would add to cart via API or local storage
    Alert.alert('Succès', 'Produit ajouté au panier!');
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Produit non trouvé</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imagePlaceholder}>
        <Text style={styles.placeholderIcon}>📦</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.category}>{product.category}</Text>
        
        <Text style={styles.price}>
          {product.price.amount} {product.price.currency} / {product.price.unit}
        </Text>

        {product.rating.count > 0 && (
          <Text style={styles.rating}>
            ⭐ {product.rating.average.toFixed(1)} ({product.rating.count} avis)
          </Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>
        </View>

        {product.specifications && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spécifications</Text>
            {product.specifications.brand && (
              <Text style={styles.spec}>Marque: {product.specifications.brand}</Text>
            )}
            {product.specifications.model && (
              <Text style={styles.spec}>Modèle: {product.specifications.model}</Text>
            )}
            {product.specifications.material && (
              <Text style={styles.spec}>Matériau: {product.specifications.material}</Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.stock}>
            Stock: {product.stock.quantity} {product.stock.unit}
          </Text>
        </View>

        <View style={styles.quantityContainer}>
          <Text style={styles.quantityLabel}>Quantité:</Text>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity(Math.max(1, quantity - 1))}>
              <Text style={styles.quantityButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity(Math.min(product.stock.quantity, quantity + 1))}>
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddToCart}>
          <Text style={styles.addButtonText}>Ajouter au panier</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
  },
  imagePlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 80,
  },
  content: {
    padding: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  category: {
    fontSize: 14,
    color: '#2196F3',
    backgroundColor: '#E3F2FD',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  rating: {
    fontSize: 14,
    color: '#FF9800',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  spec: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  stock: {
    fontSize: 14,
    color: '#4CAF50',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 4,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  quantityButton: {
    padding: 12,
    backgroundColor: '#f5f5f5',
  },
  quantityButtonText: {
    fontSize: 18,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  quantityValue: {
    fontSize: 16,
    paddingHorizontal: 20,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 4,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProductDetailScreen;
