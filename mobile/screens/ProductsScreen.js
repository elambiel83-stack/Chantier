import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { getApiUrl } from '../config';
import { useCart } from '../context/CartContext';

export default function ProductsScreen({ route, navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(route.params?.category || 'produits');
  const [search, setSearch] = useState('');
  const { addToCart, getItemCount, formatAmount } = useCart();

  useEffect(() => {
    fetchProducts();
  }, [category]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl('/products')}?category=${encodeURIComponent(category)}`);
      if (!response.ok) throw new Error('Chargement du catalogue impossible');
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les produits. Vérifiez votre connexion.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product) => {
    addToCart(product, 1);
    Alert.alert('Succès', `${product.name_fr} ajouté au panier`);
  };

  const filteredProducts = products.filter(p =>
    p.name_fr.toLowerCase().includes(search.toLowerCase()) ||
    p.name_en.toLowerCase().includes(search.toLowerCase())
  );

  const renderProduct = ({ item }) => (
    <View style={styles.productCard}>
      <Image source={{ uri: item.img }} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name_fr}</Text>
        <Text style={styles.productId}>{item.id} · {item.unit}</Text>
        {item.stock && <Text style={styles.productStock}>Stock: {item.stock}</Text>}
        {item.vendorName && <Text style={styles.productVendor}>Vendu par {item.vendorName}</Text>}
        <Text style={styles.productPrice}>{formatAmount(item.price)}</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => handleAddToCart(item)}
      >
        <Text style={styles.addButtonText}>Ajouter</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={styles.loadingText}>Chargement des produits...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Category Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, category === 'produits' && styles.activeTab]}
          onPress={() => setCategory('produits')}
        >
          <Text style={[styles.tabText, category === 'produits' && styles.activeTabText]}>
            Produits
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, category === 'services' && styles.activeTab]}
          onPress={() => setCategory('services')}
        >
          <Text style={[styles.tabText, category === 'services' && styles.activeTabText]}>
            Services
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, category === 'facilitation' && styles.activeTab]}
          onPress={() => setCategory('facilitation')}
        >
          <Text style={[styles.tabText, category === 'facilitation' && styles.activeTabText]}>
            Facilitation
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, category === 'partenaires' && styles.activeTab]}
          onPress={() => setCategory('partenaires')}
        >
          <Text style={[styles.tabText, category === 'partenaires' && styles.activeTabText]}>
            Partenaires
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.productList}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Aucun produit trouvé</Text>
        }
      />

      {/* Cart Badge */}
      {getItemCount() > 0 && (
        <TouchableOpacity
          style={styles.cartBadge}
          onPress={() => navigation.navigate('Cart')}
        >
          <Text style={styles.cartBadgeText}>🛒 {getItemCount()}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  activeTab: {
    backgroundColor: '#1e293b',
  },
  tabText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  searchInput: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  productList: {
    padding: 16,
    gap: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  productInfo: {
    padding: 16,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  productId: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  productStock: {
    fontSize: 12,
    color: '#22c55e',
    marginBottom: 8,
  },
  productVendor: {
    fontSize: 11,
    color: '#dc2626',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  addButton: {
    backgroundColor: '#1e293b',
    padding: 16,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 32,
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
