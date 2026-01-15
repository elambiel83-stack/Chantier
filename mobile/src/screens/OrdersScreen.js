import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function OrdersScreen() {
  const [orders, setOrders] = React.useState([]);

  return (
    <SafeAreaView style={styles.container}>
      {orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>Aucune commande</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              <Text style={styles.orderNumber}>{item.orderNumber}</Text>
              <Text style={styles.orderDate}>{item.date}</Text>
              <Text style={styles.orderStatus}>{item.status}</Text>
              <Text style={styles.orderTotal}>{item.total} USD</Text>
            </View>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  list: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderStatus: {
    fontSize: 14,
    color: '#2196F3',
    marginBottom: 4,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
});

export default OrdersScreen;
