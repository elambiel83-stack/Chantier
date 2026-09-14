import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

// Mêmes libellés/couleurs que l'interface staff/admin (web/admin.js), pour une
// terminologie cohérente entre les commandes vues côté client et côté staff.
const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  delivering: 'En livraison',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

const STATUS_COLORS = {
  pending: '#d97706',
  confirmed: '#2563eb',
  delivering: '#4f46e5',
  completed: '#16a34a',
  cancelled: '#dc2626',
};

function formatDate(value) {
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// total_amount est déjà exprimé dans la devise de la commande (voir POST
// /api/orders côté backend): pas de conversion à appliquer ici, contrairement au
// panier où formatAmount convertit depuis des prix catalogue en USD.
function formatOrderAmount(order) {
  return `${Number(order.total_amount).toFixed(2)} ${order.currency}`;
}

export default function OrdersScreen({ navigation }) {
  const { authFetch, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async ({ silent = false } = {}) => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const data = await authFetch('/orders');
      setOrders(data.orders || []);
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Impossible de charger vos commandes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authFetch, isAuthenticated]);

  // Recharge à chaque retour sur l'écran (ex. après avoir créé une commande depuis le
  // panier), pas seulement au premier montage.
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders({ silent: true });
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>🔒</Text>
        <Text style={styles.emptyText}>Connectez-vous pour voir vos commandes.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={styles.loadingText}>Chargement de vos commandes...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={orders.length ? styles.list : styles.listEmpty}
      data={orders}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      ListEmptyComponent={
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>Vous n'avez pas encore de commande.</Text>
          <TouchableOpacity style={styles.shopButton} onPress={() => navigation.navigate('Products')}>
            <Text style={styles.shopButtonText}>Parcourir le catalogue</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.orderRef}>Commande #{item.id.slice(0, 8)}</Text>
            <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] || '#64748b' }]}>
              <Text style={styles.badgeText}>{STATUS_LABELS[item.status] || item.status}</Text>
            </View>
          </View>
          <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
          <Text style={styles.orderTotal}>{formatOrderAmount(item)}</Text>
          {item.payment_provider && (
            <Text style={styles.orderPayment}>
              Paiement : {item.payment_provider}{item.payment_status ? ` · ${item.payment_status}` : ''}
            </Text>
          )}
        </View>
      )}
    />
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
    padding: 32,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  listEmpty: {
    flexGrow: 1,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  shopButton: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderRef: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  orderDate: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 4,
  },
  orderPayment: {
    fontSize: 12,
    color: '#64748b',
  },
});
