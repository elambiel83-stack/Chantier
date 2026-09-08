import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  delivering: 'En livraison',
  completed: 'Terminée',
  cancelled: 'Annulée',
};
const PAYMENT_PROVIDER_LABELS = {
  paypal: 'PayPal',
  airtel_money: 'Airtel Money',
  orange_money: 'Orange Money',
};
const PAYMENT_STATUS_LABELS = {
  pending: 'en attente',
  authorized: 'autorisé',
  paid: 'payé',
  failed: 'échoué',
  cancelled: 'annulé',
  refunded: 'remboursé',
};

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (error) {
    return iso;
  }
}

function OrderCard({ order, authFetch }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState(null);

  const toggle = async () => {
    if (!expanded && items === null) {
      setLoadingItems(true);
      setItemsError(null);
      try {
        const { order: detail } = await authFetch(`/orders/${order.id}`);
        setItems(detail.items);
      } catch (error) {
        setItemsError(error.message || 'Impossible de charger le détail.');
      } finally {
        setLoadingItems(false);
      }
    }
    setExpanded((current) => !current);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderId}>Commande {order.id.slice(0, 8)}</Text>
          <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.orderTotal}>{order.total_amount} {order.currency}</Text>
          <Text style={styles.orderStatus}>{STATUS_LABELS[order.status] || order.status}</Text>
        </View>
      </View>
      <Text style={styles.paymentLine}>
        Paiement : {PAYMENT_PROVIDER_LABELS[order.payment_provider] || order.payment_provider || '—'}
        {order.payment_status ? ` (${PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status})` : ''}
      </Text>
      <TouchableOpacity onPress={toggle}>
        <Text style={styles.toggleLink}>{expanded ? 'Masquer le détail' : 'Voir le détail'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.detailBox}>
          {loadingItems && <ActivityIndicator size="small" color="#1e293b" />}
          {itemsError && <Text style={styles.errorText}>{itemsError}</Text>}
          {items && items.map((item) => (
            <View key={item.id} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{item.name_fr} × {item.qty} {item.unit}</Text>
              <Text style={styles.detailAmount}>{(item.qty * item.unit_price_usd).toFixed(2)} USD</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function OrdersScreen() {
  const { authFetch, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { orders: list } = await authFetch('/orders');
        setOrders(list);
      } catch (err) {
        setError(err.message || 'Impossible de charger vos commandes.');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Connectez-vous pour voir vos commandes.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#1e293b" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!orders.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Vous n'avez pas encore de commande.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={orders}
      keyExtractor={(order) => order.id}
      renderItem={({ item }) => <OrderCard order={item} authFetch={authFetch} />}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8fafc',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
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
    alignItems: 'flex-start',
  },
  orderId: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  orderDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  orderStatus: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  paymentLine: {
    fontSize: 13,
    color: '#475569',
    marginTop: 8,
  },
  toggleLink: {
    fontSize: 13,
    color: '#dc2626',
    marginTop: 10,
    textDecorationLine: 'underline',
  },
  detailBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 13,
    color: '#1e293b',
    flexShrink: 1,
  },
  detailAmount: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
});
