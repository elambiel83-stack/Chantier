import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/Dashboard.css';

function BuyerDashboard() {
  const [orders, setOrders] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBuyerData();
  }, []);

  const fetchBuyerData = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      setUser(storedUser);
      
      const ordersRes = await api.get(`/orders?buyer=${storedUser.id}`);
      setOrders(ordersRes.data.orders || []);
    } catch (error) {
      console.error('Error fetching buyer data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Mon Profil</h1>

      {user && (
        <div className="profile-section">
          <div className="profile-info">
            <h2>{user.name}</h2>
            <p>Email: {user.email}</p>
            <p>Rôle: {user.role}</p>
          </div>
        </div>
      )}

      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>Commandes</h3>
          <p className="stat-value">{orders.length}</p>
        </div>
        <div className="stat-card">
          <h3>En cours</h3>
          <p className="stat-value">
            {orders.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status)).length}
          </p>
        </div>
        <div className="stat-card">
          <h3>Livrées</h3>
          <p className="stat-value">
            {orders.filter(o => o.status === 'delivered').length}
          </p>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Mes Commandes</h2>
        <div className="orders-list">
          {orders.length === 0 ? (
            <p>Aucune commande</p>
          ) : (
            orders.map(order => (
              <div key={order._id} className="order-row">
                <div>
                  <h3>{order.orderNumber}</h3>
                  <p>{new Date(order.createdAt).toLocaleDateString()}</p>
                  <p>{order.items?.length || 0} article(s)</p>
                </div>
                <div>
                  <p className="status">{order.status}</p>
                  <p className="price">{order.totalAmount.total} {order.totalAmount.currency}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default BuyerDashboard;
