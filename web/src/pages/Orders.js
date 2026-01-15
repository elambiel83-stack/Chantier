import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/Orders.css';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/orders');
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="orders-page">
      <h1>Commandes</h1>

      {orders.length === 0 ? (
        <div className="no-orders">
          <p>Aucune commande</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map(order => (
            <div key={order._id} className="order-card">
              <div className="order-header">
                <h3>{order.orderNumber}</h3>
                <span className={`status-badge ${order.status}`}>
                  {order.status}
                </span>
              </div>
              <div className="order-body">
                <p>Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                <p>Articles: {order.items?.length || 0}</p>
                <p>Total: {order.totalAmount.total} {order.totalAmount.currency}</p>
                {order.shippingAddress && (
                  <p>
                    Livraison: {order.shippingAddress.city}, {order.shippingAddress.country}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Orders;
