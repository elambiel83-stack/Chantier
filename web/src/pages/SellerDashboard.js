import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/Dashboard.css';

function SellerDashboard() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSellerData();
  }, []);

  const fetchSellerData = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const [productsRes, ordersRes] = await Promise.all([
        api.get(`/products?seller=${user.id}`),
        api.get(`/orders?seller=${user.id}`)
      ]);
      setProducts(productsRes.data.products || []);
      setOrders(ordersRes.data.orders || []);
    } catch (error) {
      console.error('Error fetching seller data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Tableau de bord Vendeur</h1>

      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>Produits</h3>
          <p className="stat-value">{products.length}</p>
        </div>
        <div className="stat-card">
          <h3>Commandes</h3>
          <p className="stat-value">{orders.length}</p>
        </div>
        <div className="stat-card">
          <h3>Ventes totales</h3>
          <p className="stat-value">
            {orders.reduce((sum, order) => sum + order.totalAmount.total, 0).toFixed(2)} USD
          </p>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Mes Produits</h2>
        <div className="products-list">
          {products.length === 0 ? (
            <p>Aucun produit</p>
          ) : (
            products.map(product => (
              <div key={product._id} className="product-row">
                <div>
                  <h3>{product.name}</h3>
                  <p>{product.category}</p>
                </div>
                <div>
                  <p className="price">{product.price.amount} {product.price.currency}</p>
                  <p>Stock: {product.stock.quantity}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Commandes récentes</h2>
        <div className="orders-list">
          {orders.length === 0 ? (
            <p>Aucune commande</p>
          ) : (
            orders.slice(0, 5).map(order => (
              <div key={order._id} className="order-row">
                <div>
                  <h3>{order.orderNumber}</h3>
                  <p>{new Date(order.createdAt).toLocaleDateString()}</p>
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

export default SellerDashboard;
